import { Address, AddressMap, EcKeyPair, TapscriptVerificator } from '@btc-vision/transaction';
import { Logger } from '@btc-vision/logger';
import { ContractManager } from '@btc-vision/op-vm';
import bitcoin, { Network } from '@btc-vision/bitcoin';
import crypto from 'crypto';
import {
    NETWORK,
    TRACE_CALLS,
    TRACE_DEPLOYMENTS,
    TRACE_GAS,
    TRACE_POINTERS,
} from '../contracts/configs.js';
import { ContractRuntime } from '../opnet/modules/ContractRuntime.js';
import { BytecodeManager } from '../opnet/modules/GetBytecode.js';
import { RustContractBinding } from '../opnet/vm/RustContractBinding.js';
import { Transaction } from './Transaction.js';
import { VMTCPServer } from '../opnet/tcp/VMTCPServer.js';

class BlockchainBase extends Logger {
    public readonly logColor: string = '#8332ff';
    public readonly DEAD_ADDRESS: Address = Address.dead();

    public traceGas: boolean = TRACE_GAS;
    public tracePointers: boolean = TRACE_POINTERS;
    public traceCalls: boolean = TRACE_CALLS;
    public traceDeployments: boolean = TRACE_DEPLOYMENTS;
    public simulateRealEnvironment: boolean = false;

    private readonly tcpServer: VMTCPServer;

    private readonly enableDebug: boolean = false;
    private readonly contracts: AddressMap<ContractRuntime> = new AddressMap<ContractRuntime>();
    private readonly bindings: Map<bigint, RustContractBinding> = new Map<
        bigint,
        RustContractBinding
    >();

    constructor(public readonly network: Network) {
        super();

        this.tcpServer = new VMTCPServer(this.bindings, this.enableDebug);
    }

    private _transaction: Transaction | null = null;

    public get transaction(): Transaction | null {
        return this._transaction;
    }

    public set transaction(tx: Transaction | null) {
        this._transaction = tx;
    }

    private _contractManager?: ContractManager;

    public get contractManager(): ContractManager {
        if (!this._contractManager) {
            throw new Error('Contract manager not initialized');
        }

        return this._contractManager;
    }

    private _blockNumber: bigint = 1n;

    public get blockNumber(): bigint {
        return this._blockNumber;
    }

    public set blockNumber(blockNumber: bigint) {
        this._blockNumber = blockNumber;
    }

    private _medianTimestamp: bigint = BigInt(Date.now());

    public get medianTimestamp(): bigint {
        return this._medianTimestamp;
    }

    public set medianTimestamp(timestamp: bigint) {
        this._medianTimestamp = timestamp;
    }

    private _msgSender: Address = Address.dead();

    public get msgSender(): Address {
        return this._msgSender;
    }

    public set msgSender(sender: Address) {
        this._msgSender = sender;
    }

    private _txOrigin: Address = Address.dead();

    public get txOrigin(): Address {
        return this._txOrigin;
    }

    public set txOrigin(from: Address) {
        this._txOrigin = from;
    }

    public async createManager(): Promise<void> {
        const port = await this.tcpServer.start();

        this._contractManager = new ContractManager(
            16, // max idling runtime
            port,
            10,
        );
    }

    public removeBinding(id: bigint): void {
        this.bindings.delete(id);
    }

    public registerBinding(binding: RustContractBinding): void {
        this.bindings.set(binding.id, binding);
    }

    public generateRandomAddress(): Address {
        const rndKeyPair = EcKeyPair.generateRandomKeyPair(this.network);
        return new Address(rndKeyPair.publicKey);
    }

    public register(contract: ContractRuntime): void {
        if (this.contracts.has(contract.address)) {
            throw new Error(
                `Contract already registered at address ${contract.address.p2tr(this.network)}`,
            );
        }

        this.contracts.set(contract.address, contract);
    }

    public clearContracts(): void {
        this.contracts.clear();
    }

    public generateAddress(
        deployer: Address,
        salt: Buffer,
        from: Address,
    ): { contractAddress: Address; virtualAddress: Buffer } {
        const bytecode = BytecodeManager.getBytecode(from);
        const contractVirtualAddress = TapscriptVerificator.getContractSeed(
            bitcoin.crypto.hash256(Buffer.from(deployer)),
            Buffer.from(bytecode),
            salt,
        );

        /** Generate contract segwit address */
        return {
            contractAddress: new Address(contractVirtualAddress),
            virtualAddress: contractVirtualAddress,
        };
    }

    public getContract(address: Address): ContractRuntime {
        const contract = this.contracts.get(address);
        if (!contract) {
            throw new Error(`Contract not found at address ${address}`);
        }

        return contract;
    }

    public backup(): void {
        for (const contract of this.contracts.values()) {
            contract.backupStates();
        }
    }

    public restore(): void {
        for (const contract of this.contracts.values()) {
            contract.restoreStates();
        }
    }

    public dispose(): void {
        // We remove the transaction data after the execution
        Blockchain.transaction = null;

        for (const contract of this.contracts.values()) {
            contract.dispose.bind(contract)();
        }
    }

    public cleanup(): void {
        for (const contract of this.contracts.values()) {
            contract.delete();
        }

        this.contractManager.destroyAll();
        this.contractManager.destroy();

        this.tcpServer.stop();
        delete this._contractManager;
    }

    public async init(): Promise<void> {
        this.dispose();

        for (const contract of this.contracts.values()) {
            await contract.init();
        }
    }

    public expandTo18Decimals(n: number): bigint {
        return BigInt(n) * 10n ** 18n;
    }

    public expandToDecimal(n: number, decimals: number): bigint {
        return BigInt(n) * 10n ** BigInt(decimals);
    }

    public decodeFrom18Decimals(n: bigint): number {
        return Number(n / 10n ** 18n);
    }

    public decodeFromDecimal(n: bigint, decimals: number): number {
        return Number(n / 10n ** BigInt(decimals));
    }

    public mineBlock(): void {
        this._blockNumber += 1n;
    }

    public enableGasTracking(): void {
        this.traceGas = true;
    }

    public disableGasTracking(): void {
        this.traceGas = false;
    }

    public enablePointerTracking(): void {
        this.tracePointers = true;
    }

    public disablePointerTracking(): void {
        this.tracePointers = false;
    }

    public enableCallTracking(): void {
        this.traceCalls = true;
    }

    public disableCallTracking(): void {
        this.traceCalls = false;
    }

    public encodePrice(reserve0: bigint, reserve1: bigint): [bigint, bigint] {
        const shift = 2n ** 112n;
        const price0 = (reserve1 * shift) / reserve0;
        const price1 = (reserve0 * shift) / reserve1;
        return [price0, price1];
    }

    private getRandomBytes(length: number): Buffer {
        return Buffer.from(crypto.getRandomValues(new Uint8Array(length)));
    }
}

export const Blockchain = new BlockchainBase(NETWORK);
await Blockchain.createManager();

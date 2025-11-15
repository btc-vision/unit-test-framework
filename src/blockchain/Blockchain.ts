import bitcoin, { Network } from '@btc-vision/bitcoin';
import { Logger } from '@btc-vision/logger';
import {
    AccountTypeResponse,
    BlockHashRequest,
    BlockHashResponse,
    ContractManager,
    ThreadSafeJsImportResponse,
} from '@btc-vision/op-vm';
import { Address, AddressMap, TapscriptVerificator, Wallet } from '@btc-vision/transaction';
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
import { StateHandler } from '../opnet/vm/StateHandler.js';
import { Transaction } from './Transaction.js';
import { MLDSAPublicKeyCache } from './MLDSAPublicKeyCache.js';
import { ConsensusManager } from '../consensus/ConsensusManager.js';

class BlockchainBase extends Logger {
    public readonly logColor: string = '#8332ff';
    public readonly DEAD_ADDRESS: Address = Address.dead();

    public traceGas: boolean = TRACE_GAS;
    public tracePointers: boolean = TRACE_POINTERS;
    public traceCalls: boolean = TRACE_CALLS;
    public traceDeployments: boolean = TRACE_DEPLOYMENTS;
    public simulateRealEnvironment: boolean = false;

    private readonly addressMLDSACache: MLDSAPublicKeyCache = new MLDSAPublicKeyCache();

    private readonly enableDebug: boolean = false;
    private readonly contracts: AddressMap<ContractRuntime> = new AddressMap<ContractRuntime>();
    private readonly bindings: Map<bigint, RustContractBinding> = new Map<
        bigint,
        RustContractBinding
    >();

    constructor(public network: Network) {
        super();
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
            this.createManager();
        }

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

    public changeNetwork(network: Network): void {
        this.network = network;
    }

    public createManager(): void {
        this._contractManager = new ContractManager(
            16, // max idling runtime
            this.loadJsFunction,
            this.storeJSFunction,
            this.callJSFunction,
            this.deployContractAtAddressJSFunction,
            this.logJSFunction,
            this.emitJSFunction,
            this.inputsJSFunction,
            this.outputsJSFunction,
            this.accountTypeJSFunction,
            this.blockHashJSFunction,
            this.loadMLDSAJsFunction,
        );
    }

    public registerMLDSAPublicKey(address: Address, publicKey: Uint8Array): void {
        this.addressMLDSACache.set(address, publicKey);
    }

    public getMLDSAPublicKey(address: Address): Uint8Array | undefined {
        return this.addressMLDSACache.get(address);
    }

    public removeBinding(id: bigint): void {
        this.bindings.delete(id);
    }

    public registerBinding(binding: RustContractBinding): void {
        this.bindings.set(binding.id, binding);
    }

    /**
     * Generate a random address
     * @returns {Address} The generated address
     */
    public generateRandomAddress(): Address {
        const rndKeyPair = Wallet.generate(this.network);
        this.addressMLDSACache.set(rndKeyPair.address, rndKeyPair.quantumPublicKey);

        return rndKeyPair.address;
    }

    /**
     * Generate a random wallet
     * @returns {Wallet} The generated wallet
     */
    public generateRandomWallet(): Wallet {
        const rndKeyPair = Wallet.generate(this.network);
        this.addressMLDSACache.set(rndKeyPair.address, rndKeyPair.quantumPublicKey);

        return rndKeyPair;
    }

    public register(contract: ContractRuntime): void {
        if (this.contracts.has(contract.address)) {
            throw new Error(
                `Contract already registered at address ${contract.address.p2op(this.network)}`,
            );
        }

        this.contracts.set(contract.address, contract);
    }

    public unregister(contract: ContractRuntime): void {
        if (!this.contracts.has(contract.address)) {
            throw new Error(
                `Contract not registered at address ${contract.address.p2op(this.network)}`,
            );
        }

        this.contracts.delete(contract.address);
    }

    public clearContracts(): void {
        StateHandler.purgeAll();
        ConsensusManager.default();

        this.addressMLDSACache.clear();
        this.contracts.clear();
    }

    public generateAddress(deployer: Address, salt: Buffer, from: Address): Address {
        const bytecode = BytecodeManager.getBytecode(from);
        const contractVirtualAddress = TapscriptVerificator.getContractSeed(
            bitcoin.crypto.hash256(Buffer.from(deployer)),
            Buffer.from(bytecode),
            salt,
        );

        /** Generate contract segwit address */
        return new Address(contractVirtualAddress);
    }

    public getContract(address: Address): ContractRuntime {
        const contract = this.contracts.get(address);
        if (!contract) {
            throw new Error(`Contract not found at address ${address}`);
        }

        return contract;
    }

    public isContract(address: Address): boolean {
        return this.contracts.has(address);
    }

    public backupStates(): void {
        for (const contract of this.contracts.values()) {
            contract.backupStates();
        }
    }

    public restoreStates(): void {
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
        StateHandler.purgeAll();

        for (const contract of this.contracts.values()) {
            contract.delete();
        }

        this.contractManager.destroyAll();
        this.contractManager.destroy();

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

    private loadJsFunction: (
        _: never,
        result: ThreadSafeJsImportResponse,
    ) => Promise<Buffer | Uint8Array> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<Buffer | Uint8Array> => {
        if (this.enableDebug) console.log('LOAD', value.buffer);

        const u = new Uint8Array(value.buffer);
        const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);
        const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

        if (!c) {
            throw new Error('Binding not found');
        }

        return c.load(buf);
    };

    private storeJSFunction: (
        _: never,
        result: ThreadSafeJsImportResponse,
    ) => Promise<Buffer | Uint8Array> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<Buffer | Uint8Array> => {
        if (this.enableDebug) console.log('STORE', value.buffer);

        const u = new Uint8Array(value.buffer);
        const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);

        const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

        if (!c) {
            throw new Error('Binding not found');
        }

        return c.store(buf);
    };

    private loadMLDSAJsFunction: (
        _: never,
        result: ThreadSafeJsImportResponse,
    ) => Promise<Buffer | Uint8Array> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<Buffer | Uint8Array> => {
        if (this.enableDebug) console.log('LOAD MLDSA', value.buffer);

        const u = new Uint8Array(value.buffer);
        const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);
        const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

        if (!c) {
            throw new Error('Binding not found');
        }

        return c.loadMLDSA(buf);
    };

    private callJSFunction: (
        _: never,
        result: ThreadSafeJsImportResponse,
    ) => Promise<Buffer | Uint8Array> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<Buffer | Uint8Array> => {
        if (this.enableDebug) console.log('CALL', value.buffer);

        const u = new Uint8Array(value.buffer);
        const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);

        const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

        if (!c) {
            throw new Error('Binding not found');
        }

        return c.call(buf);
    };

    private deployContractAtAddressJSFunction: (
        _: never,
        result: ThreadSafeJsImportResponse,
    ) => Promise<Buffer | Uint8Array> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<Buffer | Uint8Array> => {
        if (this.enableDebug) console.log('DEPLOY', value.buffer);

        const u = new Uint8Array(value.buffer);
        const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);

        const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

        if (!c) {
            throw new Error('Binding not found');
        }

        return c.deployContractAtAddress(buf);
    };

    private logJSFunction: (_: never, result: ThreadSafeJsImportResponse) => Promise<void> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<void> => {
        return new Promise((resolve) => {
            // temporary
            const u = new Uint8Array(value.buffer);
            const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);

            const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

            if (!c) {
                throw new Error('Binding not found');
            }

            c.log(buf);

            resolve();
        });
    };

    private emitJSFunction: (_: never, result: ThreadSafeJsImportResponse) => Promise<void> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<void> => {
        return new Promise<void>((resolve) => {
            // temporary
            const u = new Uint8Array(value.buffer);
            const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);

            const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

            if (!c) {
                throw new Error('Binding not found');
            }

            c.emit(buf);

            resolve();
        });
    };

    private inputsJSFunction: (id: bigint) => Promise<Buffer | Uint8Array> = (
        id: bigint,
    ): Promise<Buffer | Uint8Array> => {
        if (this.enableDebug) console.log('INPUTS', id);

        const c = this.bindings.get(BigInt(`${id}`)); // otherwise unsafe.
        if (!c) {
            throw new Error('Binding not found');
        }

        return c.inputs();
    };

    private outputsJSFunction: (id: bigint) => Promise<Buffer | Uint8Array> = (
        id: bigint,
    ): Promise<Buffer | Uint8Array> => {
        if (this.enableDebug) console.log('OUTPUT', id);

        const c = this.bindings.get(BigInt(`${id}`)); // otherwise unsafe.
        if (!c) {
            throw new Error('Binding not found');
        }

        return c.outputs();
    };

    private accountTypeJSFunction: (
        _: never,
        result: ThreadSafeJsImportResponse,
    ) => Promise<AccountTypeResponse> = (
        _: never,
        value: ThreadSafeJsImportResponse,
    ): Promise<AccountTypeResponse> => {
        if (this.enableDebug) console.log('ACCOUNT TYPE', value.buffer);

        const u = new Uint8Array(value.buffer);
        const buf = Buffer.from(u.buffer, u.byteOffset, u.byteLength);

        const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

        if (!c) {
            throw new Error('Binding not found');
        }

        return c.accountType(buf);
    };

    private blockHashJSFunction: (
        _: never,
        result: BlockHashRequest,
    ) => Promise<BlockHashResponse> = (
        _: never,
        value: BlockHashRequest,
    ): Promise<BlockHashResponse> => {
        if (this.enableDebug) console.log('BLOCK HASH', value.blockNumber);

        const c = this.bindings.get(BigInt(`${value.contractId}`)); // otherwise unsafe.

        if (!c) {
            throw new Error('Binding not found');
        }

        return c.blockHash(value.blockNumber);
    };

    private getRandomBytes(length: number): Buffer {
        return Buffer.from(crypto.getRandomValues(new Uint8Array(length)));
    }
}

export const Blockchain = new BlockchainBase(NETWORK);

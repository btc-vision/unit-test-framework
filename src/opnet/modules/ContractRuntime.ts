import {
    ABICoder,
    Address,
    AddressMap,
    AddressSet,
    BinaryReader,
    BinaryWriter,
    NetEvent,
} from '@btc-vision/transaction';
import { Logger } from '@btc-vision/logger';
import { AccountTypeResponse, BitcoinNetworkRequest, EnvironmentVariablesRequest } from '@btc-vision/op-vm';
import bitcoin from '@btc-vision/bitcoin';
import crypto from 'crypto';
import { Blockchain } from '../../blockchain/Blockchain.js';
import { DISABLE_REENTRANCY_GUARD, MAX_CALL_STACK_DEPTH } from '../../contracts/configs.js';
import { CallResponse } from '../interfaces/CallResponse.js';
import { ContractDetails } from '../interfaces/ContractDetails.js';
import { ContractParameters, RustContract } from '../vm/RustContract.js';
import { BytecodeManager } from './GetBytecode.js';
import { FastBigIntMap } from './FastMap.js';

export class ContractRuntime extends Logger {
    public readonly logColor: string = '#39b2f3';

    public gasUsed: bigint = 0n;
    public address: Address;
    public readonly deployer: Address;

    public loadedPointers: bigint = 0n;
    public storedPointers: bigint = 0n;

    protected states: FastBigIntMap = new FastBigIntMap();
    protected deploymentStates: FastBigIntMap = new FastBigIntMap();

    protected shouldPreserveState: boolean = true;
    protected events: NetEvent[] = [];

    protected readonly gasMax: bigint = 100_000_000_000n;
    protected readonly deployedContracts: AddressMap<Buffer> = new AddressMap<Buffer>();
    protected readonly abiCoder = new ABICoder();

    private callStack: AddressSet = new AddressSet();
    private touchedAddresses: AddressSet = new AddressSet();
    private statesBackup: FastBigIntMap = new FastBigIntMap();

    private readonly potentialBytecode?: Buffer;
    private readonly deploymentCalldata?: Buffer;

    private readonly isDebugMode = true;

    protected constructor(details: ContractDetails) {
        super();

        this.deployer = details.deployer;
        this.address = details.address;

        this.potentialBytecode = details.bytecode;
        this.deploymentCalldata = details.deploymentCalldata;

        if (details.gasLimit) {
            this.gasMax = details.gasLimit;
        }

        if (details.gasUsed !== undefined) {
            this.gasUsed = details.gasUsed;
        } else {
            this.gasUsed = 0n;
        }

        if (!this.deployer) {
            throw new Error('Deployer address not provided');
        }
    }

    _contract: RustContract | undefined;

    public get contract(): RustContract {
        if (!this._contract) {
            throw new Error('Contract not initialized');
        }

        return this._contract;
    }

    protected _bytecode: Buffer | undefined;

    protected get bytecode(): Buffer {
        if (!this._bytecode) throw new Error(`Bytecode not found for ${this.address}`);

        return this._bytecode;
    }

    private get transactionId(): Uint8Array {
        // generate random 32 bytes
        return crypto.getRandomValues(new Uint8Array(32));
    }

    private get transactionHash(): Uint8Array {
        // generate random 32 bytes
        return crypto.getRandomValues(new Uint8Array(32));
    }

    private get blockHash(): Uint8Array {
        // generate random 32 bytes
        return crypto.getRandomValues(new Uint8Array(32));
    }

    private get p2trAddress(): string {
        return this.address.p2tr(Blockchain.network);
    }

    public preserveState(): void {
        this.shouldPreserveState = true;
    }

    public doNotPreserveState(): void {
        this.shouldPreserveState = false;
    }

    public getStates(): FastBigIntMap {
        return this.states;
    }

    public setStates(states: FastBigIntMap): void {
        this.states = new FastBigIntMap(states);
    }

    public delete(): void {
        this.dispose();

        delete this._contract;
        delete this._bytecode;

        this.restoreStatesToDeployment();
        this.statesBackup.clear();

        this.events = [];

        this.callStack.clear();
        this.touchedAddresses.clear()
        this.deployedContracts.clear();
    }

    public resetStates(): Promise<void> | void {
        this.restoreStatesToDeployment();
    }

    public setEnvironment(
        msgSender: Address = Blockchain.msgSender || this.deployer,
        txOrigin: Address = Blockchain.txOrigin || this.deployer,
        currentBlock: bigint = Blockchain.blockNumber,
        deployer: Address = this.deployer,
        address: Address = this.address,
    ): void {
        if (this.transactionHash.length !== 32) {
            throw new Error('Transaction ID must be 32 bytes long');
        }

        const writer = new BinaryWriter();
        writer.writeAddress(msgSender);
        writer.writeAddress(txOrigin); // "leftmost thing in the call chain"
        writer.writeBytes(this.transactionHash); // "transaction id"

        writer.writeU256(currentBlock);
        writer.writeAddress(deployer);
        writer.writeAddress(address);
        writer.writeU64(Blockchain.medianTimestamp);

        const params: EnvironmentVariablesRequest = {
            blockHash: this.blockHash,
            blockNumber: currentBlock,
            blockMedianTime: Blockchain.medianTimestamp,
            txId: this.transactionId,
            txHash: this.transactionHash,
            contractAddress: address,
            contractDeployer: deployer,
            caller: msgSender,
            origin: txOrigin,
        };

        this.contract.setEnvironment(params);
    }

    public backupStates(): void {
        this.statesBackup = new FastBigIntMap(this.states);
    }

    public restoreStates(): void {
        this.states = new FastBigIntMap(this.statesBackup);
    }

    public async onCall(
        data: Buffer | Uint8Array,
        sender: Address,
        from: Address,
        gasUsed: bigint,
    ): Promise<CallResponse> {
        const reader = new BinaryReader(data);
        const selector: number = reader.readSelector();

        if (Blockchain.traceCalls) {
            this.log(
                `Called externally by an other contract. Selector: ${selector.toString(16)}`, //- Calldata: ${calldata.toString('hex')}
            );
        }

        const response: CallResponse = await this.execute(data as Buffer, sender, from, gasUsed);
        if (Blockchain.traceCalls) {
            this.log(`Call response: ${response.response}`);
        }

        this.dispose();

        if (response.error) {
            throw this.handleError(response.error);
        }

        return {
            status: response.status,
            response: response.response,
            events: response.events,
            callStack: this.callStack,
            touchedAddresses: this.touchedAddresses,
            usedGas: response.usedGas,
        };
    }

    public dispose(): void {
        if (this._contract) {
            this._contract.dispose();
        }
    }

    public async init(): Promise<void> {
        this.defineRequiredBytecodes();

        this._bytecode = BytecodeManager.getBytecode(this.address) as Buffer;

        return Promise.resolve();
    }

    public async deployContract(): Promise<void> {
        if (this.deploymentStates.size || this.states.size) {
            return;
        }

        const statesBackup = new FastBigIntMap(this.states);
        this.loadContract();

        this.setEnvironment(this.deployer, this.deployer);

        const calldata = this.deploymentCalldata || Buffer.alloc(0);

        let error: Error | undefined;
        const response = await this.contract.onDeploy(calldata).catch((e: unknown) => {
            error = e as Error;
        });

        if (response && response.status !== 0) {
            error = this.contract.getRevertError();
        }

        if (error) {
            // Restore states
            this.states = statesBackup;
        }

        if (response == null) {
            throw error;
        }

        this.deploymentStates = new FastBigIntMap(this.states);

        this.dispose();
    }

    public getDeploymentStates(): FastBigIntMap {
        return this.deploymentStates;
    }

    protected async execute(
        calldata: Buffer | Uint8Array,
        sender?: Address,
        txOrigin?: Address,
        gasUsed?: bigint,
    ): Promise<CallResponse> {
        this.gasUsed = 0n;

        // Deploy if not deployed.
        await this.deployContract();

        this.gasUsed = gasUsed || 0n;
        this.loadContract();

        if (sender || txOrigin) {
            this.setEnvironment(sender, txOrigin);
        } else {
            this.setEnvironment();
        }

        const statesBackup = new FastBigIntMap(this.states);
        this.loadedPointers = 0n;
        this.storedPointers = 0n;

        let error: Error | undefined;
        const response = await this.contract.execute(calldata).catch(async (e: unknown) => {
            error = (await e) as Error;

            return undefined;
        });

        if (response && response.status !== 0) {
            error = this.contract.getRevertError();
        }

        if (error) {
            // Restore states
            this.states = statesBackup;
        }

        if (response == null) {
            throw error;
        }

        this.gasUsed = response.gasUsed;

        return {
            status: response.status,
            response: Uint8Array.from(response.data),
            error,
            events: this.events,
            callStack: this.callStack,
            touchedAddresses: this.touchedAddresses,
            usedGas: response.gasUsed,
        };
    }

    protected handleError(error: Error): Error {
        return new Error(`(in: ${this.address}) OPNET: ${error.stack}`);
    }

    protected defineRequiredBytecodes(): void {
        if (this.potentialBytecode) {
            this._bytecode = this.potentialBytecode;

            BytecodeManager.setBytecode(this.address, this.potentialBytecode);
        } else {
            throw new Error('Not implemented');
        }
    }

    protected loadContract(): void {
        try {
            if (!this.shouldPreserveState) {
                this.states = new FastBigIntMap(this.deploymentStates);
            }

            try {
                this.dispose();
            } catch (e) {
                const strErr = (e as Error).message;

                if (strErr.includes('REENTRANCY')) {
                    this.warn(strErr);
                }
            }

            this.events = [];
            this.callStack = new AddressSet([this.address]);
            this.touchedAddresses = new AddressSet([this.address]);

            const params: ContractParameters = this.generateParams();
            this._contract = new RustContract(params);
        } catch (e) {
            if (this._contract) {
                try {
                    this._contract.dispose();
                } catch {}
            }

            throw e;
        }
    }

    private restoreStatesToDeployment(): void {
        this.states = new FastBigIntMap(this.deploymentStates);
    }

    private async deployContractAtAddress(data: Buffer): Promise<Buffer | Uint8Array> {
        const reader = new BinaryReader(data);

        const address: Address = reader.readAddress();
        const salt: Buffer = Buffer.from(reader.readBytes(32));
        const saltBig = BigInt(
            '0x' + salt.reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), ''),
        );

        if (Blockchain.traceDeployments) {
            this.log(
                `This contract wants to deploy the same bytecode as ${address}. Salt: ${salt.toString('hex')} or ${saltBig}`,
            );
        }

        const deployedContractAddress = Blockchain.generateAddress(this.address, salt, address);
        if (this.deployedContracts.has(deployedContractAddress)) {
            const response = new BinaryWriter(32 + 4);

            return response.getBuffer();
        }

        const requestedContractBytecode = BytecodeManager.getBytecode(address) as Buffer;
        const newContract: ContractRuntime = new ContractRuntime({
            address: deployedContractAddress,
            deployer: this.address,
            gasLimit: this.gasMax,
            bytecode: requestedContractBytecode,
        });

        newContract.preserveState();

        if (Blockchain.traceDeployments) {
            this.info(`Deploying contract at ${deployedContractAddress.p2tr(Blockchain.network)}`);
        }

        Blockchain.register(newContract);

        await newContract.init();

        if (Blockchain.traceDeployments) {
            this.log(`Deployed contract at ${deployedContractAddress.p2tr(Blockchain.network)}`);
        }

        this.deployedContracts.set(deployedContractAddress, this.bytecode);

        const response = new BinaryWriter();
        response.writeAddress(deployedContractAddress);
        response.writeU32(requestedContractBytecode.byteLength);

        return response.getBuffer();
    }

    private load(data: Buffer): Buffer | Uint8Array {
        const reader = new BinaryReader(data);
        const pointer = reader.readU256();
        const value = this.states.get(pointer);

        if (Blockchain.tracePointers) {
            this.log(`Attempting to load pointer ${pointer} - value ${value || 0n}`);
        }

        this.loadedPointers++;

        const response: BinaryWriter = new BinaryWriter();
        response.writeU256(value || 0n);
        response.writeBoolean(value !== undefined);

        return response.getBuffer();
    }

    private store(data: Buffer): Buffer | Uint8Array {
        const reader = new BinaryReader(data);
        const pointer: bigint = reader.readU256();
        const value: bigint = reader.readU256();

        if (Blockchain.tracePointers) {
            this.log(`Attempting to store pointer ${pointer} - value ${value}`);
        }

        this.states.set(pointer, value);

        this.storedPointers++;

        const response: BinaryWriter = new BinaryWriter();
        response.writeBoolean(true);

        return response.getBuffer();
    }

    private checkReentrancy(calls: AddressSet): void {
        if (DISABLE_REENTRANCY_GUARD) {
            return;
        }

        if (calls.has(this.address)) {
            throw new Error('OPNET: REENTRANCY DETECTED');
        }
    }

    private async call(data: Buffer): Promise<Buffer | Uint8Array> {
        if (!this._contract) {
            throw new Error('Contract not initialized');
        }

        const reader = new BinaryReader(data);
        const gasUsed: bigint = reader.readU64();
        const contractAddress: Address = reader.readAddress();
        const calldata: Uint8Array = reader.readBytesWithLength();

        if (!contractAddress) {
            throw new Error(`No contract address specified in call?`);
        }

        if (Blockchain.traceCalls) {
            this.info(`Attempting to call contract ${contractAddress.p2tr(Blockchain.network)}`);
        }

        const contract: ContractRuntime = Blockchain.getContract(contractAddress);
        const code = contract.bytecode;
        const isAddressWarm = this.touchedAddresses.has(contractAddress);

        const ca = new ContractRuntime({
            address: contractAddress,
            deployer: contract.deployer,
            bytecode: code,
            gasLimit: contract.gasMax,
            gasUsed: gasUsed,
        });

        ca.preserveState();
        ca.setStates(contract.getStates());

        await ca.init();

        const callResponse: CallResponse = await ca.onCall(
            calldata,
            this.address,
            Blockchain.txOrigin,
            gasUsed,
        );

        contract.setStates(ca.getStates());

        try {
            ca.delete();
        } catch {}

        this.events = [...this.events, ...callResponse.events];
        this.callStack = this.callStack.combine(callResponse.callStack);
        this.touchedAddresses = this.touchedAddresses.combine(callResponse.touchedAddresses);

        if (this.callStack.size > MAX_CALL_STACK_DEPTH) {
            throw new Error(`OPNET: CALL_STACK DEPTH EXCEEDED`);
        }

        this.checkReentrancy(callResponse.callStack);

        const writer = new BinaryWriter();
        writer.writeBoolean(isAddressWarm);
        writer.writeU64(callResponse.usedGas);
        writer.writeU32(callResponse.status);
        writer.writeBytes(callResponse.response);

        return writer.getBuffer();
    }

    private onLog(data: Buffer | Uint8Array): void {
        const reader = new BinaryReader(data);
        const logData = reader.readString(data.length);

        this.warn(`Contract log: ${logData}`);
    }

    private getNetwork(): BitcoinNetworkRequest {
        switch (Blockchain.network) {
            case bitcoin.networks.bitcoin:
                return BitcoinNetworkRequest.Mainnet;
            case bitcoin.networks.testnet:
                return BitcoinNetworkRequest.Testnet;
            case bitcoin.networks.regtest:
                return BitcoinNetworkRequest.Regtest;
            default:
                throw new Error('Unknown network');
        }
    }

    private onEvent(data: Buffer): void {
        const reader = new BinaryReader(data);
        const eventName = reader.readStringWithLength();
        const eventData = reader.readBytesWithLength();

        const event = new NetEvent(eventName, eventData);
        this.events.push(event);
    }

    private onInputsRequested(): Promise<Buffer> {
        const tx = Blockchain.transaction;

        if (!tx) {
            return Promise.resolve(Buffer.alloc(1));
        } else {
            return Promise.resolve(Buffer.from(tx.serializeInputs()));
        }
    }

    private onOutputsRequested(): Promise<Buffer> {
        const tx = Blockchain.transaction;

        if (!tx) {
            return Promise.resolve(Buffer.alloc(1));
        } else {
            return Promise.resolve(Buffer.from(tx.serializeOutputs()));
        }
    }

    private getAccountType(data: Buffer): Promise<AccountTypeResponse> {
        const reader = new BinaryReader(data);
        const targetAddress = reader.readAddress();

        let accountType;
        if (Blockchain.isContract(targetAddress)) {
            accountType = 1;
        } else {
            accountType = 0;
        }

        const isAddressWarm = this.touchedAddresses.has(targetAddress);
        if (!isAddressWarm) {
            this.touchedAddresses.add(targetAddress);
        }

        return Promise.resolve({
            accountType,
            isAddressWarm,
        });
    }

    private getBlockHash(blockNumber: bigint): Promise<Buffer> {
        const fakeBlockHash = crypto.createHash('sha256').update(blockNumber.toString()).digest();
        return Promise.resolve(fakeBlockHash);
    }

    private fakeLoad(): void {
        let i = 0;
        while (i < 5000000) {
            i++;
        }
    }

    private generateParams(): ContractParameters {
        return {
            address: this.p2trAddress,
            bytecode: this.bytecode,
            gasMax: this.gasMax,
            gasUsed: this.gasUsed,
            network: this.getNetwork(),
            isDebugMode: this.isDebugMode,
            contractManager: Blockchain.contractManager,
            deployContractAtAddress: this.deployContractAtAddress.bind(this),
            load: (data: Buffer) => {
                return new Promise((resolve) => {
                    if (Blockchain.simulateRealEnvironment) {
                        this.fakeLoad();
                        resolve(this.load(data));
                    } else {
                        resolve(this.load(data));
                    }
                });
            },
            store: (data: Buffer) => {
                return new Promise((resolve) => {
                    if (Blockchain.simulateRealEnvironment) {
                        this.fakeLoad();
                        resolve(this.store(data));
                    } else {
                        resolve(this.store(data));
                    }
                });
            },
            call: this.call.bind(this),
            log: this.onLog.bind(this),
            emit: this.onEvent.bind(this),
            inputs: this.onInputsRequested.bind(this),
            outputs: this.onOutputsRequested.bind(this),
            accountType: this.getAccountType.bind(this),
            blockHash: this.getBlockHash.bind(this),
        };
    }
}

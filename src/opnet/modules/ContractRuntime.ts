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
import {
    AccountTypeResponse,
    BitcoinNetworkRequest,
    EnvironmentVariablesRequest,
} from '@btc-vision/op-vm';
import bitcoin from '@btc-vision/bitcoin';
import crypto from 'crypto';
import { Blockchain } from '../../blockchain/Blockchain.js';
import { CONSENSUS } from '../../contracts/configs.js';
import { CallResponse } from '../interfaces/CallResponse.js';
import { ContractDetails, StateOverride } from '../interfaces/ContractDetails.js';
import { ContractParameters, RustContract } from '../vm/RustContract.js';
import { BytecodeManager } from './GetBytecode.js';
import { FastBigIntMap } from './FastMap.js';
import { AddressStack } from './AddressStack';
import { clearTimeout } from 'node:timers';

export class ContractRuntime extends Logger {
    public readonly logColor: string = '#39b2f3';

    // internal states
    public gasUsed: bigint = 0n;
    public memoryPagesUsed: bigint = 0n;
    public loadedPointers: bigint = 0n;
    public storedPointers: bigint = 0n;

    // global states
    public address: Address;
    public readonly deployer: Address;

    protected states: FastBigIntMap = new FastBigIntMap();
    protected deploymentStates: FastBigIntMap = new FastBigIntMap();
    protected shouldPreserveState: boolean = true;

    // internal states
    protected events: NetEvent[] = [];

    // global states
    protected readonly gasMax: bigint = 100_000_000_000_000n;
    protected readonly deployedContracts: AddressMap<Buffer> = new AddressMap<Buffer>();
    protected readonly abiCoder = new ABICoder();

    // internal states
    private callStack: AddressStack = new AddressStack();
    private touchedAddresses: AddressSet = new AddressSet();
    private touchedBlocks: Set<bigint> = new Set();
    private statesBackup: FastBigIntMap = new FastBigIntMap();
    private totalEventLength: number = 0;

    private disposeTimeout: NodeJS.Timeout | undefined;

    // global states
    private readonly potentialBytecode?: Buffer;
    private readonly deploymentCalldata?: Buffer;

    // debug
    private readonly isDebugMode = true;

    protected constructor(details: ContractDetails) {
        super();

        this.deployer = details.deployer;
        this.address = details.address;

        this.potentialBytecode = details.bytecode;
        this.deploymentCalldata = details.deploymentCalldata;
        this.memoryPagesUsed = details.memoryPagesUsed || 0n;

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

    public applyStatesOverride(override: StateOverride): void {
        this.events = override.events;
        this.callStack = override.callStack;
        this.touchedAddresses = override.touchedAddresses;
        this.touchedBlocks = override.touchedBlocks;
        this.totalEventLength = override.totalEventLength;
        this.loadedPointers = override.loadedPointers;
        this.storedPointers = override.storedPointers;
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
        this.touchedAddresses.clear();
        this.touchedBlocks.clear();
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
        memoryPagesUsed: bigint,
    ): Promise<CallResponse> {
        const reader = new BinaryReader(data);
        const selector: number = reader.readSelector();

        if (Blockchain.traceCalls) {
            this.log(
                `Called externally by another contract. Selector: ${selector.toString(16)}`, //- Calldata: ${calldata.toString('hex')}
            );
        }

        const response: CallResponse = await this.executeCall(
            data as Buffer,
            sender,
            from,
            gasUsed,
            memoryPagesUsed,
        );

        if (Blockchain.traceCalls) {
            this.log(`Call response: ${response.response}`);
        }

        return response;
    }

    public dispose(): void {
        if (this._contract) {
            this._contract.dispose();

            clearTimeout(this.disposeTimeout);

            this.disposeTimeout = undefined;
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

        // Restore states
        if (error || response?.status !== 0) {
            this.states = statesBackup;
        }

        // Fatal error in rust or js
        if (response == null) {
            throw error;
        }

        this.deploymentStates = new FastBigIntMap(this.states);

        this.dispose();
    }

    public getDeploymentStates(): FastBigIntMap {
        return this.deploymentStates;
    }

    protected resetInternalStates(): void {
        this.gasUsed = 0n;

        this.loadedPointers = 0n;
        this.storedPointers = 0n;
        this.totalEventLength = 0;

        this.events = [];
        this.callStack = new AddressStack();
        this.callStack.push(this.address);

        this.touchedAddresses = new AddressSet([this.address]);
        this.touchedBlocks = new Set([Blockchain.blockNumber]);
    }

    protected async execute(
        calldata: Buffer | Uint8Array,
        sender?: Address,
        txOrigin?: Address,
        gasUsed?: bigint,
    ): Promise<CallResponse> {
        this.resetInternalStates();

        return await this.executeCall(calldata, sender, txOrigin, gasUsed);
    }

    protected async executeCall(
        calldata: Buffer | Uint8Array,
        sender?: Address,
        txOrigin?: Address,
        gasUsed?: bigint,
        memoryPagesUsed: bigint = 0n,
    ): Promise<CallResponse> {
        // Deploy if not deployed.
        await this.deployContract();

        this.gasUsed = gasUsed || 0n;
        this.memoryPagesUsed = memoryPagesUsed;

        this.loadContract();
        this.setEnvironment(sender, txOrigin);

        const statesBackup = new FastBigIntMap(this.states);

        let error: Error | undefined;
        const response = await this.contract.execute(calldata).catch(async (e: unknown) => {
            error = (await e) as Error;

            return undefined;
        });

        this.dispose();

        // Restore states
        if (error || response?.status !== 0) {
            this.states = statesBackup;
        }

        // Fatal error in rust
        if (response == null) {
            throw error;
        }

        this.gasUsed = response.gasUsed;

        if (CONSENSUS.TRANSACTIONS.MAXIMUM_RECEIPT_LENGTH < response.data.length) {
            throw new Error(
                `OPNET: MAXIMUM_RECEIPT_LENGTH EXCEEDED (${response.data.length} > ${CONSENSUS.TRANSACTIONS.MAXIMUM_RECEIPT_LENGTH})`,
            );
        }

        return new CallResponse({
            exitData: response,
            events: this.events,
            callStack: this.callStack,
            touchedAddresses: this.touchedAddresses,
            touchedBlocks: this.touchedBlocks,
        });
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

            if (this.disposeTimeout) {
                throw new Error('OPNET: Impossible state: Contract was never disposed.');
            }

            const params: ContractParameters = this.generateParams();

            this._contract = new RustContract(params);
            const id = this._contract.id;

            this.disposeTimeout = setTimeout(() => {
                this.warn(
                    `Contract #${id} (${this.address}) was never disposed. (memory leak detected)`,
                );
            }, 15_000);
        } catch (e) {
            if (this._contract) {
                try {
                    this._contract.dispose();
                } catch {}
            }

            this.warn(`Rust panicked during instantiation: ${e}`);

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

        if (Blockchain.traceDeployments) {
            const saltBig = BigInt(
                '0x' + salt.reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), ''),
            );

            this.log(
                `This contract wants to deploy the same bytecode as ${address}. Salt: ${salt.toString('hex')} or ${saltBig}`,
            );
        }

        // TODO: Add deployment stack like in opnet-node

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
        const isSlotWarm = value !== undefined;

        if (Blockchain.tracePointers) {
            this.log(`Attempting to load pointer ${pointer} - value ${value || 0n}`);
        }

        this.loadedPointers++;

        const response: BinaryWriter = new BinaryWriter();
        response.writeU256(value || 0n);
        response.writeBoolean(isSlotWarm);

        return response.getBuffer();
    }

    private store(data: Buffer): Buffer | Uint8Array {
        const reader = new BinaryReader(data);
        const pointer: bigint = reader.readU256();
        const value: bigint = reader.readU256();

        if (Blockchain.tracePointers) {
            this.log(`Attempting to store pointer ${pointer} - value ${value}`);
        }

        // Charge gas here.
        const isSlotWarm = this.states.has(pointer);

        // Just do this in rust??
        /*if (isSlotWarm) {
            this.gasUsed += UPDATED_STORAGE_SLOT_GAS_COST;
        } else {
            this.gasUsed += NEW_STORAGE_SLOT_GAS_COST;
        }*/

        this.states.set(pointer, value);
        this.storedPointers++;

        const response: BinaryWriter = new BinaryWriter();
        response.writeBoolean(isSlotWarm);

        return response.getBuffer();
    }

    private checkReentrancy(): void {
        if (!CONSENSUS.TRANSACTIONS.REENTRANCY_GUARD) {
            return;
        }

        if (this.callStack.includes(this.address)) {
            throw new Error('OPNET: REENTRANCY DETECTED');
        }
    }

    private async call(data: Buffer): Promise<Buffer | Uint8Array> {
        if (!this._contract) {
            throw new Error('Contract not initialized');
        }

        try {
            const reader = new BinaryReader(data);
            const gasUsed: bigint = reader.readU64();
            const memoryPagesUsed: bigint = BigInt(reader.readU32());
            const contractAddress: Address = reader.readAddress();
            const calldata: Uint8Array = reader.readBytesWithLength();

            if (Blockchain.traceCalls) {
                this.info(
                    `Attempting to call contract ${contractAddress.p2tr(Blockchain.network)}`,
                );
            }

            const contract: ContractRuntime = Blockchain.getContract(contractAddress);
            const isAddressWarm = this.touchedAddresses.has(contractAddress);

            this.callStack.push(contractAddress);
            this.touchedAddresses.add(contractAddress);

            if (this.verifyCallStackDepth()) {
                throw new Error(`OPNET: CALL_STACK DEPTH EXCEEDED`);
            }

            const ca = new ContractRuntime({
                address: contractAddress,
                deployer: contract.deployer,
                bytecode: contract.bytecode,
                gasLimit: contract.gasMax,
                gasUsed: gasUsed,
                memoryPagesUsed: memoryPagesUsed,
            });

            ca.preserveState();
            ca.setStates(contract.getStates());

            await ca.init();

            const states: StateOverride = {
                events: this.events,
                callStack: this.callStack,
                touchedAddresses: this.touchedAddresses,
                touchedBlocks: this.touchedBlocks,
                totalEventLength: this.totalEventLength,
                storedPointers: this.storedPointers,
                loadedPointers: this.loadedPointers,
            };

            // Apply states override
            ca.applyStatesOverride(states);

            const callResponse: CallResponse = await ca.onCall(
                calldata,
                this.address,
                Blockchain.txOrigin,
                gasUsed,
                memoryPagesUsed,
            );

            contract.setStates(ca.getStates());

            try {
                ca.delete();
            } catch {}

            this.mergeStates(ca);
            this.checkReentrancy();

            return this.buildCallResponse(
                isAddressWarm,
                callResponse.usedGas,
                callResponse.status as 0 | 1,
                callResponse.response,
            );
        } catch (e) {
            return this.buildCallResponse(false, 0n, 1, this.getErrorAsBuffer(e as Error));
        }
    }

    private mergeStates(states: ContractRuntime): void {
        this.events = states.events;
        this.callStack = states.callStack;

        this.touchedBlocks = states.touchedBlocks;
        this.touchedBlocks = states.touchedBlocks;
        this.totalEventLength = states.totalEventLength;

        this.loadedPointers = states.loadedPointers;
        this.storedPointers = states.storedPointers;
    }

    private buildCallResponse(
        isAddressWarm: boolean,
        usedGas: bigint,
        status: 0 | 1,
        response: Uint8Array,
    ): Uint8Array {
        const writer = new BinaryWriter();
        writer.writeBoolean(isAddressWarm);
        writer.writeU64(usedGas);
        writer.writeU32(status);
        writer.writeBytes(response);

        return writer.getBuffer();
    }

    private verifyCallStackDepth(): boolean {
        return this.callStack.length > CONSENSUS.TRANSACTIONS.MAXIMUM_CALL_DEPTH;
    }

    private getErrorAsBuffer(error: Error | string | undefined): Uint8Array {
        const errorWriter = new BinaryWriter();
        errorWriter.writeSelector(0x63739d5c);
        errorWriter.writeStringWithLength(
            typeof error === 'string' ? error : error?.message || 'Unknown error',
        );

        return errorWriter.getBuffer();
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
        const eventNameLength = reader.readU16();
        if (CONSENSUS.TRANSACTIONS.EVENTS.MAXIMUM_EVENT_NAME_LENGTH < eventNameLength) {
            throw new Error('OPNET: MAXIMUM_EVENT_NAME_LENGTH EXCEEDED');
        }

        const eventName = reader.readString(eventNameLength);
        const eventByteLength = reader.readU32();
        if (CONSENSUS.TRANSACTIONS.EVENTS.MAXIMUM_EVENT_LENGTH < eventByteLength) {
            throw new Error('OPNET: MAXIMUM_EVENT_LENGTH EXCEEDED');
        }

        this.totalEventLength += eventByteLength;

        if (CONSENSUS.TRANSACTIONS.EVENTS.MAXIMUM_TOTAL_EVENT_LENGTH < this.totalEventLength) {
            throw new Error('OPNET: MAXIMUM_TOTAL_EVENT_LENGTH EXCEEDED');
        }

        const eventData = reader.readBytes(eventByteLength);
        const event = new NetEvent(eventName, eventData);
        this.events.push(event);
    }

    private onInputsRequested(): Promise<Buffer> {
        const tx = Blockchain.transaction;

        if (!tx) {
            return Promise.resolve(Buffer.alloc(1));
        } else {
            if (CONSENSUS.TRANSACTIONS.MAXIMUM_INPUTS < tx.inputs.length) {
                throw new Error('OPNET: MAXIMUM_INPUTS EXCEEDED');
            }

            return Promise.resolve(Buffer.from(tx.serializeInputs()));
        }
    }

    private onOutputsRequested(): Promise<Buffer> {
        const tx = Blockchain.transaction;

        if (!tx) {
            return Promise.resolve(Buffer.alloc(1));
        } else {
            if (CONSENSUS.TRANSACTIONS.MAXIMUM_OUTPUTS < tx.outputs.length) {
                throw new Error(
                    `OPNET: MAXIMUM_OUTPUTS EXCEEDED ${CONSENSUS.TRANSACTIONS.MAXIMUM_OUTPUTS} < ${tx.outputs.length}`,
                );
            }

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
            memoryPagesUsed: this.memoryPagesUsed,
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

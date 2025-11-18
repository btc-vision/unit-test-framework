import bitcoin from '@btc-vision/bitcoin';
import { Logger } from '@btc-vision/logger';
import {
    AccountTypeResponse,
    BitcoinNetworkRequest,
    BlockHashResponse,
    EnvironmentVariablesRequest,
    ExitDataResponse,
    NEW_STORAGE_SLOT_GAS_COST,
    UPDATED_STORAGE_SLOT_GAS_COST,
} from '@btc-vision/op-vm';

import {
    ABICoder,
    Address,
    AddressMap,
    AddressSet,
    BinaryReader,
    BinaryWriter,
    NetEvent,
} from '@btc-vision/transaction';
import crypto from 'crypto';
import { Blockchain } from '../../blockchain/Blockchain.js';
import { CONSENSUS } from '../../contracts/configs.js';
import { CallResponse } from '../interfaces/CallResponse.js';
import { ContractDetails, StateOverride } from '../interfaces/ContractDetails.js';
import { ExecutionParameters } from '../interfaces/ExecuteParameters.js';
import { ContractParameters, RustContract } from '../vm/RustContract.js';
import { StateHandler } from '../vm/StateHandler.js';
import { FastBigIntMap } from './FastMap.js';
import { BytecodeManager } from './GetBytecode.js';
import { MLDSAMetadata } from '../../mldsa/MLDSAMetadata.js';
import { ConsensusManager } from '../../consensus/ConsensusManager.js';
import { AddressStack } from './AddressStack.js';

const PROTOCOL_ID: Uint8Array = Uint8Array.from(
    Buffer.from(
        'e784995a412d773988c4b8e333d7b39dfb3cabf118d0d645411a916ca2407939', // sha256("OP_NET")
        'hex',
    ),
);

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
    protected transient: FastBigIntMap = new FastBigIntMap();
    protected states: FastBigIntMap = new FastBigIntMap();
    protected deploymentStates: FastBigIntMap = new FastBigIntMap();

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

    // global states
    private readonly potentialBytecode?: Buffer;
    private readonly deploymentCalldata?: Buffer;

    private logUnexpectedErrors: boolean = true;

    // debug
    private readonly isDebugMode = true;
    private readonly proofFeatureEnabled = false;

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

    private get p2opAddress(): string {
        return this.address.p2op(Blockchain.network);
    }

    public applyStatesOverride(override: StateOverride): void {
        this.events = override.events;
        this.callStack = override.callStack;
        this.touchedAddresses = override.touchedAddresses;
        this.touchedBlocks = override.touchedBlocks;
        this.totalEventLength = override.totalEventLength;
        this.loadedPointers = override.loadedPointers;
        this.storedPointers = override.storedPointers;
        this.memoryPagesUsed = override.memoryPagesUsed;
    }

    public delete(): void {
        this.dispose();

        delete this._contract;
        delete this._bytecode;

        this.statesBackup.clear();
        this.events = [];

        this.callStack.clear();
        this.touchedAddresses.clear();
        this.touchedBlocks.clear();
        this.deployedContracts.clear();
    }

    public resetStates(): Promise<void> | void {
        StateHandler.resetGlobalStates(this.address);
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
            chainId: this.getChainId(),
            protocolId: this.getProtocolId(),
            originTweakedPublicKey: txOrigin.tweakedPublicKeyToBuffer(),
            consensusFlags: ConsensusManager.getFlags(),
        };

        this.contract.setEnvironment(params);
    }

    public backupStates(): void {
        this.statesBackup = new FastBigIntMap(StateHandler.getTemporaryStates(this.address));
    }

    public restoreStates(): void {
        StateHandler.setTemporaryStates(this.address, this.statesBackup);
    }

    public async onCall(executionParameters: ExecutionParameters): Promise<CallResponse> {
        try {
            if (Blockchain.traceCalls) {
                const reader = new BinaryReader(executionParameters.calldata);
                const selector: number = reader.readSelector();

                this.log(
                    `Called externally by another contract. Selector: ${selector.toString(16)}`,
                );
            }

            const response: CallResponse = await this.executeCall(executionParameters);
            if (Blockchain.traceCalls) {
                this.log(`Call response: ${response.response}`);
            }

            return response;
        } catch (e) {
            if (this.logUnexpectedErrors) {
                this.warn(
                    `(debug on call ${BytecodeManager.getFileName(this.address)}) call failed with error: ${(e as Error).message}`,
                );
            }

            const newResponse = this.handleError(e as Error);

            return new CallResponse({
                memoryPagesUsed: this.memoryPagesUsed,
                exitData: {
                    status: 1,
                    gasUsed: this.getGasUsed(), // if we don't do gasMax here and the execution actually used some gas, the user is getting free gas on partial reverts, otherwise rust need to return the real used gas.
                    data: Buffer.from(this.getErrorAsBuffer(newResponse)),
                    proofs: [],
                },
                events: this.events,
                callStack: this.callStack,
                touchedAddresses: this.touchedAddresses,
                touchedBlocks: this.touchedBlocks,
            });
        } finally {
            this.dispose();
        }
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

    public async deployContract(pushStates: boolean = true): Promise<ExitDataResponse | undefined> {
        if (StateHandler.isDeployed(this.address)) {
            return;
        }

        try {
            this.loadContract();
            this.setEnvironment(this.deployer, this.deployer);

            const calldata = this.deploymentCalldata || Buffer.alloc(0);

            let error: Error | undefined;
            const response = await this.contract.onDeploy(calldata).catch((e: unknown) => {
                error = e as Error;
            });

            if (error) {
                this.warn(`Fatal error: ${error}`);
                throw error;
            }

            if (response?.status !== 0) {
                if (response) {
                    return response;
                } else {
                    throw new Error('OP_NET: Cannot deploy contract.');
                }
            }

            StateHandler.setPendingDeployments(this.address);

            // Mark as deployed
            if (pushStates) {
                StateHandler.pushAllTempStatesToGlobal();
            }

            this.gasUsed = response.gasUsed;

            return response;
        } catch (e) {
            const newResponse = this.handleError(e as Error);

            return {
                status: 1,
                gasUsed: this.gasUsed,
                data: Buffer.from(this.getErrorAsBuffer(newResponse)),
                proofs: [],
            };
        } finally {
            this.dispose();

            if (pushStates) {
                this.resetInternalStates();
            }
        }
    }

    public async execute(executionParameters: ExecutionParameters): Promise<CallResponse> {
        try {
            // Always make sure we don't have dirty states
            this.resetInternalStates();

            const response = await this.executeCall(executionParameters);
            if (response.status === 0 && !response.error) {
                // Only save states if the execution was successful and the user allow it
                if (executionParameters.saveStates !== false) {
                    this.gasUsed = this.calculateGasCostSave(response);

                    StateHandler.pushAllTempStatesToGlobal();
                }
            }

            // Reset internal states
            this.resetInternalStates();

            return response;
        } finally {
            this.dispose();
        }
    }

    protected resetInternalStates(): void {
        this.gasUsed = 0n;
        this.memoryPagesUsed = 0n;

        StateHandler.resetPendingDeployments();
        StateHandler.clearTemporaryStates(this.address);

        this.loadedPointers = 0n;
        this.storedPointers = 0n;
        this.totalEventLength = 0;

        this.events = [];
        this.callStack = new AddressStack();
        this.callStack.push(this.address);

        this.touchedAddresses = new AddressSet([this.address]);
        this.touchedBlocks = new Set([Blockchain.blockNumber]);
    }

    protected async executeCall(executionParameters: ExecutionParameters): Promise<CallResponse> {
        // Deploy if not deployed.
        const deployment = await this.deployContract(false);
        if (deployment) {
            this.gasUsed = 0n; // reset.
            this.memoryPagesUsed = 0n;

            if (deployment.status !== 0) {
                if (this.logUnexpectedErrors) {
                    this.warn(`Unexpected error during deployment.`);
                }

                throw RustContract.decodeRevertData(deployment.data);
            }
        }

        this.gasUsed = executionParameters.gasUsed || 0n;
        this.memoryPagesUsed = executionParameters.memoryPagesUsed || 0n;

        // Backup states
        this.backupStates();

        this.loadContract();
        this.setEnvironment(executionParameters.sender, executionParameters.txOrigin);

        let error: Error | undefined;
        const response = await this.contract
            .execute(executionParameters.calldata)
            .catch(async (e: unknown) => {
                error = (await e) as Error;

                return undefined;
            });

        // Restore states
        if (error || response?.status !== 0) {
            this.restoreStates();

            this.gasUsed = response?.gasUsed || this.getGasUsed();
        } else {
            const gasUsed = this.getGasUsed();
            if (response.gasUsed !== gasUsed) {
                throw new Error(`OP_NET: gas used mismatch ${response.gasUsed} != ${gasUsed}`);
            }

            this.gasUsed = response.gasUsed;
        }

        // Fatal error in rust
        if (response == null) {
            throw error;
        }

        if (CONSENSUS.TRANSACTIONS.MAXIMUM_RECEIPT_LENGTH < response.data.length) {
            throw new Error(
                `OP_NET: Maximum receipt length exceeded. (${response.data.length} > ${CONSENSUS.TRANSACTIONS.MAXIMUM_RECEIPT_LENGTH})`,
            );
        }

        return new CallResponse({
            memoryPagesUsed: this.memoryPagesUsed,
            exitData: {
                ...response,
                gasUsed: this.gasUsed,
            },
            events: this.events,
            callStack: this.callStack,
            touchedAddresses: this.touchedAddresses,
            touchedBlocks: this.touchedBlocks,
        });
    }

    protected calculateGasCostSave(response: CallResponse): bigint {
        if (response.usedGas !== this.gasUsed) {
            throw new Error('OP_NET: gas used mismatch');
        }

        let cost: bigint = 0n;
        for (const contract of this.callStack) {
            const states = StateHandler.getTemporaryStates(contract);

            for (const [key, value] of states) {
                const currentValue = StateHandler.globalLoad(contract, key);

                if (currentValue === undefined) {
                    cost += NEW_STORAGE_SLOT_GAS_COST;
                } else if (currentValue !== value) {
                    cost += UPDATED_STORAGE_SLOT_GAS_COST;
                }

                if (this.gasMax < this.gasUsed + cost) {
                    throw new Error('out of gas while saving state');
                }
            }
        }

        response.usedGas = this.gasUsed + cost;

        return response.usedGas;
    }

    protected handleError(error: Error): Error {
        return new Error(`(in: ${this.constructor.name}) OP_NET: ${error}`);
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
            this._contract = new RustContract(this.generateParams());
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

    /**
     * Calls `this.execute()` with the provided arguments, returning the
     * resulting `response` if the call is successful, throwing otherwise.
     *
     * @throws if contract execution reverts
     *
     * @returns Promise<CallResponse> the buffer returned by the contract
     */
    protected async executeThrowOnError(
        executionParameters: ExecutionParameters,
    ): Promise<CallResponse> {
        const result = await this.execute(executionParameters);
        if (result.error) {
            const errorMessage = result.error ? result.error.message : 'Unknown error occurred';
            throw new Error(errorMessage);
        }

        return result;
    }

    private getGasUsed(): bigint {
        try {
            if (this._contract) {
                return this._contract.getUsedGas();
            } else {
                return this.gasMax;
            }
        } catch {
            return this.gasMax;
        }
    }

    private async deployContractAtAddress(data: Buffer): Promise<Buffer | Uint8Array> {
        try {
            const reader = new BinaryReader(data);
            this.gasUsed = reader.readU64();

            const address: Address = reader.readAddress();
            const salt: Buffer = Buffer.from(reader.readBytes(32));
            const calldata: Buffer = Buffer.from(reader.readBytes(reader.bytesLeft() | 0));

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

            const gasBefore = this.gasUsed;
            const requestedContractBytecode = BytecodeManager.getBytecode(address) as Buffer;
            const newContract: ContractRuntime = new ContractRuntime({
                address: deployedContractAddress,
                deployer: this.address,
                gasLimit: this.gasMax,
                gasUsed: this.gasUsed,
                bytecode: requestedContractBytecode,
                deploymentCalldata: calldata,
            });

            if (Blockchain.traceDeployments) {
                this.info(
                    `Deploying contract at ${deployedContractAddress.p2op(Blockchain.network)}`,
                );
            }

            Blockchain.register(newContract);
            await newContract.init();

            if (Blockchain.traceDeployments) {
                this.log(
                    `Deployed contract at ${deployedContractAddress.p2op(Blockchain.network)}`,
                );
            }

            const states: StateOverride = {
                events: this.events,
                callStack: this.callStack,
                touchedAddresses: this.touchedAddresses,
                touchedBlocks: this.touchedBlocks,
                totalEventLength: this.totalEventLength,
                storedPointers: this.storedPointers,
                loadedPointers: this.loadedPointers,
                memoryPagesUsed: this.memoryPagesUsed,
            };

            // Apply states override
            newContract.applyStatesOverride(states);

            const deployResponse = await newContract.deployContract(false);
            if (deployResponse === undefined) {
                Blockchain.unregister(newContract);

                throw new Error('OP_NET: Contract already deployed.');
            }

            this.deployedContracts.set(deployedContractAddress, this.bytecode);

            this.mergeStates(newContract);
            this.checkReentrancy();

            const used = deployResponse.gasUsed - gasBefore;
            this.gasUsed = deployResponse.gasUsed;

            return this.buildDeployFromAddressResponse(
                deployedContractAddress,
                requestedContractBytecode.byteLength,
                used,
                deployResponse.status as 0 | 1,
                deployResponse.data,
            );
        } catch (e) {
            if (this.logUnexpectedErrors) {
                this.warn(
                    `(debug) deployContractAtAddress failed with error: ${(e as Error).message}`,
                );
            }

            return this.buildDeployFromAddressResponse(
                Address.dead(),
                0,
                this.gasUsed,
                1,
                this.getErrorAsBuffer(e as Error),
            );
        }
    }

    private buildDeployFromAddressResponse(
        contractAddress: Address,
        bytecodeLength: number,
        usedGas: bigint,
        status: 0 | 1,
        response: Uint8Array,
    ): Uint8Array {
        const writer = new BinaryWriter();
        writer.writeAddress(contractAddress);
        writer.writeU32(bytecodeLength);
        writer.writeU64(usedGas);
        writer.writeU32(status);
        writer.writeBytes(response);

        return writer.getBuffer();
    }

    private loadMLDSA(data: Buffer): Buffer | Uint8Array {
        const reader = new BinaryReader(data);
        const level = reader.readU8();
        const address = reader.readAddress();

        const publicKey = Blockchain.getMLDSAPublicKey(address);
        const mldsaPublicKeyLength = MLDSAMetadata.fromLevel(level) as number;
        const response = new BinaryWriter();

        let found: boolean = !!publicKey;
        if (publicKey && publicKey.length !== mldsaPublicKeyLength) {
            found = false;
        }

        if (found && publicKey) {
            response.writeBoolean(true);
            response.writeBytes(publicKey);
        } else {
            response.writeBoolean(false);
        }

        return response.getBuffer();
    }

    private load(data: Buffer): Buffer | Uint8Array {
        const reader = new BinaryReader(data);
        const pointer: bigint = reader.readU256();

        let value: bigint | undefined = StateHandler.getTemporaryStates(this.address).get(pointer);
        if (value === undefined) {
            value = StateHandler.globalLoad(this.address, pointer);
        }

        if (Blockchain.tracePointers) {
            this.log(`Attempting to load pointer ${pointer} - value ${value || 0n}`);
        }

        this.loadedPointers++;

        const isSlotWarm = value !== undefined;
        const response: BinaryWriter = new BinaryWriter();
        response.writeU256(value || 0n);
        response.writeBoolean(isSlotWarm);

        return response.getBuffer();
    }

    private tLoad(data: Buffer): Buffer | Uint8Array {
        const reader = new BinaryReader(data);
        const pointer = reader.readU256();
        const value = this.transient.get(pointer);

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

        const tempStates = StateHandler.getTemporaryStates(this.address);

        // Charge gas here.
        const isSlotWarm: boolean =
            tempStates.has(pointer) || StateHandler.globalHas(this.address, pointer);

        tempStates.set(pointer, value);
        this.storedPointers++;

        const response: BinaryWriter = new BinaryWriter();
        response.writeBoolean(isSlotWarm);

        return response.getBuffer();
    }

    private tStore(data: Buffer): Buffer | Uint8Array {
        const reader = new BinaryReader(data);
        const pointer: bigint = reader.readU256();
        const value: bigint = reader.readU256();

        this.transient.set(pointer, value);

        const response: BinaryWriter = new BinaryWriter();
        response.writeBoolean(true);

        return response.getBuffer();
    }

    private checkReentrancy(): void {
        if (!CONSENSUS.TRANSACTIONS.REENTRANCY_GUARD) {
            return;
        }

        if (this.callStack && this.callStack.includes(this.address)) {
            throw new Error('OP_NET: Reentrancy detected.');
        }
    }

    private async call(data: Buffer): Promise<Buffer | Uint8Array> {
        if (!this._contract) {
            throw new Error('Contract not initialized');
        }

        let gasUsed: bigint = this.gasUsed;
        try {
            const reader = new BinaryReader(data);

            // Update gas used
            gasUsed = reader.readU64();
            this.gasUsed = gasUsed;

            const memoryPagesUsed: bigint = BigInt(reader.readU32());
            const contractAddress: Address = reader.readAddress();
            const calldata: Uint8Array = reader.readBytesWithLength();

            if (Blockchain.traceCalls) {
                this.info(
                    `Attempting to call contract ${contractAddress.p2op(Blockchain.network)}`,
                );
            }

            this.memoryPagesUsed = memoryPagesUsed;
            this.callStack.push(contractAddress);
            this.touchedAddresses.add(contractAddress);

            if (this.verifyCallStackDepth()) {
                throw new Error(`OP_NET: Maximum call depth exceeded`);
            }

            const contract: ContractRuntime = Blockchain.getContract(contractAddress);
            const isAddressWarm = this.touchedAddresses.has(contractAddress);

            const ca = new ContractRuntime({
                address: contractAddress,
                deployer: contract.deployer,
                bytecode: contract.bytecode,
                gasLimit: contract.gasMax,
                gasUsed: gasUsed,
                memoryPagesUsed: memoryPagesUsed,
            });

            await ca.init();

            const states: StateOverride = {
                events: this.events,
                callStack: this.callStack,
                touchedAddresses: this.touchedAddresses,
                touchedBlocks: this.touchedBlocks,
                totalEventLength: this.totalEventLength,
                storedPointers: this.storedPointers,
                loadedPointers: this.loadedPointers,
                memoryPagesUsed: this.memoryPagesUsed,
            };

            // Apply states override
            ca.applyStatesOverride(states);

            const callResponse: CallResponse = await ca.onCall({
                calldata,
                sender: this.address,
                txOrigin: Blockchain.txOrigin,
                gasUsed,
                memoryPagesUsed,
            });

            this.memoryPagesUsed = callResponse.memoryPagesUsed;
            this.gasUsed = callResponse.usedGas;

            this.mergeStates(ca);

            try {
                ca.delete();
            } catch {}

            this.checkReentrancy();

            const gasDifference = this.gasUsed - gasUsed;
            return this.buildCallResponse(
                isAddressWarm,
                gasDifference,
                callResponse.status as 0 | 1,
                callResponse.response,
            );
        } catch (e) {
            if (this.logUnexpectedErrors) {
                this.warn(
                    `(debug ${BytecodeManager.getFileName(this.address)}) call failed with error: ${(e as Error).message}`,
                );
            }

            const difference = this.gasUsed - gasUsed;
            return this.buildCallResponse(false, difference, 1, new Uint8Array(0));
        }
    }

    private mergeStates(states: ContractRuntime): void {
        this.events = states.events;
        this.callStack = states.callStack;

        this.touchedBlocks = states.touchedBlocks;
        this.totalEventLength = states.totalEventLength;

        this.loadedPointers = states.loadedPointers;
        this.storedPointers = states.storedPointers;
        this.memoryPagesUsed = states.memoryPagesUsed;
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
        switch (Blockchain.network.bech32) {
            case bitcoin.networks.bitcoin.bech32:
                return BitcoinNetworkRequest.Mainnet;
            case bitcoin.networks.testnet.bech32:
                return BitcoinNetworkRequest.Testnet;
            case bitcoin.networks.regtest.bech32:
                return BitcoinNetworkRequest.Regtest;
            default:
                throw new Error('Unknown network');
        }
    }

    private getChainId(): Uint8Array {
        return Uint8Array.from(Buffer.from(this.getChainIdHex(), 'hex'));
    }

    private getChainIdHex(): string {
        switch (this.getNetwork()) {
            case BitcoinNetworkRequest.Mainnet:
                return '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
            case BitcoinNetworkRequest.Testnet:
                return '000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943';
            case BitcoinNetworkRequest.Regtest:
                return '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206';
            default:
                throw new Error('Unknown network');
        }
    }

    private getProtocolId(): Uint8Array {
        return PROTOCOL_ID;
    }

    private onEvent(data: Buffer): void {
        const reader = new BinaryReader(data);
        const eventNameLength = reader.readU32();
        if (CONSENSUS.TRANSACTIONS.EVENTS.MAXIMUM_EVENT_NAME_LENGTH < eventNameLength) {
            throw new Error('OP_NET: Maximum event type length exceeded.');
        }

        const eventName = reader.readString(eventNameLength);
        const eventByteLength = reader.readU32();
        if (CONSENSUS.TRANSACTIONS.EVENTS.MAXIMUM_EVENT_LENGTH < eventByteLength) {
            throw new Error('OP_NET: Maximum event length exceeded.');
        }

        this.totalEventLength += eventByteLength;

        if (CONSENSUS.TRANSACTIONS.EVENTS.MAXIMUM_TOTAL_EVENT_LENGTH < this.totalEventLength) {
            throw new Error('OP_NET: Maximum total event length exceeded.');
        }

        const eventData = reader.readBytes(eventByteLength);
        const event = new NetEvent(eventName, eventData);
        this.events.push(event);
    }

    private onInputsRequested(): Promise<Buffer> {
        const tx = Blockchain.transaction;

        if (!tx) {
            return Promise.resolve(Buffer.alloc(2));
        } else {
            if (CONSENSUS.VM.UTXOS.MAXIMUM_INPUTS < tx.inputs.length) {
                throw new Error('OP_NET: MAXIMUM_INPUTS EXCEEDED');
            }

            return Promise.resolve(Buffer.from(tx.serializeInputs()));
        }
    }

    private onOutputsRequested(): Promise<Buffer> {
        const tx = Blockchain.transaction;

        if (!tx) {
            return Promise.resolve(Buffer.alloc(2));
        } else {
            if (CONSENSUS.VM.UTXOS.MAXIMUM_OUTPUTS < tx.outputs.length) {
                throw new Error(
                    `OP_NET: MAXIMUM_OUTPUTS EXCEEDED ${CONSENSUS.VM.UTXOS.MAXIMUM_OUTPUTS} < ${tx.outputs.length}`,
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

    private getBlockHash(blockNumber: bigint): Promise<BlockHashResponse> {
        const isBlockWarm = this.touchedBlocks.has(blockNumber);
        if (!isBlockWarm) {
            this.touchedBlocks.add(blockNumber);
        }

        if (blockNumber > Blockchain.blockNumber) {
            return Promise.resolve({
                blockHash: Buffer.from([
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                    0, 0, 0, 0, 0,
                ]),
                isBlockWarm,
            });
        }

        const fakeBlockHash = crypto.createHash('sha256').update(blockNumber.toString()).digest();

        return Promise.resolve({
            blockHash: fakeBlockHash,
            isBlockWarm,
        });
    }

    private fakeLoad(): void {
        let i = 0;
        while (i < 5000000) {
            i++;
        }
    }

    private generateParams(): ContractParameters {
        return {
            address: this.p2opAddress,
            bytecode: this.bytecode,
            gasMax: this.gasMax,
            gasUsed: this.gasUsed,
            memoryPagesUsed: this.memoryPagesUsed,
            network: this.getNetwork(),
            isDebugMode: this.isDebugMode,
            returnProofs: this.proofFeatureEnabled,
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
            tLoad: (data: Buffer) => {
                return new Promise((resolve) => {
                    if (Blockchain.simulateRealEnvironment) {
                        this.fakeLoad();
                        resolve(this.tLoad(data));
                    } else {
                        resolve(this.tLoad(data));
                    }
                });
            },
            tStore: (data: Buffer) => {
                return new Promise((resolve) => {
                    if (Blockchain.simulateRealEnvironment) {
                        this.fakeLoad();
                        resolve(this.tStore(data));
                    } else {
                        resolve(this.tStore(data));
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
            loadMLDSA: (data: Buffer) => {
                return new Promise((resolve) => {
                    if (Blockchain.simulateRealEnvironment) {
                        this.fakeLoad();
                        resolve(this.loadMLDSA(data));
                    } else {
                        resolve(this.loadMLDSA(data));
                    }
                });
            },
        };
    }
}

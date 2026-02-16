import { BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { BytecodeManager, ContractRuntime } from '../../../../../src';
export class TestContractRuntime extends ContractRuntime {
    sha256Selector = this.getSelector('sha256(bytes)');
    verifySignatureSelector = this.getSelector('verifySignature(bytes)');
    verifySignatureSchnorrSelector = this.getSelector('verifySignatureSchnorr(bytes)');
    ripemd160Selector = this.getSelector('ripemd160(bytes)');
    storeSelector = this.getSelector('store(bytes32,bytes32)');
    loadSelector = this.getSelector('load(bytes32)');
    tStoreSelector = this.getSelector('tStore(bytes32,bytes32)');
    tLoadSelector = this.getSelector('tLoad(bytes32)');
    accountTypeSelector = this.getSelector('accountType(address)');
    blockHashSelector = this.getSelector('blockHash(uint64)');
    callThenGrowMemorySelector = this.getSelector('callThenGrowMemory(uint32)');
    growMemoryThenRecursiveCallSelector = this.getSelector('growMemoryThenRecursiveCall(uint32,uint32)');
    growMemorySelector = this.getSelector('growMemory(uint32)');
    recursiveCallSelector = this.getSelector('recursiveCall(uint32)');
    modifyStateThenCallFunctionModifyingStateThatRevertsSelector = this.getSelector('modifyStateThenCallFunctionModifyingStateThatReverts(bytes32,bytes32,bytes32)');
    modifyStateThenRevertSelector = this.getSelector('modifyStateThenRevert(bytes32,bytes32)');
    callThenModifyStateSelector = this.getSelector('callThenModifyState(bytes32,bytes32)');
    modifyStateSelector = this.getSelector('modifyState(bytes32,bytes32)');
    chainIdSelector = this.getSelector('chainId()');
    protocolIdSelector = this.getSelector('protocolId()');
    constructor(deployer, address, gasLimit = 150000000000n) {
        super({
            address: address,
            deployer: deployer,
            gasLimit,
        });
    }
    async sha256Call(value) {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.sha256Selector);
        calldata.writeBytesWithLength(value);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }
    async verifySignature(value, sender, origin) {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.verifySignatureSelector);
        calldata.writeBytesWithLength(value);
        const response = await this.execute({
            calldata: calldata.getBuffer(),
            sender: sender,
            txOrigin: origin,
        });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return {
            result: reader.readBoolean(),
            gas: response.usedGas,
        };
    }
    async verifySignatureSchnorr(value, sender, origin) {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.verifySignatureSchnorrSelector);
        calldata.writeBytesWithLength(value);
        const response = await this.execute({
            calldata: calldata.getBuffer(),
            sender: sender,
            txOrigin: origin,
        });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return {
            result: reader.readBoolean(),
            gas: response.usedGas,
        };
    }
    async ripemd160Call(value) {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.ripemd160Selector);
        calldata.writeBytesWithLength(value);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBytes(20);
    }
    async storeCall(key, value) {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.storeSelector);
        calldata.writeBytes(key);
        calldata.writeBytes(value);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        return value;
    }
    async loadCall(key) {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.loadSelector);
        calldata.writeBytes(key);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }
    async tStoreCall(key, value) {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.tStoreSelector);
        calldata.writeBytes(key);
        calldata.writeBytes(value);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        return value;
    }
    async tLoadCall(key) {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.tLoadSelector);
        calldata.writeBytes(key);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }
    async accountTypeCall(address) {
        const calldata = new BinaryWriter(36);
        calldata.writeSelector(this.accountTypeSelector);
        calldata.writeAddress(address);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readU32();
    }
    async blockHashCall(blockId) {
        const calldata = new BinaryWriter(12);
        calldata.writeSelector(this.blockHashSelector);
        calldata.writeU64(blockId);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }
    async callThenGrowMemory(pages) {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.callThenGrowMemorySelector);
        calldata.writeU32(pages);
        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBoolean();
    }
    async growMemoryThenRecursiveCall(pages, numberOfCalls) {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.growMemoryThenRecursiveCallSelector);
        calldata.writeU32(pages);
        calldata.writeU32(numberOfCalls);
        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });
        this.handleResponse(response);
    }
    async growMemory(pages) {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.growMemorySelector);
        calldata.writeU32(pages);
        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBoolean();
    }
    async recursiveCall(numberOfCalls) {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.recursiveCallSelector);
        calldata.writeU32(numberOfCalls);
        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });
        this.handleResponse(response);
    }
    async modifyStateThenCallFunctionModifyingStateThatReverts(storageKey, firstStorageValue, secondStorageValue) {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.modifyStateThenCallFunctionModifyingStateThatRevertsSelector);
        calldata.writeBytes(storageKey);
        calldata.writeBytes(firstStorageValue);
        calldata.writeBytes(secondStorageValue);
        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }
    async modifyStateThenRevert(storageKey, storageValue) {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.modifyStateThenRevertSelector);
        calldata.writeBytes(storageKey);
        calldata.writeBytes(storageValue);
        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });
        this.handleResponse(response);
    }
    async callThenModifyState(storageKey, storageValue) {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.callThenModifyStateSelector);
        calldata.writeBytes(storageKey);
        calldata.writeBytes(storageValue);
        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }
    async modifyState(storageKey, storageValue) {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.modifyStateSelector);
        calldata.writeBytes(storageKey);
        calldata.writeBytes(storageValue);
        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });
        this.handleResponse(response);
    }
    async chainId() {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.chainIdSelector);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }
    async protocolId() {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.protocolIdSelector);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }
    handleError(error) {
        return new Error(`(in test contract: ${this.address}) OP_NET: ${error.message}`);
    }
    defineRequiredBytecodes() {
        BytecodeManager.loadBytecode('./test/e2e/contracts/test-contract/contract/build/TestContract.wasm', this.address);
    }
    getSelector(signature) {
        return Number(`0x${this.abiCoder.encodeSelector(signature)}`);
    }
    handleResponse(response) {
        if (response.error)
            throw this.handleError(response.error);
        if (!response.response) {
            throw new Error('No response to decode');
        }
    }
}

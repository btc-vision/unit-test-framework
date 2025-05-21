import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { BytecodeManager, CallResponse, ContractRuntime } from '../../../../../src';

export class TestContractRuntime extends ContractRuntime {
    private readonly sha256Selector: number = this.getSelector('sha256(bytes)');
    private readonly ripemd160Selector: number = this.getSelector('ripemd160(bytes)');
    private readonly storeSelector: number = this.getSelector('store(bytes32,bytes32)');
    private readonly loadSelector: number = this.getSelector('load(bytes32)');
    private readonly tStoreSelector: number = this.getSelector('tStore(bytes32,bytes32)');
    private readonly tLoadSelector: number = this.getSelector('tLoad(bytes32)');
    private readonly accountTypeSelector: number = this.getSelector('accountType(address)');
    private readonly blockHashSelector: number = this.getSelector('blockHash(uint64)');
    private readonly callThenGrowMemorySelector: number = this.getSelector(
        'callThenGrowMemory(uint32)',
    );
    private readonly growMemoryThenRecursiveCallSelector: number = this.getSelector(
        'growMemoryThenRecursiveCall(uint32,uint32)',
    );
    private readonly growMemorySelector: number = this.getSelector('growMemory(uint32)');
    private readonly recursiveCallSelector: number = this.getSelector('recursiveCall(uint32)');
    private readonly modifyStateThenCallFunctionModifyingStateThatRevertsSelector: number =
        this.getSelector(
            'modifyStateThenCallFunctionModifyingStateThatReverts(bytes32,bytes32,bytes32)',
        );
    private readonly modifyStateThenRevertSelector: number = this.getSelector(
        'modifyStateThenRevert(bytes32,bytes32)',
    );
    private readonly callThenModifyStateSelector: number = this.getSelector(
        'callThenModifyState(bytes32,bytes32)',
    );
    private readonly modifyStateSelector: number = this.getSelector('modifyState(bytes32,bytes32)');

    public constructor(
        deployer: Address,
        address: Address,
        gasLimit: bigint = 100_000_000_000_000_000n,
    ) {
        super({
            address: address,
            deployer: deployer,
            gasLimit,
        });
    }

    public async sha256Call(value: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.sha256Selector);
        calldata.writeBytesWithLength(value);

        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }

    public async ripemd160Call(value: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.ripemd160Selector);
        calldata.writeBytesWithLength(value);

        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return reader.readBytes(20);
    }

    public async storeCall(key: Uint8Array, value: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.storeSelector);
        calldata.writeBytes(key);
        calldata.writeBytes(value);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        return value;
    }

    public async loadCall(key: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.loadSelector);
        calldata.writeBytes(key);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }

    public async tStoreCall(key: Uint8Array, value: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.tStoreSelector);
        calldata.writeBytes(key);
        calldata.writeBytes(value);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        return value;
    }

    public async tLoadCall(key: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.tLoadSelector);
        calldata.writeBytes(key);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }

    public async accountTypeCall(address: Address): Promise<number> {
        const calldata = new BinaryWriter(36);
        calldata.writeSelector(this.accountTypeSelector);
        calldata.writeAddress(address);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return reader.readU32();
    }

    public async blockHashCall(blockId: bigint): Promise<Uint8Array> {
        const calldata = new BinaryWriter(12);
        calldata.writeSelector(this.blockHashSelector);
        calldata.writeU64(blockId);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }

    public async callThenGrowMemory(pages: number): Promise<boolean> {
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

    public async growMemoryThenRecursiveCall(pages: number, numberOfCalls: number): Promise<void> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.growMemoryThenRecursiveCallSelector);
        calldata.writeU32(pages);
        calldata.writeU32(numberOfCalls);

        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });

        this.handleResponse(response);
    }

    public async growMemory(pages: number): Promise<boolean> {
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

    public async recursiveCall(numberOfCalls: number): Promise<void> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.recursiveCallSelector);
        calldata.writeU32(numberOfCalls);

        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });
        this.handleResponse(response);
    }

    public async modifyStateThenCallFunctionModifyingStateThatReverts(
        storageKey: Uint8Array,
        firstStorageValue: Uint8Array,
        secondStorageValue: Uint8Array,
    ): Promise<Uint8Array> {
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

    public async modifyStateThenRevert(
        storageKey: Uint8Array,
        storageValue: Uint8Array,
    ): Promise<void> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.modifyStateThenRevertSelector);
        calldata.writeBytes(storageKey);
        calldata.writeBytes(storageValue);

        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });
        this.handleResponse(response);
    }

    public async callThenModifyState(
        storageKey: Uint8Array,
        storageValue: Uint8Array,
    ): Promise<Uint8Array> {
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

    public async modifyState(storageKey: Uint8Array, storageValue: Uint8Array): Promise<void> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.modifyStateSelector);
        calldata.writeBytes(storageKey);
        calldata.writeBytes(storageValue);

        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });
        this.handleResponse(response);
    }

    protected handleError(error: Error): Error {
        return new Error(`(in test contract: ${this.address}) OP_NET: ${error.message}`);
    }

    protected defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode(
            './test/e2e/contracts/test-contract/contract/build/TestContract.wasm',
            this.address,
        );
    }

    private getSelector(signature: string): number {
        return Number(`0x${this.abiCoder.encodeSelector(signature)}`);
    }

    private handleResponse(response: CallResponse): void {
        if (response.error) throw this.handleError(response.error);
        if (!response.response) {
            throw new Error('No response to decode');
        }
    }
}

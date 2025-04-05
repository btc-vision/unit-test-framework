import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { BytecodeManager, CallResponse, ContractRuntime } from '../../../../src';

export class TestContractRuntime extends ContractRuntime {
    private readonly sha256Selector: number = this.getSelector('sha256(bytes)');

    public constructor(deployer: Address, address: Address, gasLimit: bigint = 350_000_000_000n) {
        super({
            address: address,
            deployer: deployer,
            gasLimit,
        });

        this.preserveState();
    }

    public async sha256(value: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.sha256Selector);
        calldata.writeBytesWithLength(value);

        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }

    public async callThenGrowMemory(pages: number): Promise<boolean> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.getSelector('callThenGrowMemory(uint32)'));
        calldata.writeU32(pages);

        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return reader.readBoolean();
    }

    public async growMemoryThenRecursiveCall(pages: number, numberOfCalls: number): Promise<void> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.getSelector('growMemoryThenRecursiveCall(uint32,uint32)'));
        calldata.writeU32(pages);
        calldata.writeU32(numberOfCalls);

        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);
    }

    public async growMemory(pages: number): Promise<boolean> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.getSelector('growMemory(uint32)'));
        calldata.writeU32(pages);

        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return reader.readBoolean();
    }

    public async recursiveCall(numberOfCalls: number): Promise<void> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.getSelector('recursiveCall(uint32)'));
        calldata.writeU32(numberOfCalls);

        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);
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

    protected handleError(error: Error): Error {
        return new Error(`(in test contract: ${this.address}) OPNET: ${error.message}`);
    }

    protected defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode(
            './test/e2e/test-contract/contract/build/TestContract.wasm',
            this.address,
        );
    }
}

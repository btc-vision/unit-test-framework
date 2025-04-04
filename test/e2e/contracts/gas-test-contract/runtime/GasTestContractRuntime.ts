import { Address, BinaryWriter, BinaryReader } from '@btc-vision/transaction';
import { BytecodeManager, CallResponse, ContractRuntime } from '../../../../../src';

/*
=======
import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { BytecodeManager, CallResponse, ContractRuntime } from '../../../../src';

export class TestContractRuntime extends ContractRuntime {

>>>>>>> 7f1302f (WIP - RuntimeError: Missing field blockHash):test/e2e/test-contract/runtime/TestContractRuntime.ts
*/

export class GasTestContractRuntime extends ContractRuntime {
    private readonly sha256Selector: number = this.getSelector('sha256(bytes)');
    private readonly ripemd160Selector: number = this.getSelector('ripemd160(bytes)');
    private readonly storeSelector: number = this.getSelector('store(bytes32,bytes32)');
    private readonly loadSelector: number = this.getSelector('load(bytes32)');
    private readonly tStoreSelector: number = this.getSelector('tStore(bytes32,bytes32)');
    private readonly tLoadSelector: number = this.getSelector('tLoad(bytes32)');
    private readonly accountTypeSelector: number = this.getSelector('accountType(address)');
    private readonly blockHashSelector: number = this.getSelector('blockHash(uint64)');

    public constructor(deployer: Address, address: Address, gasLimit: bigint = 350_000_000_000n) {
        super({
            address: address,
            deployer: deployer,
            gasLimit,
        });
    }

    public async main(selector: number): Promise<CallResponse> {
        // The number passed usually represents the calldata length
        // We use this number as a selector because we don't need to have calldata
        const calldata = new BinaryWriter(selector);

        const response = await this.execute({
            calldata: calldata.getBuffer(),
        });

        this.handleResponse(response);
        return response;
    }
    /*
=======
        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }
*/
    public async sha256Call(value: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.sha256Selector);
        calldata.writeBytesWithLength(value);

        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }

    public async ripemd160Call(value: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.ripemd160Selector);
        calldata.writeBytesWithLength(value);

        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return reader.readBytes(20);
    }

    public async storeCall(key: Uint8Array, value: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.storeSelector)
        calldata.writeBytes(key);
        calldata.writeBytes(value);
        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);
        return value;
    }

    public async loadCall(key: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.loadSelector)
        calldata.writeBytes(key);
        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);
        const reader = new BinaryReader(response.response)
        return reader.readBytes(32)
    }

    public async tStoreCall(key: Uint8Array, value: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.tStoreSelector)
        calldata.writeBytes(key);
        calldata.writeBytes(value);
        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);
        return value;
    }

    public async tLoadCall(key: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.tLoadSelector)
        calldata.writeBytes(key);
        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);
        const reader = new BinaryReader(response.response)
        return reader.readBytes(32)
    }

    public async accountTypeCall(address: Address): Promise<number> {
        const calldata = new BinaryWriter(36);
        calldata.writeSelector(this.accountTypeSelector)
        calldata.writeAddress(address)
        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);

        const reader = new BinaryReader(response.response)
        return reader.readU32()
    }

    public async blockHashCall(blockId: bigint): Promise<Uint8Array> {
        const calldata = new BinaryWriter(12);
        calldata.writeSelector(this.blockHashSelector)
        calldata.writeU64(blockId)
        const response = await this.execute(calldata.getBuffer());
        this.handleResponse(response);

        const reader = new BinaryReader(response.response)
        return reader.readBytes(32)
    }

    private getSelector(signature: string): number {
        return Number(`0x${this.abiCoder.encodeSelector(signature)}`);
    }

    protected handleError(error: Error): Error {
        return new Error(`(in test contract: ${this.address}) OP_NET: ${error.message}`);
    }

    protected defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode(
            './test/e2e/contracts/gas-test-contract/contract/build/GasTestContract.wasm',
            this.address,
        );
    }

    private handleResponse(response: CallResponse): void {
        if (response.error) throw this.handleError(response.error);
        if (!response.response) {
            throw new Error('No response to decode');
        }
    }
}

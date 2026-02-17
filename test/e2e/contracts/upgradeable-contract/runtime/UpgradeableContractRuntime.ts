import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { BytecodeManager, CallResponse, ContractRuntime } from '../../../../../src';

export class UpgradeableContractRuntime extends ContractRuntime {
    private readonly getValueSelector: number = this.getSelector('getValue()');
    private readonly upgradeSelector: number = this.getSelector('upgrade(address)');
    private readonly storeSelector: number = this.getSelector('store(bytes32,bytes32)');
    private readonly loadSelector: number = this.getSelector('load(bytes32)');

    public constructor(deployer: Address, address: Address, gasLimit: bigint = 150_000_000_000n) {
        super({
            address: address,
            deployer: deployer,
            gasLimit,
        });
    }

    public async getValue(): Promise<number> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.getValueSelector);

        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return reader.readU32();
    }

    public async upgrade(sourceAddress: Address): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.upgradeSelector);
        calldata.writeAddress(sourceAddress);

        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        return response;
    }

    public async storeValue(key: Uint8Array, value: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.storeSelector);
        calldata.writeBytes(key);
        calldata.writeBytes(value);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        return value;
    }

    public async loadValue(key: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter(36);
        calldata.writeSelector(this.loadSelector);
        calldata.writeBytes(key);
        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }

    protected handleError(error: Error): Error {
        return new Error(`(in upgradeable contract: ${this.address}) OP_NET: ${error.message}`);
    }

    protected defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode(
            './test/e2e/contracts/upgradeable-contract/contract/build/UpgradeableContract.wasm',
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

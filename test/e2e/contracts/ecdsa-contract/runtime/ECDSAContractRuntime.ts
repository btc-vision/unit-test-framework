import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { BytecodeManager, CallResponse, ContractRuntime } from '../../../../../src';

export class ECDSAContractRuntime extends ContractRuntime {
    private readonly verifyECDSAEthereumSelector: number = this.getSelector(
        'verifyECDSAEthereum(bytes,bytes,bytes)',
    );
    private readonly verifyECDSABitcoinSelector: number = this.getSelector(
        'verifyECDSABitcoin(bytes,bytes,bytes)',
    );
    private readonly hashMessageSelector: number = this.getSelector('hashMessage(bytes)');

    public constructor(deployer: Address, address: Address, gasLimit: bigint = 150_000_000_000n) {
        super({
            address: address,
            deployer: deployer,
            gasLimit,
        });
    }

    public async verifyECDSAEthereum(
        publicKey: Uint8Array,
        signature: Uint8Array,
        hash: Uint8Array,
    ): Promise<{ result: boolean; gas: bigint }> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.verifyECDSAEthereumSelector);
        calldata.writeBytesWithLength(publicKey);
        calldata.writeBytesWithLength(signature);
        calldata.writeBytesWithLength(hash);

        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return {
            result: reader.readBoolean(),
            gas: response.usedGas,
        };
    }

    public async verifyECDSABitcoin(
        publicKey: Uint8Array,
        signature: Uint8Array,
        hash: Uint8Array,
    ): Promise<{ result: boolean; gas: bigint }> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.verifyECDSABitcoinSelector);
        calldata.writeBytesWithLength(publicKey);
        calldata.writeBytesWithLength(signature);
        calldata.writeBytesWithLength(hash);

        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return {
            result: reader.readBoolean(),
            gas: response.usedGas,
        };
    }

    public async hashMessage(data: Uint8Array): Promise<Uint8Array> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.hashMessageSelector);
        calldata.writeBytesWithLength(data);

        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return reader.readBytes(32);
    }

    protected handleError(error: Error): Error {
        return new Error(`(in ECDSA contract: ${this.address}) OP_NET: ${error.message}`);
    }

    protected defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode(
            './test/e2e/contracts/ecdsa-contract/contract/build/ECDSAContract.wasm',
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

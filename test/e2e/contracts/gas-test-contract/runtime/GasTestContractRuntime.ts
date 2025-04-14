import { Address, BinaryWriter, BinaryReader } from '@btc-vision/transaction';
import { BytecodeManager, CallResponse, ContractRuntime } from '../../../../../src';

export class GasTestContractRuntime extends ContractRuntime {
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

    private handleResponse(response: CallResponse): void {
        if (response.error) throw this.handleError(response.error);
        if (!response.response) {
            throw new Error('No response to decode');
        }
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
}

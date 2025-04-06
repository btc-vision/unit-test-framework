import { Address, BinaryWriter } from '@btc-vision/transaction';
import { BytecodeManager, CallResponse, ContractRuntime } from '../../../../../src';

export class GasTestContractRuntime extends ContractRuntime {
    public constructor(deployer: Address, address: Address, gasLimit: bigint = 350_000_000_000n) {
        super({
            address: address,
            deployer: deployer,
            gasLimit,
        });

        this.preserveState();
    }

    public async main(): Promise<CallResponse> {
        const calldata = new BinaryWriter();

        const response = await this.execute(calldata.getBuffer());
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
        return new Error(`(in test contract: ${this.address}) OPNET: ${error.message}`);
    }

    protected defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode(
            './test/e2e/contracts/gas-test-contract/contract/build/GasTestContract.wasm',
            this.address,
        );
    }
}

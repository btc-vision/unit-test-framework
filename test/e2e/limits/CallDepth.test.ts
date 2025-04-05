import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '../../../src';
import { TestContractRuntime } from '../test-contract/runtime/TestContractRuntime';
import { MAX_CALL_STACK_DEPTH } from '../../../src/contracts/configs';

await opnet('Call depth tests', async (vm: OPNetUnit) => {
    let contract: TestContractRuntime;

    const deployerAddress: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        contract = new TestContractRuntime(deployerAddress, contractAddress);
        Blockchain.register(contract);
        await contract.init();

        Blockchain.txOrigin = deployerAddress;
        Blockchain.msgSender = deployerAddress;
    });

    vm.afterEach(() => {
        contract.dispose();
        Blockchain.dispose();
    });

    await vm.it('should successfully do the maximum allowed nested calls', async () => {
        await contract.recursiveCall(MAX_CALL_STACK_DEPTH - 1);
    });

    await vm.it('should fail to do more nested calls than the maximum allowed', async () => {
        await Assert.expect(async () => {
            await contract.recursiveCall(MAX_CALL_STACK_DEPTH);
        }).toThrow()
    });
});

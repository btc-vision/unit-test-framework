import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '../../../src';
import { TestContractRuntime } from '../contracts/test-contract/runtime/TestContractRuntime';
import { CONSENSUS } from '../../../src/contracts/configs.js';

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
        await contract.recursiveCall(CONSENSUS.TRANSACTIONS.MAXIMUM_CALL_DEPTH - 1);
    });

    await vm.it('should fail to do more nested calls than the maximum allowed', async () => {
        await Assert.expect(async () => {
            await contract.recursiveCall(CONSENSUS.TRANSACTIONS.MAXIMUM_CALL_DEPTH);
        }).toThrow("Maximum call depth exceeded");
    });
});

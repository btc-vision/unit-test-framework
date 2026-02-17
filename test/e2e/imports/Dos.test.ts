import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '../../../src';
import { TestContractRuntime } from '../contracts/test-contract/runtime/TestContractRuntime';

await opnet('Dos tests', async (vm: OPNetUnit) => {
    let contract: TestContractRuntime;

    const deployerAddress: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        contract = new TestContractRuntime(deployerAddress, contractAddress, 150_000_000_000n);
        Blockchain.register(contract);
        await contract.init();

        Blockchain.txOrigin = deployerAddress;
        Blockchain.msgSender = deployerAddress;
    });

    vm.afterEach(() => {
        contract.dispose();
        Blockchain.dispose();
    });

    await vm.it('should not crash when querying own account type', async () => {
        const targetAddress = contract.address;

        const t = Date.now();
        const accountType = await contract.accountTypeCall(targetAddress);
        const elapsed = Date.now() - t;

        // Contract address should return account type 1 (contract)
        Assert.expect(accountType).toEqual(1);

        // Should complete in reasonable time (no DoS)
        Assert.expect(elapsed < 5000).toEqual(true);
    });
});

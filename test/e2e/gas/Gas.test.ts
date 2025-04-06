import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '../../../src';
import { GasTestContractRuntime } from '../contracts/gas-test-contract/runtime/GasTestContractRuntime';

await opnet('Gas tests', async (vm: OPNetUnit) => {
    let contract: GasTestContractRuntime;

    const deployerAddress: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        contract = new GasTestContractRuntime(deployerAddress, contractAddress);
        Blockchain.register(contract);
        await contract.init();

        Blockchain.txOrigin = deployerAddress;
        Blockchain.msgSender = deployerAddress;
    });

    vm.afterEach(() => {
        contract.dispose();
        Blockchain.dispose();
    });

    await vm.it('should charge the right gas to store value in new storage slot', async () => {
        const response = await contract.main();

        Assert.expect(response.usedGas).toEqual(241013471n);
    });
});

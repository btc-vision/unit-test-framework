import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '../../../src';
import { TestContractRuntime } from '../contracts/test-contract/runtime/TestContractRuntime';

await opnet('Memory tests', async (vm: OPNetUnit) => {
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

    vm.afterAll(() => {
        contract.delete();
        Blockchain.dispose();
        Blockchain.cleanup();
    });

    await vm.it('should grow the memory to the maximum size', async () => {
        const result = await contract.growMemory(511);
        Assert.expect(result).toEqual(true);
    });

    await vm.it('should fail to grow the memory over the maximum size', async () => {
        const result = await contract.growMemory(512);
        Assert.expect(result).toEqual(false);
    });

    await vm.it('should grow the memory to the maximum size after a call', async () => {
        const result = await contract.callThenGrowMemory(510);
        Assert.expect(result).toEqual(true);
    });

    await vm.it('should fail to grow the memory over the maximum size after a call', async () => {
        const result = await contract.callThenGrowMemory(511);
        Assert.expect(result).toEqual(false);
    });

    await vm.it(
        'should fail to make a call after growing the memory to the maximum size',
        async () => {
            await Assert.expect(async () => {
                await contract.growMemoryThenRecursiveCall(511, 1);
            }).toThrow('out of gas'); //.toThrow("No more memory pages available")
        },
    );
});

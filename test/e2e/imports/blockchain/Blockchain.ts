import { Address, BinaryReader } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '../../../../src';
import { TestContractRuntime } from '../../test-contract/runtime/TestContractRuntime';

await opnet('Hash tests', async (vm: OPNetUnit) => {
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

    await vm.it('Get account type contract', async () => {
        const fakeCallerAddress: Address = Blockchain.generateRandomAddress();
        Blockchain.txOrigin = fakeCallerAddress;
        Blockchain.msgSender = fakeCallerAddress;
        const result = await contract.accountTypeCall(contract.address);

        Assert.expect(result).toEqual(1);
    });

    await vm.it('Get account type address', async () => {
        const fakeCallerAddress: Address = Blockchain.generateRandomAddress();
        Blockchain.txOrigin = fakeCallerAddress;
        Blockchain.msgSender = fakeCallerAddress;
        const result = await contract.accountTypeCall(Blockchain.generateRandomAddress());

        Assert.expect(result).toEqual(0);
    });


    await vm.it('Get block hash', async () => {
        const fakeCallerAddress: Address = Blockchain.generateRandomAddress();
        Blockchain.txOrigin = fakeCallerAddress;
        Blockchain.msgSender = fakeCallerAddress;
        const result = await contract.blockHashCall(Blockchain.blockNumber);
        const reader = new BinaryReader(result)

        Assert.expect(reader.readBytes(32)).toEqual(Blockchain.DEAD_ADDRESS);
    });
});

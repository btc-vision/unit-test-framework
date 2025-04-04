import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '../../../../src';
import { TestContractRuntime } from '../../test-contract/runtime/TestContractRuntime';

await opnet('Storage tests', async (vm: OPNetUnit) => {
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

    await vm.it('Store and load the same data', async () => {
        const fakeCallerAddress: Address = Blockchain.generateRandomAddress();
        Blockchain.txOrigin = fakeCallerAddress;
        Blockchain.msgSender = fakeCallerAddress;

        const data = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);


        const storeResult = await contract.storeCall(data, data);
        const loadResult = await contract.loadCall(data);

        console.log(storeResult.buffer, loadResult.buffer, data)

        Assert.expect(areBytesEqual(data, loadResult)).toEqual(true);
    });

    await vm.it('Load of empty data', async () => {
        const fakeCallerAddress: Address = Blockchain.generateRandomAddress();
        Blockchain.txOrigin = fakeCallerAddress;
        Blockchain.msgSender = fakeCallerAddress;

        const empty = Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);


        const loadResult = await contract.loadCall(empty);

        console.log(loadResult.buffer, empty)

        Assert.expect(areBytesEqual(empty, loadResult)).toEqual(true);
    });

    await vm.it('tStore and tLoad the same data', async () => {
        const fakeCallerAddress: Address = Blockchain.generateRandomAddress();
        Blockchain.txOrigin = fakeCallerAddress;
        Blockchain.msgSender = fakeCallerAddress;

        const data = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);


        const storeResult = await contract.tStoreCall(data, data);
        const loadResult = await contract.tLoadCall(data);

        console.log(storeResult.buffer, loadResult.buffer, data)

        Assert.expect(areBytesEqual(data, loadResult)).toEqual(true);
    });

    await vm.it('tLoad of empty data', async () => {
        const fakeCallerAddress: Address = Blockchain.generateRandomAddress();
        Blockchain.txOrigin = fakeCallerAddress;
        Blockchain.msgSender = fakeCallerAddress;

        const empty = Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);


        const loadResult = await contract.tLoadCall(empty);

        console.log(loadResult.buffer, empty)

        Assert.expect(areBytesEqual(empty, loadResult)).toEqual(true);
    });
});

function areBytesEqual(arr1: Uint8Array, arr2: Uint8Array): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    return arr1.every((value, index) => value === arr2[index]);
}
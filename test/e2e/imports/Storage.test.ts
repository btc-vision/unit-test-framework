import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '../../../src';
import { TestContractRuntime } from '../contracts/test-contract/runtime/TestContractRuntime';

const A_STORAGE_KEY: Uint8Array = bigIntToUint8Array(109742986593450428n);
const A_STORAGE_VALUE: Uint8Array = bigIntToUint8Array(3n);
const ANOTHER_STORAGE_VALUE: Uint8Array = bigIntToUint8Array(5n);

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

    await vm.it(
        'should revert only state modifications done in a single call frame that reverts',
        async () => {
            const result = await contract.modifyStateThenCallFunctionModifyingStateThatReverts(
                A_STORAGE_KEY,
                A_STORAGE_VALUE,
                ANOTHER_STORAGE_VALUE,
            );

            Assert.expect(areBytesEqual(result, A_STORAGE_VALUE)).toEqual(true);
        },
    );

    await vm.it(
        'should persist state modifications done in a call to the parent context',
        async () => {
            const result = await contract.callThenModifyState(A_STORAGE_KEY, A_STORAGE_VALUE);

            Assert.expect(areBytesEqual(result, A_STORAGE_VALUE)).toEqual(true);
        },
    );

    await vm.it('should store and load the same data', async () => {
        const data = Uint8Array.from([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
            24, 25, 26, 27, 28, 29, 30, 31,
        ]);

        await contract.storeCall(data, data);
        const loadResult = await contract.loadCall(data);

        Assert.expect(areBytesEqual(data, loadResult)).toEqual(true);
    });

    await vm.it('should load empty data', async () => {
        const empty = Uint8Array.from([
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0,
        ]);

        const loadResult = await contract.loadCall(empty);

        Assert.expect(areBytesEqual(empty, loadResult)).toEqual(true);
    });

    // await vm.it('should store and load the same data in transient storage', async () => {
    //     const data = Uint8Array.from([
    //         0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
    //         24, 25, 26, 27, 28, 29, 30, 31,
    //     ]);
    //
    //     await contract.tStoreCall(data, data);
    //     const loadResult = await contract.tLoadCall(data);
    //
    //     Assert.expect(areBytesEqual(data, loadResult)).toEqual(true);
    // });

    // await vm.it('should load empty data from transient storage', async () => {
    //     const empty = Uint8Array.from([
    //         0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    //         0, 0, 0,
    //     ]);
    //
    //     const loadResult = await contract.tLoadCall(empty);
    //
    //     Assert.expect(areBytesEqual(empty, loadResult)).toEqual(true);
    // });
});

function bigIntToUint8Array(num: bigint, bigEndian: boolean = true) {
    const arr = new Uint8Array(32);

    for (let i = 0; i < arr.length; i++) {
        arr[i] = Number(num % 256n);
        num = num / 256n;
    }

    if (bigEndian) {
        arr.reverse();
    }

    return arr;
}

function uint8ArrayToBigInt(arr: Uint8Array, bigEndian: boolean = true) {
    if (bigEndian) {
        arr.reverse();
    }

    let num = 0n;

    for (let i = arr.length - 1; i >= 0; i--) {
        num = num * 256n + BigInt(arr[i]);
    }

    return num;
}

function areBytesEqual(arr1: Uint8Array, arr2: Uint8Array): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    return arr1.every((value, index) => value === arr2[index]);
}

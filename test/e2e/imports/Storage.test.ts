import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '../../../src';
import { TestContractRuntime } from '../test-contract/runtime/TestContractRuntime';

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

    await vm.it('should revert only state modifications done in a single call frame that reverts', async () => {
            let storageKey = bigIntToUint8Array(109742986593450428n);
            let firstStorageValue = bigIntToUint8Array(3n);
            let secondStorageValue = bigIntToUint8Array(5n);

            let result = await contract.modifyStateThenCallFunctionModifyingStateThatReverts(
                storageKey,
                firstStorageValue,
                secondStorageValue,
            );

            Assert.expect(areBytesEqual(result, firstStorageValue)).toEqual(true);
        },
    );
});

function bigIntToUint8Array(num: bigint, bigEndian: boolean = true) {
    let arr = new Uint8Array(32);

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

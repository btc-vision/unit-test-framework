import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '../../../src';
import { TestContractRuntime } from '../contracts/test-contract/runtime/TestContractRuntime';

await opnet('Blockchain tests', async (vm: OPNetUnit) => {
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

    await vm.it('should get the correct account type for a contract', async () => {
        const targetAddress = contract.address;
        const expectedType = 1;

        const result = await contract.accountTypeCall(targetAddress);

        Assert.expect(result).toEqual(expectedType);
    });

    await vm.it('should get the correct account type for an empty account', async () => {
        const targetAddress = Blockchain.generateRandomAddress();
        const expectedType = 0;

        const result = await contract.accountTypeCall(targetAddress);

        Assert.expect(result).toEqual(expectedType);
    });

    await vm.it('should get the correct block hash for the current block', async () => {
        const blockNumber = Blockchain.blockNumber;
        const expectedHash = Uint8Array.from([
            0x6b, 0x86, 0xb2, 0x73, 0xff, 0x34, 0xfc, 0xe1, 0x9d, 0x6b, 0x80, 0x4e, 0xff, 0x5a,
            0x3f, 0x57, 0x47, 0xad, 0xa4, 0xea, 0xa2, 0x2f, 0x1d, 0x49, 0xc0, 0x1e, 0x52, 0xdd,
            0xb7, 0x87, 0x5b, 0x4b,
        ]);

        const receivedHash = await contract.blockHashCall(blockNumber);

        Assert.expect(areBytesEqual(receivedHash, expectedHash)).toEqual(true);
    });
});

function areBytesEqual(arr1: Uint8Array, arr2: Uint8Array): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    return arr1.every((value, index) => value === arr2[index]);
}

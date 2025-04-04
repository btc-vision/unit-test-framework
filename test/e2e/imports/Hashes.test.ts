import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, opnet, OPNetUnit } from '../../../src';
import { TestContractRuntime } from '../contracts/test-contract/runtime/TestContractRuntime';


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

    await vm.it('SHA256 should hash some data correctly', async () => {
        const fakeCallerAddress: Address = Blockchain.generateRandomAddress();
        Blockchain.txOrigin = fakeCallerAddress;
        Blockchain.msgSender = fakeCallerAddress;
        const dataToHash = Uint8Array.from([0x3d]);
        const expectedHash = Uint8Array.from([
            0x38, 0x09, 0x18, 0xb9, 0x46, 0xa5, 0x26, 0x64, 0x0a, 0x40, 0xdf, 0x5d, 0xce, 0xd6,
            0x51, 0x67, 0x94, 0xf3, 0xd9, 0x7b, 0xbd, 0x9e, 0x6b, 0xb5, 0x53, 0xd0, 0x37, 0xc4,
            0x43, 0x9f, 0x31, 0xc3,
        ]);

        const result = await contract.sha256(dataToHash);

        Assert.expect(areBytesEqual(result, expectedHash)).toEqual(true);
    });

    await vm.it('SHA256 should hash empty data correctly', async () => {
        const fakeCallerAddress: Address = Blockchain.generateRandomAddress();
        Blockchain.txOrigin = fakeCallerAddress;
        Blockchain.msgSender = fakeCallerAddress;
        const dataToHash = Uint8Array.from([]);
        const expectedHash = Uint8Array.from([
            0xe3, 0xb0, 0xc4, 0x42, 0x98, 0xfc, 0x1c, 0x14, 0x9a, 0xfb, 0xf4, 0xc8, 0x99, 0x6f,
            0xb9, 0x24, 0x27, 0xae, 0x41, 0xe4, 0x64, 0x9b, 0x93, 0x4c, 0xa4, 0x95, 0x99, 0x1b,
            0x78, 0x52, 0xb8, 0x55,
        ]);

        const result = await contract.sha256(dataToHash);

        Assert.expect(areBytesEqual(result, expectedHash)).toEqual(true);
    });

    await vm.it('Ripemd160 should hash some data correctly', async () => {
        const fakeCallerAddress: Address = Blockchain.generateRandomAddress();
        Blockchain.txOrigin = fakeCallerAddress;
        Blockchain.msgSender = fakeCallerAddress;
        const dataToHash = Uint8Array.from("hello world");
        const expectedHash = Uint8Array.from([
            48, 140, 183, 230, 243, 138,
            202, 163, 219, 13, 8, 94,
            152, 145, 238, 214, 23, 244,
            86, 141
        ]);

        const result = await contract.ripemd160Call(dataToHash);
        Assert.expect(areBytesEqual(result, expectedHash)).toEqual(true);
    });

    await vm.it('Ripemd160 should hash empty data correctly', async () => {
        const fakeCallerAddress: Address = Blockchain.generateRandomAddress();
        Blockchain.txOrigin = fakeCallerAddress;
        Blockchain.msgSender = fakeCallerAddress;
        const dataToHash = Uint8Array.from([]);
        const expectedHash = Uint8Array.from([
            156, 17, 133, 165, 197, 233,
            252, 84, 97, 40, 8, 151,
            126, 232, 245, 72, 178, 37,
            141, 49
        ]);

        const result = await contract.ripemd160Call(dataToHash);
        Assert.expect(areBytesEqual(result, expectedHash)).toEqual(true);
    });
});

function areBytesEqual(arr1: Uint8Array, arr2: Uint8Array): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    return arr1.every((value, index) => value === arr2[index]);
}

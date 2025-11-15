import { Address, BinaryWriter, MessageSigner } from '@btc-vision/transaction';
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

    await vm.it('Should sign and verify MLDSA message', async () => {
        const wallet = Blockchain.generateRandomWallet();
        vm.log(
            `Using wallet address: ${wallet.address.toHex()} | Public Key: ${wallet.quantumPublicKeyHex}`,
        );

        const message = new BinaryWriter();
        message.writeString('Hello, world! This is a test message for MLDSA signing.');

        const signature = MessageSigner.signMLDSAMessage(wallet.mldsaKeypair, message.getBuffer());
        vm.log(
            `Generated MLDSA signature: ${Buffer.from(signature.signature).toString('hex')} | Security Level: ${signature.securityLevel}`,
        );

        const result = await contract.verifySignature(
            signature.signature,
            wallet.address,
            wallet.address,
        );

        Assert.expect(result).toEqual(true);
    });
});

function areBytesEqual(arr1: Uint8Array, arr2: Uint8Array): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    return arr1.every((value, index) => value === arr2[index]);
}

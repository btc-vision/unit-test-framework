import { createHash } from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { Address } from '@btc-vision/transaction';
import { Blockchain, opnet, OPNetUnit } from '../../../src';
import { ECDSAContractRuntime } from '../contracts/ecdsa-contract/runtime/ECDSAContractRuntime';

const pk = new Uint8Array(createHash('sha256').update('test-key-1').digest());
const msg = new Uint8Array(createHash('sha256').update('Hello, ECDSA test message!').digest());
const pub33 = secp256k1.getPublicKey(pk, true);
const pub65 = secp256k1.getPublicKey(pk, false);
const sigBytes = new Uint8Array(secp256k1.sign(msg, pk));

console.log('pub33:', Buffer.from(pub33).toString('hex'));
console.log('pub65:', Buffer.from(pub65).toString('hex'));
console.log('sig:', Buffer.from(sigBytes).toString('hex'));
console.log('msg:', Buffer.from(msg).toString('hex'));

await opnet('ECDSA Debug', async (vm: OPNetUnit) => {
    let contract: ECDSAContractRuntime;
    const deployerAddress: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();
        contract = new ECDSAContractRuntime(deployerAddress, contractAddress);
        Blockchain.register(contract);
        await contract.init();
        Blockchain.txOrigin = deployerAddress;
        Blockchain.msgSender = deployerAddress;
    });

    vm.afterEach(() => {
        contract.dispose();
        Blockchain.dispose();
    });

    await vm.it('debug btc compressed', async () => {
        const r = await contract.verifyECDSABitcoin(pub33, sigBytes, msg);
        console.log('btc compressed result:', r.result, 'gas:', r.gas.toString());
    });

    await vm.it('debug btc raw64', async () => {
        const raw = new Uint8Array(pub65.slice(1));
        const r = await contract.verifyECDSABitcoin(raw, sigBytes, msg);
        console.log('btc raw64 result:', r.result, 'gas:', r.gas.toString());
    });

    await vm.it('debug btc uncompressed65', async () => {
        const r = await contract.verifyECDSABitcoin(pub65, sigBytes, msg);
        console.log('btc uncompressed result:', r.result, 'gas:', r.gas.toString());
    });
});

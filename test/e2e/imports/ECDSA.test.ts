import { createHash, randomBytes } from 'crypto';
import { Address } from '@btc-vision/transaction';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { Assert, Blockchain, opnet, OPNetUnit } from '../../../src';
import { ECDSAContractRuntime } from '../contracts/ecdsa-contract/runtime/ECDSAContractRuntime';

function sha256(data: Uint8Array): Uint8Array {
    return new Uint8Array(createHash('sha256').update(data).digest());
}

function deterministicKey(seed: string): Uint8Array {
    return new Uint8Array(createHash('sha256').update(seed).digest());
}

interface ECDSAKeyPair {
    privateKey: Uint8Array;
    compressed: Uint8Array; // 33 bytes
    uncompressed: Uint8Array; // 65 bytes
    raw: Uint8Array; // 64 bytes (x || y, no prefix)
}

function generateKeyPair(seed: string): ECDSAKeyPair {
    const privateKey = deterministicKey(seed);
    const compressed = secp256k1.getPublicKey(privateKey, true);
    const uncompressed = secp256k1.getPublicKey(privateKey, false);
    const raw = uncompressed.slice(1); // drop 0x04 prefix
    return { privateKey, compressed, uncompressed, raw };
}

/** Sign a 32-byte hash and return Ethereum-style 65-byte sig: r(32) || s(32) || v(1) */
function signEthereum(hash: Uint8Array, privateKey: Uint8Array): Uint8Array {
    const sigBytes = secp256k1.sign(hash, privateKey);
    const S = secp256k1.Signature;
    const sig = S.fromBytes(sigBytes);

    const rHex = sig.r.toString(16).padStart(64, '0');
    const sHex = sig.s.toString(16).padStart(64, '0');

    // Find recovery id
    for (let v = 0; v <= 1; v++) {
        const recSig = new Uint8Array(65);
        recSig[0] = v;
        recSig.set(sigBytes, 1);

        try {
            const recovered = secp256k1.recoverPublicKey(recSig, hash);
            const expected = secp256k1.getPublicKey(privateKey, true);
            if (Buffer.from(recovered).equals(Buffer.from(expected))) {
                const ethSig = new Uint8Array(65);
                ethSig.set(Buffer.from(rHex, 'hex'), 0);
                ethSig.set(Buffer.from(sHex, 'hex'), 32);
                ethSig[64] = v;
                return ethSig;
            }
        } catch {
            // not this v
        }
    }

    throw new Error('Could not find recovery id');
}

/** Sign a 32-byte hash and return Bitcoin-style 64-byte compact sig: r(32) || s(32) */
function signBitcoin(hash: Uint8Array, privateKey: Uint8Array): Uint8Array {
    return new Uint8Array(secp256k1.sign(hash, privateKey));
}

await opnet('ECDSA Signature Verification', async (vm: OPNetUnit) => {
    let contract: ECDSAContractRuntime;

    const deployerAddress: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();

    const testMessage = new TextEncoder().encode('Hello, ECDSA test message!');
    const testHash = sha256(testMessage);

    const key1 = generateKeyPair('ecdsa-test-key-1');
    const key2 = generateKeyPair('ecdsa-test-key-2');

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

    // ─── Ethereum ECDSA (ecrecover) ───

    await vm.it(
        'should verify a valid Ethereum ECDSA signature with compressed public key',
        async () => {
            const sig = signEthereum(testHash, key1.privateKey);
            const { result } = await contract.verifyECDSAEthereum(key1.compressed, sig, testHash);
            Assert.expect(result).toEqual(true);
        },
    );

    await vm.it(
        'should verify a valid Ethereum ECDSA signature with uncompressed public key',
        async () => {
            const sig = signEthereum(testHash, key1.privateKey);
            const { result } = await contract.verifyECDSAEthereum(
                key1.uncompressed,
                sig,
                testHash,
            );
            Assert.expect(result).toEqual(true);
        },
    );

    await vm.it(
        'should verify a valid Ethereum ECDSA signature with raw 64-byte public key',
        async () => {
            const sig = signEthereum(testHash, key1.privateKey);
            const { result } = await contract.verifyECDSAEthereum(key1.raw, sig, testHash);
            Assert.expect(result).toEqual(true);
        },
    );

    await vm.it('should reject Ethereum ECDSA signature with wrong public key', async () => {
        const sig = signEthereum(testHash, key1.privateKey);
        const { result } = await contract.verifyECDSAEthereum(key2.compressed, sig, testHash);
        Assert.expect(result).toEqual(false);
    });

    await vm.it('should reject Ethereum ECDSA signature with wrong message', async () => {
        const sig = signEthereum(testHash, key1.privateKey);
        const wrongHash = sha256(new TextEncoder().encode('wrong message'));
        const { result } = await contract.verifyECDSAEthereum(key1.compressed, sig, wrongHash);
        Assert.expect(result).toEqual(false);
    });

    await vm.it(
        'should verify Ethereum ECDSA with v=27/28 (EIP-155 style recovery id)',
        async () => {
            const sig = signEthereum(testHash, key1.privateKey);
            // Convert v from 0/1 to 27/28
            sig[64] = sig[64] + 27;
            const { result } = await contract.verifyECDSAEthereum(key1.compressed, sig, testHash);
            Assert.expect(result).toEqual(true);
        },
    );

    // ─── Bitcoin ECDSA (direct verify) ───

    await vm.it(
        'should verify a valid Bitcoin ECDSA signature with compressed public key',
        async () => {
            const sig = signBitcoin(testHash, key1.privateKey);
            const { result } = await contract.verifyECDSABitcoin(key1.compressed, sig, testHash);
            Assert.expect(result).toEqual(true);
        },
    );

    await vm.it(
        'should verify a valid Bitcoin ECDSA signature with uncompressed public key',
        async () => {
            const sig = signBitcoin(testHash, key1.privateKey);
            const { result } = await contract.verifyECDSABitcoin(
                key1.uncompressed,
                sig,
                testHash,
            );
            Assert.expect(result).toEqual(true);
        },
    );

    await vm.it(
        'should verify a valid Bitcoin ECDSA signature with raw 64-byte public key',
        async () => {
            const sig = signBitcoin(testHash, key1.privateKey);
            const { result } = await contract.verifyECDSABitcoin(key1.raw, sig, testHash);
            Assert.expect(result).toEqual(true);
        },
    );

    await vm.it('should reject Bitcoin ECDSA signature with wrong public key', async () => {
        const sig = signBitcoin(testHash, key1.privateKey);
        const { result } = await contract.verifyECDSABitcoin(key2.compressed, sig, testHash);
        Assert.expect(result).toEqual(false);
    });

    await vm.it('should reject Bitcoin ECDSA signature with wrong message', async () => {
        const sig = signBitcoin(testHash, key1.privateKey);
        const wrongHash = sha256(new TextEncoder().encode('wrong message'));
        const { result } = await contract.verifyECDSABitcoin(key1.compressed, sig, wrongHash);
        Assert.expect(result).toEqual(false);
    });

    // ─── Multiple keys ───

    await vm.it(
        'should verify Ethereum ECDSA with multiple different keys',
        async () => {
            for (let i = 0; i < 5; i++) {
                const key = generateKeyPair(`multi-key-eth-${i}`);
                const sig = signEthereum(testHash, key.privateKey);
                const { result } = await contract.verifyECDSAEthereum(
                    key.compressed,
                    sig,
                    testHash,
                );
                Assert.expect(result).toEqual(true);
            }
        },
    );

    await vm.it(
        'should verify Bitcoin ECDSA with multiple different keys',
        async () => {
            for (let i = 0; i < 5; i++) {
                const key = generateKeyPair(`multi-key-btc-${i}`);
                const sig = signBitcoin(testHash, key.privateKey);
                const { result } = await contract.verifyECDSABitcoin(
                    key.compressed,
                    sig,
                    testHash,
                );
                Assert.expect(result).toEqual(true);
            }
        },
    );

    // ─── Different message hashes ───

    await vm.it('should verify Ethereum ECDSA with various message hashes', async () => {
        const messages = ['msg1', 'msg2', 'a longer test message', ''];
        for (const msg of messages) {
            const hash = sha256(new TextEncoder().encode(msg));
            const sig = signEthereum(hash, key1.privateKey);
            const { result } = await contract.verifyECDSAEthereum(key1.compressed, sig, hash);
            Assert.expect(result).toEqual(true);
        }
    });

    await vm.it('should verify Bitcoin ECDSA with various message hashes', async () => {
        const messages = ['msg1', 'msg2', 'a longer test message', ''];
        for (const msg of messages) {
            const hash = sha256(new TextEncoder().encode(msg));
            const sig = signBitcoin(hash, key1.privateKey);
            const { result } = await contract.verifyECDSABitcoin(key1.compressed, sig, hash);
            Assert.expect(result).toEqual(true);
        }
    });

    // ─── Gas consumption ───

    await vm.it('should consume gas for Ethereum ECDSA verification', async () => {
        const sig = signEthereum(testHash, key1.privateKey);
        const { gas } = await contract.verifyECDSAEthereum(key1.compressed, sig, testHash);
        Assert.expect(gas > 0n).toEqual(true);
    });

    await vm.it('should consume gas for Bitcoin ECDSA verification', async () => {
        const sig = signBitcoin(testHash, key1.privateKey);
        const { gas } = await contract.verifyECDSABitcoin(key1.compressed, sig, testHash);
        Assert.expect(gas > 0n).toEqual(true);
    });

    // ─── Cross-key rejection (sign with one key, verify with another) ───

    await vm.it(
        'should reject Ethereum signature signed by key1 but verified against key2',
        async () => {
            const sig = signEthereum(testHash, key1.privateKey);
            const { result } = await contract.verifyECDSAEthereum(key2.compressed, sig, testHash);
            Assert.expect(result).toEqual(false);
        },
    );

    await vm.it(
        'should reject Bitcoin signature signed by key1 but verified against key2',
        async () => {
            const sig = signBitcoin(testHash, key1.privateKey);
            const { result } = await contract.verifyECDSABitcoin(key2.compressed, sig, testHash);
            Assert.expect(result).toEqual(false);
        },
    );
});

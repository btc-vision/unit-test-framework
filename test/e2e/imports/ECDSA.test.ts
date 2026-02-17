import { createHash } from 'crypto';
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

/**
 * Sign a raw message and return Ethereum-style 65-byte sig: r(32) || s(32) || v(1).
 *
 * IMPORTANT: noble/curves secp256k1.sign() hashes the message internally with SHA-256.
 * The Rust VM's verify_prehash expects the SHA-256 hash of the raw message.
 * So we sign the RAW message (noble hashes it), and pass SHA-256(rawMessage) to the contract.
 */
function signEthereum(rawMessage: Uint8Array, privateKey: Uint8Array): Uint8Array {
    // noble/curves hashes rawMessage internally → signature is over SHA-256(rawMessage)
    const sigBytes = secp256k1.sign(rawMessage, privateKey);
    const pub33 = secp256k1.getPublicKey(privateKey, true);

    // Find recovery id using secp256k1.recoverPublicKey (also hashes internally)
    for (let v = 0; v <= 1; v++) {
        const recSig = new Uint8Array(65);
        recSig[0] = v;
        recSig.set(sigBytes, 1);

        try {
            const recovered = secp256k1.recoverPublicKey(recSig, rawMessage);
            if (Buffer.from(recovered).equals(Buffer.from(pub33))) {
                // Build Ethereum-style sig: r(32) || s(32) || v(1)
                const ethSig = new Uint8Array(65);
                ethSig.set(sigBytes.slice(0, 32), 0); // r
                ethSig.set(sigBytes.slice(32, 64), 32); // s
                ethSig[64] = v;
                return ethSig;
            }
        } catch {
            // not this v
        }
    }

    throw new Error('Could not find recovery id');
}

/**
 * Sign a raw message and return Bitcoin-style 64-byte compact sig: r(32) || s(32).
 *
 * IMPORTANT: noble/curves secp256k1.sign() hashes the message internally with SHA-256.
 * The Rust VM's verify_prehash expects the SHA-256 hash of the raw message.
 */
function signBitcoin(rawMessage: Uint8Array, privateKey: Uint8Array): Uint8Array {
    return new Uint8Array(secp256k1.sign(rawMessage, privateKey));
}

await opnet('ECDSA Signature Verification', async (vm: OPNetUnit) => {
    let contract: ECDSAContractRuntime;

    const deployerAddress: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();

    // Raw message bytes (NOT pre-hashed) — noble/curves hashes internally
    const testMessage = new TextEncoder().encode('Hello, ECDSA test message!');
    // SHA-256 hash to pass to the contract (the Rust VM verifies against this prehash)
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
            const sig = signEthereum(testMessage, key1.privateKey);
            const { result } = await contract.verifyECDSAEthereum(key1.compressed, sig, testHash);
            Assert.expect(result).toEqual(true);
        },
    );

    await vm.it(
        'should verify a valid Ethereum ECDSA signature with uncompressed public key',
        async () => {
            const sig = signEthereum(testMessage, key1.privateKey);
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
            const sig = signEthereum(testMessage, key1.privateKey);
            const { result } = await contract.verifyECDSAEthereum(key1.raw, sig, testHash);
            Assert.expect(result).toEqual(true);
        },
    );

    await vm.it('should reject Ethereum ECDSA signature with wrong public key', async () => {
        const sig = signEthereum(testMessage, key1.privateKey);
        const { result } = await contract.verifyECDSAEthereum(key2.compressed, sig, testHash);
        Assert.expect(result).toEqual(false);
    });

    await vm.it('should reject Ethereum ECDSA signature with wrong message', async () => {
        const sig = signEthereum(testMessage, key1.privateKey);
        const wrongHash = sha256(new TextEncoder().encode('wrong message'));
        const { result } = await contract.verifyECDSAEthereum(key1.compressed, sig, wrongHash);
        Assert.expect(result).toEqual(false);
    });

    await vm.it(
        'should verify Ethereum ECDSA with v=27/28 (EIP-155 style recovery id)',
        async () => {
            const sig = signEthereum(testMessage, key1.privateKey);
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
            const sig = signBitcoin(testMessage, key1.privateKey);
            const { result } = await contract.verifyECDSABitcoin(key1.compressed, sig, testHash);
            Assert.expect(result).toEqual(true);
        },
    );

    await vm.it(
        'should verify a valid Bitcoin ECDSA signature with uncompressed public key',
        async () => {
            const sig = signBitcoin(testMessage, key1.privateKey);
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
            const sig = signBitcoin(testMessage, key1.privateKey);
            const { result } = await contract.verifyECDSABitcoin(key1.raw, sig, testHash);
            Assert.expect(result).toEqual(true);
        },
    );

    await vm.it('should reject Bitcoin ECDSA signature with wrong public key', async () => {
        const sig = signBitcoin(testMessage, key1.privateKey);
        const { result } = await contract.verifyECDSABitcoin(key2.compressed, sig, testHash);
        Assert.expect(result).toEqual(false);
    });

    await vm.it('should reject Bitcoin ECDSA signature with wrong message', async () => {
        const sig = signBitcoin(testMessage, key1.privateKey);
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
                const sig = signEthereum(testMessage, key.privateKey);
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
                const sig = signBitcoin(testMessage, key.privateKey);
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
            const rawMsg = new TextEncoder().encode(msg);
            const hash = sha256(rawMsg);
            const sig = signEthereum(rawMsg, key1.privateKey);
            const { result } = await contract.verifyECDSAEthereum(key1.compressed, sig, hash);
            Assert.expect(result).toEqual(true);
        }
    });

    await vm.it('should verify Bitcoin ECDSA with various message hashes', async () => {
        const messages = ['msg1', 'msg2', 'a longer test message', ''];
        for (const msg of messages) {
            const rawMsg = new TextEncoder().encode(msg);
            const hash = sha256(rawMsg);
            const sig = signBitcoin(rawMsg, key1.privateKey);
            const { result } = await contract.verifyECDSABitcoin(key1.compressed, sig, hash);
            Assert.expect(result).toEqual(true);
        }
    });

    // ─── Gas consumption ───

    await vm.it('should consume gas for Ethereum ECDSA verification', async () => {
        const sig = signEthereum(testMessage, key1.privateKey);
        const { gas } = await contract.verifyECDSAEthereum(key1.compressed, sig, testHash);
        Assert.expect(gas > 0n).toEqual(true);
    });

    await vm.it('should consume gas for Bitcoin ECDSA verification', async () => {
        const sig = signBitcoin(testMessage, key1.privateKey);
        const { gas } = await contract.verifyECDSABitcoin(key1.compressed, sig, testHash);
        Assert.expect(gas > 0n).toEqual(true);
    });

    // ─── Cross-key rejection (sign with one key, verify with another) ───

    await vm.it(
        'should reject Ethereum signature signed by key1 but verified against key2',
        async () => {
            const sig = signEthereum(testMessage, key1.privateKey);
            const { result } = await contract.verifyECDSAEthereum(key2.compressed, sig, testHash);
            Assert.expect(result).toEqual(false);
        },
    );

    await vm.it(
        'should reject Bitcoin signature signed by key1 but verified against key2',
        async () => {
            const sig = signBitcoin(testMessage, key1.privateKey);
            const { result } = await contract.verifyECDSABitcoin(key2.compressed, sig, testHash);
            Assert.expect(result).toEqual(false);
        },
    );
});

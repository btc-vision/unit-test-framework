# Signature Verification

Test ML-DSA (post-quantum), Schnorr, and ECDSA signature verification in contracts.

---

## ML-DSA Signatures

ML-DSA (formerly CRYSTALS-Dilithium) provides quantum-resistant signatures:

```typescript
import { MessageSigner, BinaryWriter } from '@btc-vision/transaction';
import { Blockchain } from '@btc-vision/unit-test-framework';

await vm.it('should verify ML-DSA signature', async () => {
    const wallet = Blockchain.generateRandomWallet();

    // Create and sign message
    const message = new BinaryWriter();
    message.writeString('Hello, World!');

    const signature = MessageSigner.signMLDSAMessage(
        wallet.mldsaKeypair,
        message.getBuffer(),
    );

    vm.info(`Security Level: ${signature.securityLevel}`);
    vm.info(`Signature length: ${signature.signature.length} bytes`);

    // Pass to contract for verification
    const result = await contract.verifySignature(
        signature.signature,
        wallet.address,
        wallet.address,
    );

    Assert.expect(result.result).toEqual(true);
    vm.success(`Gas used: ${result.gas}`);
});
```

---

## Schnorr Signatures

Schnorr signatures are used for standard Bitcoin signing:

```typescript
await vm.it('should verify Schnorr signature', async () => {
    const wallet = Blockchain.generateRandomWallet();

    const message = new BinaryWriter();
    message.writeString('Test message');
    const msgBuffer = message.getBuffer();

    // Sign with tweaked key
    const signature = MessageSigner.tweakAndSignMessage(
        wallet.keypair,
        msgBuffer,
        Blockchain.network,
    );

    // Verify locally first
    const localValid = MessageSigner.tweakAndVerifySignature(
        wallet.keypair.publicKey,
        msgBuffer,
        signature.signature,
    );
    Assert.expect(localValid).toEqual(true);

    // Verify in contract
    const result = await contract.verifySignatureSchnorr(
        signature.signature,
        wallet.address,
        wallet.address,
    );

    Assert.expect(result.result).toEqual(true);
});
```

---

## ECDSA Signatures

ECDSA verification supports both Ethereum-style (ecrecover with recovery ID) and Bitcoin-style (direct verify):

```typescript
import { createHash } from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1.js';

function sha256(data: Uint8Array): Uint8Array {
    return new Uint8Array(createHash('sha256').update(data).digest());
}

// Generate keypair from seed
function generateKeyPair(seed: string) {
    const privateKey = sha256(new TextEncoder().encode(seed));
    const compressed = secp256k1.getPublicKey(privateKey, true);
    const uncompressed = secp256k1.getPublicKey(privateKey, false);
    return { privateKey, compressed, uncompressed, raw: uncompressed.slice(1) };
}
```

### Ethereum-style (ecrecover)

```typescript
function signEthereum(rawMessage: Uint8Array, privateKey: Uint8Array): Uint8Array {
    const sigBytes = secp256k1.sign(rawMessage, privateKey);
    const pub33 = secp256k1.getPublicKey(privateKey, true);

    // Find recovery id
    for (let v = 0; v <= 1; v++) {
        const recSig = new Uint8Array(65);
        recSig[0] = v;
        recSig.set(sigBytes, 1);
        try {
            const recovered = secp256k1.recoverPublicKey(recSig, rawMessage);
            if (Buffer.from(recovered).equals(Buffer.from(pub33))) {
                const ethSig = new Uint8Array(65);
                ethSig.set(sigBytes.slice(0, 32), 0);  // r
                ethSig.set(sigBytes.slice(32, 64), 32); // s
                ethSig[64] = v;                          // v
                return ethSig;
            }
        } catch { /* not this v */ }
    }
    throw new Error('Could not find recovery id');
}

await vm.it('should verify Ethereum ECDSA', async () => {
    const key = generateKeyPair('test-key');
    const message = new TextEncoder().encode('Hello, ECDSA!');
    const hash = sha256(message);
    const sig = signEthereum(message, key.privateKey);

    const { result } = await contract.verifyECDSAEthereum(key.compressed, sig, hash);
    Assert.expect(result).toEqual(true);
});
```

### Bitcoin-style (direct verify)

```typescript
function signBitcoin(rawMessage: Uint8Array, privateKey: Uint8Array): Uint8Array {
    return new Uint8Array(secp256k1.sign(rawMessage, privateKey));
}

await vm.it('should verify Bitcoin ECDSA', async () => {
    const key = generateKeyPair('test-key');
    const message = new TextEncoder().encode('Hello, ECDSA!');
    const hash = sha256(message);
    const sig = signBitcoin(message, key.privateKey);

    const { result } = await contract.verifyECDSABitcoin(key.compressed, sig, hash);
    Assert.expect(result).toEqual(true);
});
```

### Public Key Formats

ECDSA verification accepts three public key formats:

| Format | Length | Description |
|--------|--------|-------------|
| Compressed | 33 bytes | `02/03` prefix + x coordinate |
| Uncompressed | 65 bytes | `04` prefix + x + y coordinates |
| Raw | 64 bytes | x + y coordinates (no prefix) |

---

## ML-DSA Key Registration

For contracts that look up ML-DSA public keys by address:

```typescript
const wallet = Blockchain.generateRandomWallet();

// Register the public key
Blockchain.registerMLDSAPublicKey(
    wallet.address,
    wallet.mldsaKeypair.publicKey,
);

// Look up later
const pubKey = Blockchain.getMLDSAPublicKey(wallet.address);
```

---

[<- Previous: Transaction Simulation](./transaction-simulation.md) | [Next: State Management ->](./state-management.md)

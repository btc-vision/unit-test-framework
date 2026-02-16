# Transaction Simulation

Simulate Bitcoin transactions with inputs and outputs to test contracts that read UTXO data.

---

## Creating Transactions

```typescript
import {
    Transaction, TransactionInput, TransactionOutput,
    generateTransactionId, generateEmptyTransaction,
} from '@btc-vision/unit-test-framework';
```

### Empty Transaction

```typescript
const tx = generateEmptyTransaction();
Blockchain.transaction = tx;
```

### Custom Transaction

```typescript
const tx = new Transaction(
    generateTransactionId(),
    [
        new TransactionInput({
            txHash: new Uint8Array(32),
            outputIndex: 0,
            scriptSig: new Uint8Array(0),
            flags: 0,
        }),
    ],
    [],
);

// Add outputs
tx.addOutput(100000n, receiverAddress.p2tr(Blockchain.network));
tx.addOutput(50000n, undefined, opReturnScript);

// Set as current transaction
Blockchain.transaction = tx;
```

### Adding Inputs

```typescript
// Simple input
tx.addInput(
    new Uint8Array(32),  // Previous tx hash
    0,                    // Output index
    new Uint8Array(0),   // Script sig
);

// Input with flags
tx.addInputWithFlags(new TransactionInput({
    txHash: prevTxHash,
    outputIndex: 1,
    scriptSig: new Uint8Array(0),
    flags: 0b00000001,  // coinbase flag
    coinbase: Buffer.from('coinbase data'),
}));
```

### Adding Outputs

```typescript
// Output to address
tx.addOutput(100000n, recipientAddress);

// Output with script
tx.addOutputWithFlags(new TransactionOutput({
    index: 2,
    value: 0n,
    scriptPubKey: opReturnData,
    flags: 0b00000100,  // OP_RETURN flag
}));
```

---

## Testing with Transactions

Contracts that read transaction inputs/outputs (e.g., for UTXO verification) need a transaction context:

```typescript
await vm.it('should process transaction outputs', async () => {
    const tx = generateEmptyTransaction();

    // Add recipient outputs
    tx.addOutput(50000n, alice.p2tr(Blockchain.network));
    tx.addOutput(30000n, bob.p2tr(Blockchain.network));

    Blockchain.transaction = tx;

    // Contract can now read inputs() and outputs()
    const response = await contract.processTransaction();
    Assert.expect(response.usedGas).toBeGreaterThan(0n);
});
```

---

## Serialization

Transactions serialize inputs and outputs for the VM:

```typescript
const inputBytes = tx.serializeInputs();
const outputBytes = tx.serializeOutputs();
```

This is handled automatically by the framework when `Blockchain.transaction` is set.

---

[<- Previous: Upgradeable Contracts](./upgradeable-contracts.md) | [Next: Signature Verification ->](./signature-verification.md)

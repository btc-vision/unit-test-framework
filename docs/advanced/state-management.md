# State Management

Advanced state manipulation for debugging, block replay, and test isolation.

---

## StateHandler

The `StateHandler` singleton manages global contract state across the VM:

```typescript
import { StateHandler } from '@btc-vision/unit-test-framework';
```

### Override States

Load state from external sources (e.g., mainnet state dumps):

```typescript
import { FastMap } from '@btc-vision/transaction';

// Create a state map (pointer -> value)
const states = new FastMap<bigint, bigint>();
states.set(0x01n, 0x42n);
states.set(0x02n, 0x100n);

// Override contract state
StateHandler.overrideStates(contractAddress, states);
StateHandler.overrideDeployment(contractAddress);
```

### Read Global State

```typescript
// Check if a pointer exists
const exists = StateHandler.globalHas(contractAddress, pointer);

// Read a value
const value = StateHandler.globalLoad(contractAddress, pointer);
```

### Temporary States

Used internally for cross-contract calls. Temporary states are merged to global after successful execution:

```typescript
// Set temporary states (for transaction simulation)
StateHandler.setTemporaryStates(contractAddress, tempStates);

// Merge all temporary states to global
StateHandler.pushAllTempStatesToGlobal();

// Clear temporary states for a contract
StateHandler.clearTemporaryStates(contractAddress);
```

### Reset

```typescript
// Reset one contract
StateHandler.resetGlobalStates(contractAddress);

// Reset everything
StateHandler.purgeAll();
```

---

## Contract State Backup/Restore

`ContractRuntime` and `Blockchain` both support backup/restore:

```typescript
// Backup state of a single contract
contract.backupStates();
// ... make changes ...
contract.restoreStates();

// Backup state of ALL registered contracts
Blockchain.backupStates();
// ... make changes ...
Blockchain.restoreStates();
```

This is useful for testing multiple scenarios from the same starting state without re-initializing.

---

## State Override via Execute

Control whether state changes persist per call:

```typescript
// State changes persist (default)
await contract.execute({
    calldata: buffer,
    saveStates: true,
});

// State changes discarded after call
await contract.execute({
    calldata: buffer,
    saveStates: false,
});
```

---

## Applying State from Cross-Contract Calls

When a contract call modifies another contract's state, use `applyStatesOverride`:

```typescript
const response = await contractA.execute({ calldata });

// Apply the state changes (events, call stack, etc.) to contractB
contractB.applyStatesOverride({
    events: response.events,
    callStack: response.callStack,
    touchedAddresses: response.touchedAddresses,
    touchedBlocks: response.touchedBlocks,
    totalEventLength: response.events.length,
    loadedPointers: 0n,
    storedPointers: 0n,
    memoryPagesUsed: response.memoryPagesUsed,
});
```

---

[<- Previous: Signature Verification](./signature-verification.md) | [Next: Gas Profiling ->](./gas-profiling.md)

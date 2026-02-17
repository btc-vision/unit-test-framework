# Consensus Rules

Configure consensus flags that affect VM behavior during tests.

---

## ConsensusRules Class

`ConsensusRules` is a bitfield class for manipulating consensus flags:

```typescript
import { ConsensusRules, ConsensusManager } from '@btc-vision/unit-test-framework';
```

### Available Flags

| Flag | Value | Description |
|------|-------|-------------|
| `NONE` | `0b00000000` | No flags |
| `ALLOW_CLASSICAL_SIGNATURES` | `0b00000001` | Allow Schnorr/ECDSA (non-quantum) |
| `UPDATE_CONTRACT_BY_ADDRESS` | `0b00000010` | Allow contract upgrades |
| `RESERVED_FLAG_2` | `0b00000100` | Reserved for future use |

### Creating Rules

```typescript
// Empty rules
const rules = ConsensusRules.new();

// From bigint
const rules = ConsensusRules.fromBigint(0b00000011n);

// Combine multiple flags
const rules = ConsensusRules.combine([
    ConsensusRules.ALLOW_CLASSICAL_SIGNATURES,
    ConsensusRules.UPDATE_CONTRACT_BY_ADDRESS,
]);
```

### Manipulating Flags

```typescript
const rules = ConsensusRules.new();

// Insert a flag
rules.insertFlag(ConsensusRules.ALLOW_CLASSICAL_SIGNATURES);

// Check a flag
rules.containsFlag(ConsensusRules.ALLOW_CLASSICAL_SIGNATURES); // true

// Remove a flag
rules.removeFlag(ConsensusRules.ALLOW_CLASSICAL_SIGNATURES);

// Toggle a flag
rules.toggleFlag(ConsensusRules.UPDATE_CONTRACT_BY_ADDRESS);

// Set conditionally
rules.setFlag(ConsensusRules.ALLOW_CLASSICAL_SIGNATURES, true);

// Check if signatures are allowed
rules.unsafeSignaturesAllowed(); // true if ALLOW_CLASSICAL_SIGNATURES is set
```

### Set Operations

```typescript
const a = ConsensusRules.combine([ConsensusRules.ALLOW_CLASSICAL_SIGNATURES]);
const b = ConsensusRules.combine([ConsensusRules.UPDATE_CONTRACT_BY_ADDRESS]);

const union = a.union(b);
const intersection = a.intersection(b);
const difference = a.difference(b);
const complement = a.complement();

// Check relationships
a.intersects(b);  // false
a.isEmpty();       // false
a.equals(b);       // false
```

### Serialization

```typescript
const bigint = rules.asBigInt();
const bytes = rules.toBeBytes();
const binary = rules.toBinaryString();
const clone = rules.clone();
```

---

## ConsensusManager

Global singleton for managing active consensus flags:

```typescript
import { ConsensusManager } from '@btc-vision/unit-test-framework';

// Reset to defaults (ALLOW_CLASSICAL_SIGNATURES + UPDATE_CONTRACT_BY_ADDRESS)
ConsensusManager.default();

// Get current flags
const flags = ConsensusManager.getFlags();
```

---

## Consensus Configuration

Access the full consensus object:

```typescript
import { configs } from '@btc-vision/unit-test-framework';

const consensus = configs.CONSENSUS;

// Gas configuration
consensus.GAS.TRANSACTION_MAX_GAS;
consensus.GAS.EMULATION_MAX_GAS;
consensus.GAS.TARGET_GAS;
consensus.GAS.SAT_TO_GAS_RATIO;
consensus.GAS.PANIC_GAS_COST;
consensus.GAS.COST.COLD_STORAGE_LOAD;

// Transaction limits
consensus.TRANSACTIONS.MAXIMUM_CALL_DEPTH;
consensus.TRANSACTIONS.MAXIMUM_DEPLOYMENT_DEPTH;
consensus.TRANSACTIONS.REENTRANCY_GUARD;
consensus.TRANSACTIONS.STORAGE_COST_PER_BYTE;

// Event limits
consensus.TRANSACTIONS.EVENTS.MAXIMUM_EVENT_LENGTH;
consensus.TRANSACTIONS.EVENTS.MAXIMUM_TOTAL_EVENT_LENGTH;
consensus.TRANSACTIONS.EVENTS.MAXIMUM_EVENT_NAME_LENGTH;

// Contract limits
consensus.CONTRACTS.MAXIMUM_CONTRACT_SIZE_COMPRESSED;
consensus.CONTRACTS.MAXIMUM_CALLDATA_SIZE_COMPRESSED;

// VM / UTXO config
consensus.VM.UTXOS.MAXIMUM_INPUTS;
consensus.VM.UTXOS.MAXIMUM_OUTPUTS;
consensus.VM.UTXOS.OP_RETURN.ENABLED;
consensus.VM.UTXOS.OP_RETURN.MAXIMUM_SIZE;

// Network
consensus.NETWORK.MAXIMUM_TRANSACTION_BROADCAST_SIZE;
```

---

## Using in Tests

```typescript
import { configs } from '@btc-vision/unit-test-framework';
const { CONSENSUS } = configs;

await vm.it('should respect max call depth', async () => {
    // Should succeed at max depth - 1
    await contract.recursiveCall(CONSENSUS.TRANSACTIONS.MAXIMUM_CALL_DEPTH - 1);

    // Should fail at max depth
    await Assert.expect(async () => {
        await contract.recursiveCall(CONSENSUS.TRANSACTIONS.MAXIMUM_CALL_DEPTH);
    }).toThrow();
});
```

---

[<- Previous: Gas Profiling](./gas-profiling.md) | [Next: NativeSwap Testing ->](../examples/nativeswap-testing.md)

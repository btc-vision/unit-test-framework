# Utilities Reference

Helper functions, singletons, and configuration constants.

---

## Transaction Utilities

**Import:** `import { generateEmptyTransaction, gas2Sat, sat2BTC, gas2BTC, gas2USD } from '@btc-vision/unit-test-framework'`

### `generateEmptyTransaction(addDefault)`

```typescript
function generateEmptyTransaction(addDefault: boolean = true): Transaction
```

Creates an empty `Transaction` with a random ID. When `addDefault` is `true` (default), adds a default output.

### `generateTransactionId()`

```typescript
function generateTransactionId(): Uint8Array
```

Returns a random 32-byte transaction ID.

### `gas2Sat(gas)`

```typescript
function gas2Sat(gas: bigint): bigint
```

Converts gas units to satoshis by dividing by `1_000_000n` (hardcoded).

### `sat2BTC(satoshis)`

```typescript
function sat2BTC(satoshis: bigint): number
```

Converts satoshis to BTC (divides by 100_000_000).

### `gas2BTC(gas)`

```typescript
function gas2BTC(gas: bigint): number
```

Converts gas directly to BTC.

### `gas2USD(gas, btcPrice?)`

```typescript
function gas2USD(gas: bigint, btcPrice?: number): number
```

Converts gas to USD. Default BTC price is `$78,000`.

### Example

```typescript
const response = await contract.execute({ calldata });

const sats = gas2Sat(response.usedGas);
const btc = gas2BTC(response.usedGas);
const usd = gas2USD(response.usedGas, 100_000); // $100k BTC

vm.info(`Gas: ${response.usedGas} = ${sats} sats = ${btc} BTC = $${usd.toFixed(4)}`);
```

---

## StateHandler

**Import:** `import { StateHandler } from '@btc-vision/unit-test-framework'`

Singleton for managing global contract state across the VM:

```typescript
// Override states for a contract
StateHandler.overrideStates(contractAddress, statesMap);

// Mark a contract as deployed
StateHandler.overrideDeployment(contractAddress);

// Read global state
const value = StateHandler.globalLoad(contractAddress, pointer);
const exists = StateHandler.globalHas(contractAddress, pointer);

// Temporary state management (for cross-contract calls)
StateHandler.setTemporaryStates(contractAddress, tempStates);
StateHandler.clearTemporaryStates(contractAddress);
StateHandler.pushAllTempStatesToGlobal();

// Reset
StateHandler.resetGlobalStates(contractAddress);
StateHandler.purgeAll();
```

---

## ConsensusRules

**Import:** `import { ConsensusRules, ConsensusManager } from '@btc-vision/unit-test-framework'`

Bitfield flags for consensus configuration:

```typescript
// Static flags
ConsensusRules.NONE                         // 0b00000000
ConsensusRules.ALLOW_CLASSICAL_SIGNATURES   // 0b00000001
ConsensusRules.UPDATE_CONTRACT_BY_ADDRESS   // 0b00000010

// Create and manipulate
const rules = ConsensusRules.new();
rules.insertFlag(ConsensusRules.ALLOW_CLASSICAL_SIGNATURES);
rules.containsFlag(ConsensusRules.ALLOW_CLASSICAL_SIGNATURES); // true
rules.unsafeSignaturesAllowed(); // true

// Combine flags
const combined = ConsensusRules.combine([
    ConsensusRules.ALLOW_CLASSICAL_SIGNATURES,
    ConsensusRules.UPDATE_CONTRACT_BY_ADDRESS,
]);

// Global consensus manager
ConsensusManager.default(); // Resets to default flags
const flags = ConsensusManager.getFlags();
```

---

## MLDSAMetadata

**Import:** `import { MLDSAMetadata, MLDSASecurityLevel, MLDSAPublicKeyMetadata } from '@btc-vision/unit-test-framework'`

Utility class for ML-DSA key metadata:

```typescript
// Convert between security levels and metadata
const metadata = MLDSAMetadata.fromLevel(MLDSASecurityLevel.Level2);
const level = MLDSAMetadata.toLevel(MLDSAPublicKeyMetadata.MLDSA44);

// Key/signature lengths
const pubKeyLen = MLDSAPublicKeyMetadata.MLDSA44;        // 1312
const privKeyLen = MLDSAMetadata.privateKeyLen(metadata);  // 2560
const sigLen = MLDSAMetadata.signatureLen(metadata);       // 2420

// Name and validation
const name = MLDSAMetadata.name(metadata);    // "ML-DSA-44"
const valid = MLDSAMetadata.isValid(1312);    // true
```

---

## Configuration

**Import:** `import { configs } from '@btc-vision/unit-test-framework'`

```typescript
configs.NETWORK;          // networks.regtest
configs.VERSION_NAME;     // Consensus.Roswell
configs.CONSENSUS;        // Full IOPNetConsensus object
configs.TRACE_GAS;        // false
configs.TRACE_POINTERS;   // false
configs.TRACE_CALLS;      // false
configs.TRACE_DEPLOYMENTS; // false
```

### Consensus Constants

Access consensus parameters through `configs.CONSENSUS`:

```typescript
// Gas
configs.CONSENSUS.GAS.TRANSACTION_MAX_GAS;
configs.CONSENSUS.GAS.EMULATION_MAX_GAS;
configs.CONSENSUS.GAS.TARGET_GAS;
configs.CONSENSUS.GAS.SAT_TO_GAS_RATIO;
configs.CONSENSUS.GAS.PANIC_GAS_COST;
configs.CONSENSUS.GAS.COST.COLD_STORAGE_LOAD;

// Transaction limits
configs.CONSENSUS.TRANSACTIONS.MAXIMUM_CALL_DEPTH;
configs.CONSENSUS.TRANSACTIONS.MAXIMUM_DEPLOYMENT_DEPTH;
configs.CONSENSUS.TRANSACTIONS.REENTRANCY_GUARD;
configs.CONSENSUS.TRANSACTIONS.STORAGE_COST_PER_BYTE;

// Event limits
configs.CONSENSUS.TRANSACTIONS.EVENTS.MAXIMUM_EVENT_LENGTH;
configs.CONSENSUS.TRANSACTIONS.EVENTS.MAXIMUM_TOTAL_EVENT_LENGTH;
configs.CONSENSUS.TRANSACTIONS.EVENTS.MAXIMUM_EVENT_NAME_LENGTH;

// Contract limits
configs.CONSENSUS.CONTRACTS.MAXIMUM_CONTRACT_SIZE_COMPRESSED;
configs.CONSENSUS.CONTRACTS.MAXIMUM_CALLDATA_SIZE_COMPRESSED;

// VM / UTXO
configs.CONSENSUS.VM.UTXOS.MAXIMUM_INPUTS;
configs.CONSENSUS.VM.UTXOS.MAXIMUM_OUTPUTS;
configs.CONSENSUS.VM.UTXOS.OP_RETURN.ENABLED;
configs.CONSENSUS.VM.UTXOS.OP_RETURN.MAXIMUM_SIZE;

// Network
configs.CONSENSUS.NETWORK.MAXIMUM_TRANSACTION_BROADCAST_SIZE;
```

---

[<- Previous: Types & Interfaces](./types-interfaces.md) | [Next: Cross-Contract Calls ->](../advanced/cross-contract-calls.md)

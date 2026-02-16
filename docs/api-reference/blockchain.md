# Blockchain API Reference

The `Blockchain` singleton simulates the OPNet blockchain environment. It manages contracts, blocks, addresses, and transaction context.

**Import:** `import { Blockchain } from '@btc-vision/unit-test-framework'`

---

## Initialization & Cleanup

### `init()`

```typescript
async init(): Promise<void>
```

Initializes the blockchain VM. **Must be called before any contract interaction.**

### `dispose()`

```typescript
dispose(): void
```

Resets the current execution state. Call in `afterEach`.

### `cleanup()`

```typescript
cleanup(): void
```

Full cleanup including VM bindings. Call in `afterAll`.

### `clearContracts()`

```typescript
clearContracts(): void
```

Unregisters all contracts from the blockchain.

---

## Block Management

### `blockNumber`

```typescript
get blockNumber(): bigint
set blockNumber(blockNumber: bigint)
```

Current block height. Default: `1n`.

### `medianTimestamp`

```typescript
get medianTimestamp(): bigint
set medianTimestamp(timestamp: bigint)
```

Median block timestamp.

### `mineBlock()`

```typescript
mineBlock(): void
```

Advances `blockNumber` by 1. Used to test block-boundary behavior like upgrades:

```typescript
await contract.upgrade(v2Address);
Blockchain.mineBlock();
// Upgrade now takes effect
const value = await contract.getValue();
```

---

## Transaction Context

### `msgSender`

```typescript
get msgSender(): Address
set msgSender(sender: Address)
```

The `msg.sender` for contract calls.

### `txOrigin`

```typescript
get txOrigin(): Address
set txOrigin(from: Address)
```

The `tx.origin` for contract calls. Must be a valid tweaked public key.

### `transaction`

```typescript
get transaction(): Transaction | null
set transaction(tx: Transaction | null)
```

The current Bitcoin transaction context (inputs/outputs).

---

## Address Generation

### `generateRandomAddress()`

```typescript
generateRandomAddress(): Address
```

Generates a cryptographically random OPNet address.

### `generateRandomWallet()`

```typescript
generateRandomWallet(): Wallet
```

Generates a full wallet with both ECDSA and ML-DSA keypairs:

```typescript
const wallet = Blockchain.generateRandomWallet();
wallet.address;              // Address
wallet.keypair;              // Secp256k1 keypair
wallet.mldsaKeypair;         // ML-DSA keypair
wallet.quantumPublicKeyHex;  // ML-DSA public key (hex)
```

### `generateAddress(deployer, salt, from)`

```typescript
generateAddress(deployer: Address, salt: Buffer, from: Address): Address
```

Deterministic address generation (CREATE2-style).

### `DEAD_ADDRESS`

```typescript
readonly DEAD_ADDRESS: Address
```

The dead/burn address (`Address.dead()`).

---

## Contract Registry

### `register(contract)`

```typescript
register(contract: ContractRuntime): void
```

Registers a contract with the blockchain. Required for contract-to-contract calls:

```typescript
const tokenA = new OP20({ ... });
const swap = new MySwapContract(deployer, swapAddr);

Blockchain.register(tokenA);
Blockchain.register(swap);
```

### `unregister(contract)`

```typescript
unregister(contract: ContractRuntime): void
```

### `getContract(address)`

```typescript
getContract(address: Address): ContractRuntime
```

Looks up a registered contract by address.

### `isContract(address)`

```typescript
isContract(address: Address): boolean
```

Returns `true` if the address has a registered contract.

---

## Decimal Utilities

### `expandTo18Decimals(n)`

```typescript
expandTo18Decimals(n: number): bigint
```

Converts `n` to `n * 10^18`. Example: `100` -> `100_000_000_000_000_000_000n`.

### `expandToDecimal(n, decimals)`

```typescript
expandToDecimal(n: number, decimals: number): bigint
```

Converts `n` to `n * 10^decimals`.

### `decodeFrom18Decimals(n)`

```typescript
decodeFrom18Decimals(n: bigint): number
```

Converts `n / 10^18` to a number.

### `decodeFromDecimal(n, decimals)`

```typescript
decodeFromDecimal(n: bigint, decimals: number): number
```

### `encodePrice(reserve0, reserve1)`

```typescript
encodePrice(reserve0: bigint, reserve1: bigint): [bigint, bigint]
```

Encodes a price from AMM reserves (UQ112x112 format).

---

## State Management

### `backupStates()`

```typescript
backupStates(): void
```

Saves the current state of all registered contracts.

### `restoreStates()`

```typescript
restoreStates(): void
```

Restores previously backed-up states.

---

## ML-DSA Key Management

### `registerMLDSAPublicKey(address, publicKey)`

```typescript
registerMLDSAPublicKey(address: Address, publicKey: Uint8Array): void
```

Registers an ML-DSA public key for signature verification.

### `getMLDSAPublicKey(address)`

```typescript
getMLDSAPublicKey(address: Address): Uint8Array | undefined
```

---

## Tracking & Debugging

Enable tracing to get detailed output during test execution:

```typescript
// Gas tracing - logs gas usage per call
Blockchain.traceGas = true;
Blockchain.enableGasTracking();
Blockchain.disableGasTracking();

// Storage pointer tracing
Blockchain.tracePointers = true;
Blockchain.enablePointerTracking();
Blockchain.disablePointerTracking();

// Contract call tracing
Blockchain.traceCalls = true;
Blockchain.enableCallTracking();
Blockchain.disableCallTracking();

// Deployment tracing
Blockchain.traceDeployments = true;
```

### `simulateRealEnvironment`

```typescript
simulateRealEnvironment: boolean  // Default: false
```

When `true`, simulates a more realistic execution environment.

### `changeNetwork(network)`

```typescript
changeNetwork(network: Network): void
```

Switch to a different Bitcoin network (e.g., mainnet, testnet).

---

## Properties Summary

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `network` | `Network` | `regtest` | Bitcoin network |
| `blockNumber` | `bigint` | `1n` | Current block height |
| `medianTimestamp` | `bigint` | `BigInt(Date.now())` | Block median time |
| `msgSender` | `Address` | `Address.dead()` | Call sender |
| `txOrigin` | `Address` | `Address.dead()` | Transaction origin |
| `transaction` | `Transaction \| null` | `null` | Current BTC transaction |
| `traceGas` | `boolean` | `false` | Gas logging |
| `tracePointers` | `boolean` | `false` | Storage pointer logging |
| `traceCalls` | `boolean` | `false` | Call logging |
| `traceDeployments` | `boolean` | `false` | Deployment logging |
| `simulateRealEnvironment` | `boolean` | `false` | Realistic mode |
| `DEAD_ADDRESS` | `Address` | `Address.dead()` | Burn address |

---

[<- Previous: Assertions](./assertions.md) | [Next: Contract Runtime ->](./contract-runtime.md)

# Contract Runtime API Reference

`ContractRuntime` is the base class for all contract wrappers. Extend it to create typed interactions with your compiled WASM contracts.

**Import:** `import { ContractRuntime, CallResponse } from '@btc-vision/unit-test-framework'`

---

## Constructor

```typescript
protected constructor(details: ContractDetails)
```

```typescript
interface ContractDetails {
    readonly address: Address;
    readonly deployer: Address;
    readonly gasLimit?: bigint;          // Default: 100_000_000_000_000n
    readonly gasUsed?: bigint;           // Starting gas consumed
    readonly memoryPagesUsed?: bigint;   // Starting memory pages
    readonly deploymentCalldata?: Buffer; // Calldata for onDeploy
    readonly bytecode?: Buffer;          // Override bytecode directly
}
```

---

## Public Properties

| Property | Type | Description |
|----------|------|-------------|
| `address` | `Address` | Contract address |
| `deployer` | `Address` | Deployer address |
| `gasUsed` | `bigint` | Cumulative gas consumed |
| `memoryPagesUsed` | `bigint` | WASM memory pages used |
| `loadedPointers` | `bigint` | Storage pointers loaded |
| `storedPointers` | `bigint` | Storage pointers written |

---

## Lifecycle Methods

### `init()`

```typescript
async init(): Promise<void>
```

Loads bytecode for the contract by calling `defineRequiredBytecodes()`. Does **not** instantiate the VM or run deployment — those happen lazily on first `execute()` call. **Must be called after creating the runtime and before any execution.**

### `dispose()`

```typescript
dispose(): void
```

Frees VM resources. Call in `afterEach`.

### `delete()`

```typescript
delete(): void
```

Permanently deletes the contract instance.

### `deployContract(pushStates)`

```typescript
async deployContract(pushStates: boolean = true): Promise<ExitDataResponse | undefined>
```

Explicitly runs the contract's `onDeploy` handler. Skips if the contract is already deployed (checked via `StateHandler.isDeployed`).

---

## Execution

### `execute(params)`

```typescript
async execute(params: ExecutionParameters): Promise<CallResponse>
```

Executes a contract call:

```typescript
interface ExecutionParameters {
    readonly calldata: Buffer | Uint8Array;  // Encoded function call
    readonly sender?: Address;               // Override msg.sender
    readonly txOrigin?: Address;             // Override tx.origin
    readonly gasUsed?: bigint;               // Starting gas
    readonly memoryPagesUsed?: bigint;       // Starting memory pages
    readonly saveStates?: boolean;           // Persist state changes
}
```

### `onCall(params)`

```typescript
async onCall(params: ExecutionParameters): Promise<CallResponse>
```

Handles incoming calls from other contracts (used internally by the VM for cross-contract calls).

---

## CallResponse

```typescript
class CallResponse {
    status: number;              // 0 = success, 1 = revert
    response: Uint8Array;        // Raw response bytes to decode
    error?: Error;               // Error if reverted
    events: NetEvent[];          // Emitted events
    usedGas: bigint;             // Total gas consumed
    memoryPagesUsed: bigint;     // WASM pages used
    callStack: AddressStack;     // Contract call chain
    touchedAddresses: AddressSet; // Addresses accessed
    touchedBlocks: Set<bigint>;  // Block numbers queried
}
```

---

## State Management

### `setEnvironment(...)`

```typescript
setEnvironment(
    msgSender?: Address,
    txOrigin?: Address,
    currentBlock?: bigint,
    deployer?: Address,
    address?: Address
): void
```

Updates the execution environment for this contract.

### `applyStatesOverride(override)`

```typescript
applyStatesOverride(override: StateOverride): void
```

Applies state from another execution context:

```typescript
interface StateOverride {
    events: NetEvent[];
    callStack: AddressStack;
    touchedAddresses: AddressSet;
    touchedBlocks: Set<bigint>;
    totalEventLength: number;
    loadedPointers: bigint;
    storedPointers: bigint;
    memoryPagesUsed: bigint;
}
```

### `backupStates()` / `restoreStates()`

```typescript
backupStates(): void
restoreStates(): void
```

Save and restore contract state for test isolation.

### `resetStates()`

```typescript
resetStates(): void
```

Resets all contract state.

---

## Protected Members

These are available when extending `ContractRuntime`:

| Member | Type | Description |
|--------|------|-------------|
| `abiCoder` | `ABICoder` | ABI encoder for selectors |
| `states` | `FastMap<bigint, bigint>` | Persistent storage |
| `transient` | `FastMap<bigint, bigint>` | Transient storage |
| `deploymentStates` | `FastMap<bigint, bigint>` | Deployment state |
| `events` | `NetEvent[]` | Emitted events |
| `gasMax` | `bigint` | Gas limit (`100_000_000_000_000n`) |
| `deployedContracts` | `AddressMap<Buffer>` | Contracts deployed by this contract |
| `_bytecode` | `Buffer \| undefined` | Raw bytecode |

### Protected Methods

```typescript
// Optional override: custom error wrapping
// Default returns: new Error(`(in: ${this.constructor.name}) OP_NET: ${error}`)
protected handleError(error: Error): Error

// Optional override: load WASM bytecode
// Default uses `bytecode` from ContractDetails if provided, otherwise throws "Not implemented".
// Override this to call BytecodeManager.loadBytecode() for file-based loading.
protected defineRequiredBytecodes(): void

// Execute and throw on error
protected async executeThrowOnError(params: ExecutionParameters): Promise<CallResponse>

// Calculate gas cost for saves
protected calculateGasCostSave(response: CallResponse): bigint
```

---

## BytecodeManager

**Import:** `import { BytecodeManager } from '@btc-vision/unit-test-framework'`

Singleton that manages WASM bytecode loading:

```typescript
// Load bytecode from file
BytecodeManager.loadBytecode('./path/to/Contract.wasm', contractAddress);

// Get loaded bytecode
const bytecode = BytecodeManager.getBytecode(contractAddress);

// Set bytecode directly (no-op if already set for this address)
BytecodeManager.setBytecode(contractAddress, buffer);

// Force-set (overwrites existing, use when you need to replace bytecode)
BytecodeManager.forceSetBytecode(contractAddress, buffer);

// Get filename for address
const filename = BytecodeManager.getFileName(contractAddress);

// Clear all loaded bytecodes
BytecodeManager.clear();
```

---

## Usage Pattern

```typescript
export class MyContract extends ContractRuntime {
    private readonly mySelector = this.getSelector('myMethod(uint256)');

    constructor(deployer: Address, address: Address) {
        super({ address, deployer, gasLimit: 150_000_000_000n });
    }

    public async myMethod(value: bigint): Promise<bigint> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.mySelector);
        calldata.writeU256(value);

        const response = await this.execute({ calldata: calldata.getBuffer() });
        if (response.error) throw this.handleError(response.error);
        if (!response.response) throw new Error('No response');

        return new BinaryReader(response.response).readU256();
    }

    protected handleError(error: Error): Error {
        return new Error(`(MyContract) ${error.message}`);
    }

    protected defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode('./MyContract.wasm', this.address);
    }

    private getSelector(sig: string): number {
        return Number(`0x${this.abiCoder.encodeSelector(sig)}`);
    }
}
```

---

[<- Previous: Blockchain](./blockchain.md) | [Next: Types & Interfaces ->](./types-interfaces.md)

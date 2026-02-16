# Types & Interfaces Reference

Complete reference for all exported TypeScript types and interfaces.

---

## CallResponse

```typescript
interface ICallResponse {
    exitData: ExitDataResponse;
    events: NetEvent[];
    callStack: AddressStack;
    touchedAddresses: AddressSet;
    touchedBlocks: Set<bigint>;
    memoryPagesUsed: bigint;
}

class CallResponse {
    status: number;              // 0 = success, 1 = revert
    response: Uint8Array;        // Raw response bytes
    error?: Error;               // Populated automatically on revert
    events: NetEvent[];
    callStack: AddressStack;
    touchedAddresses: AddressSet;
    touchedBlocks: Set<bigint>;
    memoryPagesUsed: bigint;
    usedGas: bigint;
}
```

---

## ContractDetails

```typescript
interface ContractDetails {
    readonly address: Address;
    readonly deployer: Address;
    readonly gasLimit?: bigint;
    readonly gasUsed?: bigint;
    readonly memoryPagesUsed?: bigint;
    readonly deploymentCalldata?: Buffer;
    readonly bytecode?: Buffer;
}
```

---

## ExecutionParameters

```typescript
interface ExecutionParameters {
    readonly calldata: Buffer | Uint8Array;
    readonly sender?: Address;
    readonly txOrigin?: Address;
    readonly gasUsed?: bigint;
    readonly memoryPagesUsed?: bigint;
    readonly saveStates?: boolean;
}
```

---

## StateOverride

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

---

## Transaction Types

```typescript
interface ITransactionInput {
    readonly txHash: Uint8Array;
    readonly outputIndex: number;
    readonly scriptSig: Uint8Array;
    readonly flags: number;
    readonly coinbase?: Buffer;
}

interface ITransactionOutput {
    readonly index: number;
    readonly to?: string;
    readonly value: bigint;
    readonly scriptPubKey?: Uint8Array;
    readonly flags: number;
}

class TransactionInput {
    readonly txHash: Uint8Array;
    readonly outputIndex: number;
    readonly scriptSig: Uint8Array;
    readonly flags: number;
    readonly coinbase?: Buffer;
    constructor(params: ITransactionInput)
}

class TransactionOutput {
    readonly index: number;
    readonly to?: string;
    readonly value: bigint;
    readonly scriptPubKey: Uint8Array | undefined;
    readonly flags: number;
    constructor(params: ITransactionOutput)
}

class Transaction {
    readonly id: Uint8Array;
    readonly inputs: TransactionInput[];
    readonly outputs: TransactionOutput[];
    constructor(id: Uint8Array, inputs: TransactionInput[], outputs: TransactionOutput[], addDefault?: boolean)
    addOutput(value: bigint, receiver: string | undefined, scriptPubKey?: Uint8Array): void
    addInput(txHash: Uint8Array, outputIndex: number, scriptSig: Uint8Array): void
    addInputWithFlags(input: TransactionInput): void
    addOutputWithFlags(output: TransactionOutput): void
    serializeInputs(): Uint8Array
    serializeOutputs(): Uint8Array
}
```

---

## RustContractBinding

The interface for VM bindings between TypeScript and the Rust VM:

```typescript
interface RustContractBinding {
    readonly id: bigint;
    readonly load: (data: Buffer) => Promise<Buffer | Uint8Array>;
    readonly store: (data: Buffer) => Promise<Buffer | Uint8Array>;
    readonly tLoad: (data: Buffer) => Promise<Buffer | Uint8Array>;
    readonly tStore: (data: Buffer) => Promise<Buffer | Uint8Array>;
    readonly call: (data: Buffer) => Promise<Buffer | Uint8Array>;
    readonly deployContractAtAddress: (data: Buffer) => Promise<Buffer | Uint8Array>;
    readonly updateFromAddress: (data: Buffer) => Promise<Buffer | Uint8Array>;
    readonly loadMLDSA: (data: Buffer) => Promise<Buffer | Uint8Array>;
    readonly log: (data: Buffer) => void;
    readonly emit: (data: Buffer) => void;
    readonly inputs: () => Promise<Buffer | Uint8Array>;
    readonly outputs: () => Promise<Buffer | Uint8Array>;
    readonly accountType: (data: Buffer) => Promise<AccountTypeResponse>;
    readonly blockHash: (blockNumber: bigint) => Promise<BlockHashResponse>;
}
```

---

## ContractParameters

```typescript
interface ContractParameters extends Omit<RustContractBinding, 'id'> {
    readonly address: string;
    readonly bytecode: Buffer;
    readonly gasMax: bigint;
    readonly gasUsed: bigint;
    readonly memoryPagesUsed: bigint;
    readonly network: BitcoinNetworkRequest;
    readonly isDebugMode: boolean;
    readonly bypassCache?: boolean;
    readonly contractManager: ContractManager;
}
```

---

## Consensus Types

```typescript
interface IOPNetConsensus<T extends Consensus> {
    readonly CONSENSUS: T;
    readonly CONSENSUS_NAME: string;
    readonly GENERIC: {
        readonly ENABLED_AT_BLOCK: bigint;
        readonly NEXT_CONSENSUS: Consensus;
        readonly NEXT_CONSENSUS_BLOCK: bigint;
        readonly IS_READY_FOR_NEXT_CONSENSUS: boolean;
        readonly ALLOW_LEGACY: boolean;
    };
    readonly POW: {
        readonly PREIMAGE_LENGTH: number;
    };
    readonly CONTRACTS: {
        readonly MAXIMUM_CONTRACT_SIZE_COMPRESSED: number;
        readonly MAXIMUM_CALLDATA_SIZE_COMPRESSED: number;
    };
    readonly COMPRESSION: {
        readonly MAX_DECOMPRESSED_SIZE: number;
    };
    readonly GAS: {
        readonly COST: { readonly COLD_STORAGE_LOAD: bigint };
        readonly GAS_PENALTY_FACTOR: bigint;
        readonly TARGET_GAS: bigint;
        readonly SMOOTH_OUT_GAS_INCREASE: bigint;
        readonly MAX_THEORETICAL_GAS: bigint;
        readonly TRANSACTION_MAX_GAS: bigint;
        readonly EMULATION_MAX_GAS: bigint;
        readonly PANIC_GAS_COST: bigint;
        readonly SAT_TO_GAS_RATIO: bigint;
        readonly MIN_BASE_GAS: number;
        readonly SMOOTHING_FACTOR: number;
        readonly ALPHA1: number;
        readonly ALPHA2: number;
        readonly U_TARGET: number;
    };
    readonly TRANSACTIONS: {
        readonly EVENTS: {
            readonly MAXIMUM_EVENT_LENGTH: number;
            readonly MAXIMUM_TOTAL_EVENT_LENGTH: number;
            readonly MAXIMUM_EVENT_NAME_LENGTH: number;
        };
        readonly MAXIMUM_RECEIPT_LENGTH: number;
        readonly MAXIMUM_DEPLOYMENT_DEPTH: number;
        readonly MAXIMUM_CALL_DEPTH: number;
        readonly STORAGE_COST_PER_BYTE: bigint;
        readonly REENTRANCY_GUARD: boolean;
        readonly SKIP_PROOF_VALIDATION_FOR_EXECUTION_BEFORE_TRANSACTION: boolean;
        readonly ENABLE_ACCESS_LIST: boolean;
    };
    readonly VM: {
        readonly CURRENT_DEPLOYMENT_VERSION: number;
        readonly UTXOS: {
            readonly MAXIMUM_INPUTS: number;
            readonly MAXIMUM_OUTPUTS: number;
            readonly WRITE_FLAGS: boolean;
            readonly INPUTS: { readonly WRITE_COINBASE: boolean };
            readonly OUTPUTS: { readonly WRITE_SCRIPT_PUB_KEY: boolean };
            readonly OP_RETURN: { readonly ENABLED: boolean; readonly MAXIMUM_SIZE: number };
        };
    };
    readonly NETWORK: {
        readonly MAXIMUM_TRANSACTION_BROADCAST_SIZE: number;
        readonly PSBT_MAXIMUM_TRANSACTION_BROADCAST_SIZE: number;
    };
    readonly PSBT: {
        readonly MINIMAL_PSBT_ACCEPTANCE_FEE_VB_PER_SAT: bigint;
    };
}

type IOPNetConsensusObj = { [key in Consensus]?: IOPNetConsensus<key> };
```

---

## ML-DSA Types

```typescript
enum MLDSASecurityLevel {
    Level2 = 0,
    Level3 = 1,
    Level5 = 2,
}

enum MLDSAPublicKeyMetadata {
    MLDSA44 = 1312,
    MLDSA65 = 1952,
    MLDSA87 = 2592,
}
```

### Constants

```typescript
const MLDSA44_PUBLIC_KEY_LEN = 1312;
const MLDSA65_PUBLIC_KEY_LEN = 1952;
const MLDSA87_PUBLIC_KEY_LEN = 2592;
const MLDSA44_PRIVATE_KEY_LEN = 2560;
const MLDSA65_PRIVATE_KEY_LEN = 4032;
const MLDSA87_PRIVATE_KEY_LEN = 4896;
const MLDSA44_SIGNATURE_LEN = 2420;
const MLDSA65_SIGNATURE_LEN = 3309;
const MLDSA87_SIGNATURE_LEN = 4627;
```

---

## OP20 Event Types

```typescript
interface TransferredEvent {
    readonly operator: Address;
    readonly from: Address;
    readonly to: Address;
    readonly value: bigint;
}

interface MintedEvent {
    readonly to: Address;
    readonly value: bigint;
}

interface BurnedEvent {
    readonly from: Address;
    readonly value: bigint;
}

interface ApprovedEvent {
    readonly owner: Address;
    readonly spender: Address;
    readonly value: bigint;
}

interface OP20Metadata {
    readonly name: string;
    readonly symbol: string;
    readonly decimals: number;
    readonly totalSupply: bigint;
    readonly maximumSupply: bigint;
    readonly icon: string;
    readonly domainSeparator: Uint8Array;
}
```

---

## OP721 Event Types

```typescript
interface TransferredEventNFT {
    readonly operator: Address;
    readonly from: Address;
    readonly to: Address;
    readonly tokenId: bigint;
}

interface ApprovedEventNFT {
    readonly owner: Address;
    readonly approved: Address;
    readonly tokenId: bigint;
}

interface ApprovedForAllEvent {
    readonly owner: Address;
    readonly operator: Address;
    readonly approved: boolean;
}

interface URIEvent {
    readonly uri: string;
    readonly tokenId: bigint;
}
```

---

## OP721Extended Event Types

```typescript
interface ReservationCreatedEvent {
    readonly user: Address;
    readonly amount: bigint;
    readonly blockNumber: bigint;
    readonly feePaid: bigint;
}

interface ReservationClaimedEvent {
    readonly user: Address;
    readonly amount: bigint;
    readonly startTokenId: bigint;
}

interface ReservationExpiredEvent {
    readonly blockNumber: bigint;
    readonly totalExpired: bigint;
}

interface MintStatusChangedEvent {
    readonly enabled: boolean;
}

interface OP721ExtendedStatus {
    readonly minted: bigint;
    readonly reserved: bigint;
    readonly available: bigint;
    readonly maxSupply: bigint;
    readonly blocksWithReservations: number;
    readonly pricePerToken: bigint;
    readonly reservationFeePercent: bigint;
    readonly minReservationFee: bigint;
}
```

---

## Full Export List

```typescript
import {
    // Test Runner
    opnet, OPNetUnit,

    // Assertions
    Assert, Assertion,

    // Blockchain
    Blockchain,

    // Contract Runtime
    ContractRuntime, CallResponse, BytecodeManager,

    // VM Internals
    RustContract, StateHandler,

    // Interfaces
    ContractDetails, ExecutionParameters, StateOverride,
    RustContractBinding, ContractParameters,

    // Token Helpers
    OP20, OP721, OP721Extended,

    // Transaction
    Transaction, TransactionInput, TransactionOutput,
    generateTransactionId, generateEmptyTransaction,

    // Consensus
    ConsensusRules, ConsensusManager,
    RoswellConsensus, ConsensusMetadata,

    // Consensus Interfaces
    IOPNetConsensus, IOPNetConsensusObj,

    // ML-DSA
    MLDSAMetadata, MLDSASecurityLevel, MLDSAPublicKeyMetadata,
    MLDSAPublicKeyCache,

    // Utilities
    gas2Sat, sat2BTC, gas2BTC, gas2USD,

    // Benchmarking
    CustomMap, runBenchmarks,

    // Configuration
    configs,
} from '@btc-vision/unit-test-framework';
```

---

[<- Previous: Contract Runtime](./contract-runtime.md) | [Next: Utilities ->](./utilities.md)

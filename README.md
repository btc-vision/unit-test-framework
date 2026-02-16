# OPNet Unit Test Framework

![Bitcoin](https://img.shields.io/badge/Bitcoin-000?style=for-the-badge&logo=bitcoin&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![AssemblyScript](https://img.shields.io/badge/assembly%20script-%23000000.svg?style=for-the-badge&logo=assemblyscript&logoColor=white)
![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![NPM](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

The official unit testing framework for OPNet smart contracts. Test your AssemblyScript contracts against the real OP_VM runtime with full TypeScript support, gas metering, state management, and built-in helpers for OP20/OP721 tokens.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Test Structure](#test-structure)
  - [Blockchain Simulator](#blockchain-simulator)
  - [Contract Runtime](#contract-runtime)
  - [Bytecode Management](#bytecode-management)
- [Writing Tests](#writing-tests)
  - [Basic Test](#basic-test)
  - [Testing OP20 Tokens](#testing-op20-tokens)
  - [Testing OP721 NFTs](#testing-op721-nfts)
  - [Testing Custom Contracts](#testing-custom-contracts)
- [Assertions](#assertions)
  - [Static Methods](#static-methods)
  - [Fluent API](#fluent-api)
- [Contract Runtime API](#contract-runtime-api)
  - [Creating a Runtime Wrapper](#creating-a-runtime-wrapper)
  - [Execution](#execution)
  - [State Management](#state-management)
  - [Environment](#environment)
- [Blockchain API](#blockchain-api)
  - [Block Management](#block-management)
  - [Address Generation](#address-generation)
  - [Contract Registry](#contract-registry)
  - [Decimal Utilities](#decimal-utilities)
  - [Tracking & Debugging](#tracking--debugging)
- [Built-in Contract Helpers](#built-in-contract-helpers)
  - [OP20](#op20)
  - [OP721](#op721)
  - [OP721Extended](#op721extended)
- [Advanced Topics](#advanced-topics)
  - [Contract-to-Contract Calls](#contract-to-contract-calls)
  - [Upgradeable Contracts](#upgradeable-contracts)
  - [Transaction Simulation](#transaction-simulation)
  - [Signature Verification](#signature-verification)
  - [State Overrides & Block Replay](#state-overrides--block-replay)
  - [Gas Profiling](#gas-profiling)
  - [Consensus Rules](#consensus-rules)
- [Utilities](#utilities)
- [Running Tests](#running-tests)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

```bash
npm install @btc-vision/unit-test-framework
```

### Peer Dependencies

The framework requires `@btc-vision/transaction` and `@btc-vision/bitcoin` which are installed automatically as transitive dependencies.

### Requirements

- Node.js >= 22
- Rust toolchain (for building `@btc-vision/op-vm`)

---

## Quick Start

```typescript
import { opnet, OPNetUnit, Assert, Blockchain, OP20 } from '@btc-vision/unit-test-framework';
import { Address } from '@btc-vision/transaction';

await opnet('My Token Tests', async (vm: OPNetUnit) => {
    let token: OP20;

    const deployer: Address = Blockchain.generateRandomAddress();
    const receiver: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        token = new OP20({
            address: Blockchain.generateRandomAddress(),
            deployer: deployer,
            file: './path/to/MyToken.wasm',
            decimals: 18,
        });

        Blockchain.register(token);
        await token.init();
    });

    vm.afterEach(() => {
        token.dispose();
        Blockchain.dispose();
    });

    await vm.it('should mint tokens', async () => {
        await token.mint(receiver, 1000);

        const balance = await token.balanceOf(receiver);
        Assert.expect(balance).toEqual(Blockchain.expandToDecimal(1000, 18));
    });
});
```

Run with:

```bash
npx tsx test/my-token.test.ts
```

---

## Core Concepts

### Test Structure

Tests are organized using the `opnet` function, which provides a test runner (`OPNetUnit`) with lifecycle hooks:

```typescript
import { opnet, OPNetUnit } from '@btc-vision/unit-test-framework';

await opnet('Test Suite Name', async (vm: OPNetUnit) => {
    // Runs once before all tests
    vm.beforeAll(async () => { /* setup */ });

    // Runs before each test
    vm.beforeEach(async () => { /* setup */ });

    // Runs after each test
    vm.afterEach(async () => { /* cleanup */ });

    // Runs once after all tests
    vm.afterAll(async () => { /* cleanup */ });

    // Define a test
    await vm.it('should do something', async () => {
        // test logic
    });
});
```

**Logging inside tests:**

```typescript
await vm.it('my test', async () => {
    vm.log('General log message');
    vm.info('Info message');
    vm.success('Success message');
    vm.warn('Warning message');
    vm.error('Error message');
    vm.debug('Debug message');
    vm.panic('Fatal error message');
});
```

### Blockchain Simulator

The `Blockchain` singleton simulates the OPNet blockchain environment. It manages contracts, blocks, addresses, and transaction context.

```typescript
import { Blockchain } from '@btc-vision/unit-test-framework';

// Always initialize before use
await Blockchain.init();

// Set block context
Blockchain.blockNumber = 100n;
Blockchain.medianTimestamp = BigInt(Date.now());

// Set transaction context
Blockchain.msgSender = someAddress;
Blockchain.txOrigin = someAddress;

// Clean up after tests
Blockchain.dispose();
```

### Contract Runtime

`ContractRuntime` is the base class for interacting with compiled WASM contracts. You extend it to create typed wrappers for your specific contracts.

### Bytecode Management

`BytecodeManager` maps WASM file paths to contract addresses. Each contract runtime calls `BytecodeManager.loadBytecode()` in its `defineRequiredBytecodes()` method.

```typescript
import { BytecodeManager } from '@btc-vision/unit-test-framework';

// Load bytecode manually
BytecodeManager.loadBytecode('./path/to/Contract.wasm', contractAddress);

// Get loaded bytecode
const bytecode = BytecodeManager.getBytecode(contractAddress);

// Clear all loaded bytecodes
BytecodeManager.clear();
```

---

## Writing Tests

### Basic Test

The minimal test pattern:

```typescript
import { opnet, OPNetUnit, Assert, Blockchain } from '@btc-vision/unit-test-framework';

await opnet('Basic Tests', async (vm: OPNetUnit) => {
    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();
    });

    vm.afterEach(() => {
        Blockchain.dispose();
    });

    await vm.it('should generate random addresses', async () => {
        const addr1 = Blockchain.generateRandomAddress();
        const addr2 = Blockchain.generateRandomAddress();
        Assert.expect(addr1).toNotEqual(addr2);
    });
});
```

### Testing OP20 Tokens

The framework provides a built-in `OP20` class with all standard token methods:

```typescript
import { opnet, OPNetUnit, Assert, Blockchain, OP20 } from '@btc-vision/unit-test-framework';
import { Address } from '@btc-vision/transaction';

await opnet('OP20 Token Tests', async (vm: OPNetUnit) => {
    let token: OP20;

    const deployer: Address = Blockchain.generateRandomAddress();
    const alice: Address = Blockchain.generateRandomAddress();
    const bob: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        token = new OP20({
            address: Blockchain.generateRandomAddress(),
            deployer: deployer,
            file: './bytecodes/MyToken.wasm',
            decimals: 18,
        });

        Blockchain.register(token);
        await token.init();

        // Set the sender context
        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;
    });

    vm.afterEach(() => {
        token.dispose();
        Blockchain.dispose();
    });

    await vm.it('should mint tokens', async () => {
        await token.mint(alice, 1000);

        const balance = await token.balanceOf(alice);
        Assert.expect(balance).toEqual(Blockchain.expandToDecimal(1000, 18));
    });

    await vm.it('should transfer tokens', async () => {
        await token.mint(alice, 500);

        const transferAmount = Blockchain.expandToDecimal(100, 18);
        await token.safeTransfer(alice, bob, transferAmount);

        const aliceBalance = await token.balanceOf(alice);
        const bobBalance = await token.balanceOf(bob);

        Assert.expect(bobBalance).toEqual(transferAmount);
        Assert.expect(aliceBalance).toEqual(Blockchain.expandToDecimal(400, 18));
    });

    await vm.it('should read total supply', async () => {
        const supply = await token.totalSupply();
        Assert.expect(supply).toBeGreaterThanOrEqual(0n);
    });

    await vm.it('should manage allowances', async () => {
        const amount = Blockchain.expandToDecimal(50, 18);
        await token.increaseAllowance(alice, bob, amount);

        const allowance = await token.allowance(alice, bob);
        Assert.expect(allowance).toEqual(amount);
    });

    await vm.it('should burn tokens', async () => {
        await token.mint(alice, 100);
        const amount = Blockchain.expandToDecimal(100, 18);
        const response = await token.burn(alice, amount);

        Assert.expect(response.usedGas).toBeGreaterThan(0n);
    });

    await vm.it('should decode transfer events', async () => {
        await token.mint(alice, 100);

        const amount = Blockchain.expandToDecimal(50, 18);
        const response = await token.safeTransfer(alice, bob, amount);

        // Decode events from the response
        for (const event of response.events) {
            if (event.type === 'Transfer') {
                const decoded = OP20.decodeTransferredEvent(event.data);
                Assert.expect(decoded.to).toEqualAddress(bob);
                Assert.expect(decoded.value).toEqual(amount);
            }
        }
    });

    await vm.it('should read token metadata', async () => {
        const { metadata } = await token.metadata();

        vm.info(`Name: ${metadata.name}`);
        vm.info(`Symbol: ${metadata.symbol}`);
        vm.info(`Decimals: ${metadata.decimals}`);
    });
});
```

### Testing OP721 NFTs

```typescript
import { opnet, OPNetUnit, Assert, Blockchain, OP721 } from '@btc-vision/unit-test-framework';
import { Address } from '@btc-vision/transaction';

await opnet('OP721 NFT Tests', async (vm: OPNetUnit) => {
    let nft: OP721;

    const deployer: Address = Blockchain.generateRandomAddress();
    const alice: Address = Blockchain.generateRandomAddress();
    const bob: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        nft = new OP721({
            address: Blockchain.generateRandomAddress(),
            deployer: deployer,
            file: './bytecodes/MyNFT.wasm',
        });

        Blockchain.register(nft);
        await nft.init();

        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should read collection info', async () => {
        const name = await nft.name();
        const symbol = await nft.symbol();
        const maxSupply = await nft.maxSupply();

        vm.info(`Collection: ${name} (${symbol}) - Max: ${maxSupply}`);
    });

    await vm.it('should transfer an NFT', async () => {
        // Transfer token #1 from alice to bob
        const tokenId = 1n;
        await nft.transferFrom(alice, bob, tokenId, alice);

        const owner = await nft.ownerOf(tokenId);
        Assert.expect(owner).toEqualAddress(bob);
    });

    await vm.it('should approve and transfer', async () => {
        const tokenId = 1n;
        await nft.approve(bob, tokenId, alice);

        const approved = await nft.getApproved(tokenId);
        Assert.expect(approved).toEqualAddress(bob);
    });
});
```

### Testing Custom Contracts

For custom contracts, extend `ContractRuntime` to create a typed wrapper:

```typescript
import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { BytecodeManager, CallResponse, ContractRuntime } from '@btc-vision/unit-test-framework';

export class MyContractRuntime extends ContractRuntime {
    // Define selectors by encoding the function signature
    private readonly getValueSelector: number = this.getSelector('getValue()');
    private readonly setValueSelector: number = this.getSelector('setValue(uint256)');
    private readonly storeSelector: number = this.getSelector('store(bytes32,bytes32)');

    public constructor(deployer: Address, address: Address, gasLimit: bigint = 150_000_000_000n) {
        super({
            address: address,
            deployer: deployer,
            gasLimit,
        });
    }

    // Read method
    public async getValue(): Promise<bigint> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.getValueSelector);

        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);

        const reader = new BinaryReader(response.response);
        return reader.readU256();
    }

    // Write method
    public async setValue(value: bigint): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.setValueSelector);
        calldata.writeU256(value);

        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
        return response;
    }

    // Storage method
    public async store(key: Uint8Array, value: Uint8Array): Promise<void> {
        const calldata = new BinaryWriter(68);
        calldata.writeSelector(this.storeSelector);
        calldata.writeBytes(key);
        calldata.writeBytes(value);

        const response = await this.execute({ calldata: calldata.getBuffer() });
        this.handleResponse(response);
    }

    // Required: handle errors with context
    protected handleError(error: Error): Error {
        return new Error(`(in MyContract: ${this.address}) OP_NET: ${error.message}`);
    }

    // Required: load the WASM bytecode
    protected defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode('./path/to/MyContract.wasm', this.address);
    }

    // Helper: encode a function signature to a 4-byte selector
    private getSelector(signature: string): number {
        return Number(`0x${this.abiCoder.encodeSelector(signature)}`);
    }

    // Helper: check response for errors
    private handleResponse(response: CallResponse): void {
        if (response.error) throw this.handleError(response.error);
        if (!response.response) {
            throw new Error('No response to decode');
        }
    }
}
```

Then use it in tests:

```typescript
import { opnet, OPNetUnit, Assert, Blockchain } from '@btc-vision/unit-test-framework';
import { MyContractRuntime } from './MyContractRuntime';

await opnet('MyContract Tests', async (vm: OPNetUnit) => {
    let contract: MyContractRuntime;
    const deployer = Blockchain.generateRandomAddress();
    const contractAddress = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        contract = new MyContractRuntime(deployer, contractAddress);
        Blockchain.register(contract);
        await contract.init();

        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;
    });

    vm.afterEach(() => {
        contract.dispose();
        Blockchain.dispose();
    });

    await vm.it('should store and retrieve a value', async () => {
        await contract.setValue(42n);
        const value = await contract.getValue();
        Assert.expect(value).toEqual(42n);
    });
});
```

---

## Assertions

### Static Methods

```typescript
import { Assert } from '@btc-vision/unit-test-framework';

Assert.equal(actual, expected, 'optional message');
Assert.notEqual(actual, unexpected);
Assert.deepEqual(actualObj, expectedObj);
Assert.toBeCloseTo(actualBigint, expectedBigint, toleranceBigint);
Assert.throws(() => { throw new Error('boom'); }, 'boom');
await Assert.throwsAsync(async () => { throw new Error('boom'); }, /boom/);
```

### Fluent API

```typescript
Assert.expect(value).toEqual(expected);
Assert.expect(value).toNotEqual(other);
Assert.expect(value).toDeepEqual(expected);
Assert.expect(value).toBeDefined();
Assert.expect(value).toBeUndefined();
Assert.expect(value).toBeGreaterThan(other);
Assert.expect(value).toBeGreaterThanOrEqual(other);
Assert.expect(value).toBeLessThan(other);
Assert.expect(value).toBeLessThanOrEqual(other);
Assert.expect(address).toEqualAddress(otherAddress);
Assert.expect(addressList).toEqualAddressList(expectedList);
await Assert.expect(asyncFn).toThrow('expected error');
await Assert.expect(asyncFn).toNotThrow();
```

---

## Contract Runtime API

### Creating a Runtime Wrapper

Every custom contract extends `ContractRuntime`:

```typescript
import { ContractRuntime } from '@btc-vision/unit-test-framework';

export class MyContract extends ContractRuntime {
    protected constructor(details: ContractDetails) {
        super(details);
    }

    protected handleError(error: Error): Error {
        return new Error(`MyContract: ${error.message}`);
    }

    protected defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode('./MyContract.wasm', this.address);
    }
}
```

**`ContractDetails` interface:**

```typescript
interface ContractDetails {
    readonly address: Address;
    readonly deployer: Address;
    readonly gasLimit?: bigint;         // Default: 100_000_000_000_000n
    readonly gasUsed?: bigint;          // Starting gas used
    readonly memoryPagesUsed?: bigint;  // Starting memory pages
    readonly deploymentCalldata?: Buffer; // Calldata for onDeploy
    readonly bytecode?: Buffer;         // Override bytecode directly
}
```

### Execution

```typescript
// Execute a contract call
const response: CallResponse = await contract.execute({
    calldata: buffer,        // Encoded function call
    sender?: address,        // Override msg.sender
    txOrigin?: address,      // Override tx.origin
    gasUsed?: bigint,        // Starting gas
    memoryPagesUsed?: bigint,// Starting memory pages
    saveStates?: boolean,    // Whether to persist state changes
});

// Response structure
response.status;          // Exit status code
response.response;        // Raw response bytes (Uint8Array)
response.error;           // Error if execution failed
response.events;          // Emitted events (NetEvent[])
response.usedGas;         // Total gas consumed (bigint)
response.memoryPagesUsed; // Memory pages used (bigint)
response.callStack;       // Contract call stack
response.touchedAddresses;// Addresses accessed
response.touchedBlocks;   // Block numbers accessed
```

### State Management

```typescript
// Reset contract state
contract.resetStates();

// Backup and restore state for isolation
contract.backupStates();
// ... make changes ...
contract.restoreStates();

// Apply state from another execution
contract.applyStatesOverride(stateOverride);

// Deploy contract (runs onDeploy)
await contract.deployContract();

// Dispose contract (free resources)
contract.dispose();
```

### Environment

```typescript
// Set execution environment
contract.setEnvironment(
    msgSender,    // Address
    txOrigin,     // Address
    currentBlock, // bigint
    deployer,     // Address
    address,      // Address
);
```

---

## Blockchain API

### Block Management

```typescript
// Get/set current block
Blockchain.blockNumber = 100n;
const currentBlock = Blockchain.blockNumber;

// Get/set median timestamp
Blockchain.medianTimestamp = BigInt(Date.now());

// Mine a block (increments blockNumber by 1)
Blockchain.mineBlock();
```

### Address Generation

```typescript
// Generate a random address
const address: Address = Blockchain.generateRandomAddress();

// Generate a random wallet (with keypair and ML-DSA keys)
const wallet = Blockchain.generateRandomWallet();
wallet.address;           // Address
wallet.keypair;           // Secp256k1 keypair
wallet.mldsaKeypair;      // ML-DSA keypair
wallet.quantumPublicKeyHex; // ML-DSA public key hex

// Deterministic address generation
const addr = Blockchain.generateAddress(deployer, salt, from);

// Dead address constant
const dead = Blockchain.DEAD_ADDRESS;
```

### Contract Registry

```typescript
// Register a contract with the blockchain
Blockchain.register(contract);

// Unregister
Blockchain.unregister(contract);

// Lookup a contract by address
const contract = Blockchain.getContract(address);

// Check if an address is a contract
const isContract = Blockchain.isContract(address);

// Clear all registered contracts
Blockchain.clearContracts();
```

### Decimal Utilities

```typescript
// Expand to 18 decimals: 100 -> 100_000_000_000_000_000_000n
const amount = Blockchain.expandTo18Decimals(100);

// Expand to N decimals
const amount8 = Blockchain.expandToDecimal(100, 8);

// Decode from 18 decimals: 100_000_000_000_000_000_000n -> 100
const num = Blockchain.decodeFrom18Decimals(amount);

// Decode from N decimals
const num8 = Blockchain.decodeFromDecimal(amount8, 8);

// Encode price from reserves (for AMM pools)
const [price0, price1] = Blockchain.encodePrice(reserve0, reserve1);
```

### Tracking & Debugging

```typescript
// Enable gas tracking (logs gas usage per call)
Blockchain.traceGas = true;
Blockchain.enableGasTracking();

// Enable storage pointer tracking
Blockchain.tracePointers = true;
Blockchain.enablePointerTracking();

// Enable contract call tracking
Blockchain.traceCalls = true;
Blockchain.enableCallTracking();

// Enable deployment tracking
Blockchain.traceDeployments = true;

// Disable tracking
Blockchain.disableGasTracking();
Blockchain.disablePointerTracking();
Blockchain.disableCallTracking();
```

---

## Built-in Contract Helpers

### OP20

Complete OP20 (fungible token) implementation:

```typescript
import { OP20 } from '@btc-vision/unit-test-framework';

const token = new OP20({
    address: contractAddress,
    deployer: deployerAddress,
    file: './MyToken.wasm',
    decimals: 18,
});

// Read methods
await token.totalSupply();                              // bigint
await token.balanceOf(owner);                           // bigint
await token.balanceOfNoDecimals(owner);                 // number
await token.allowance(owner, spender);                  // bigint
await token.nonceOf(owner);                             // bigint
await token.metadata();                                 // { metadata, response }
await token.domainSeparator();                          // Uint8Array

// Write methods
await token.mint(to, amount);                           // void (amount in whole tokens)
await token.mintRaw(to, amountBigint);                  // void (amount in raw units)
await token.safeTransfer(from, to, amount);             // CallResponse
await token.safeTransferFrom(from, to, amount);         // void
await token.burn(from, amount);                         // CallResponse
await token.airdrop(addressMap);                        // CallResponse
await token.increaseAllowance(owner, spender, amount);  // CallResponse
await token.decreaseAllowance(owner, spender, amount);  // CallResponse

// Signature-based methods
await token.increaseAllowanceBySignature(owner, spender, amount, deadline, signature);
await token.decreaseAllowanceBySignature(owner, spender, amount, deadline, signature);

// Event decoders (static)
OP20.decodeTransferredEvent(data);  // { operator, from, to, value }
OP20.decodeMintedEvent(data);       // { to, value }
OP20.decodeBurnedEvent(data);       // { from, value }
OP20.decodeApprovedEvent(data);     // { owner, spender, value }
```

### OP721

Complete OP721 (NFT) implementation:

```typescript
import { OP721 } from '@btc-vision/unit-test-framework';

const nft = new OP721({
    address: contractAddress,
    deployer: deployerAddress,
    file: './MyNFT.wasm',
});

// Read methods
await nft.name();                                      // string
await nft.symbol();                                    // string
await nft.totalSupply();                               // bigint
await nft.maxSupply();                                 // bigint
await nft.balanceOf(owner);                            // bigint
await nft.ownerOf(tokenId);                            // Address
await nft.tokenURI(tokenId);                           // string
await nft.getApproved(tokenId);                        // Address
await nft.isApprovedForAll(owner, operator);           // boolean
await nft.tokenOfOwnerByIndex(owner, index);           // bigint
await nft.getAllTokensOfOwner(owner);                  // bigint[]
await nft.getTransferNonce(owner);                     // bigint
await nft.getApproveNonce(owner);                      // bigint
await nft.domainSeparator();                           // Uint8Array

// Write methods
await nft.transferFrom(from, to, tokenId, sender);    // CallResponse
await nft.safeTransferFrom(from, to, tokenId, data);  // CallResponse
await nft.approve(spender, tokenId, sender);           // CallResponse
await nft.setApprovalForAll(operator, approved, sender); // CallResponse
await nft.burn(tokenId, sender);                       // CallResponse
await nft.setBaseURI(baseURI);                         // CallResponse

// Signature-based methods
await nft.transferBySignature(owner, to, tokenId, deadline, signature);
await nft.approveBySignature(owner, spender, tokenId, deadline, signature);

// Event decoders (static)
OP721.decodeTransferredEvent(data);  // { operator, from, to, tokenId }
OP721.decodeApprovedEvent(data);     // { owner, approved, tokenId }
OP721.decodeApprovedForAllEvent(data); // { owner, operator, approved }
OP721.decodeURIEvent(data);          // { uri, tokenId }
```

### OP721Extended

Extended NFT implementation with reservation-based minting:

```typescript
import { OP721Extended } from '@btc-vision/unit-test-framework';

const nft = new OP721Extended({
    address: contractAddress,
    deployer: deployerAddress,
    file: './MyNFTExtended.wasm',
    // Optional config overrides
    mintPrice: 100000n,
    reservationFeePercent: 15n,
    minReservationFee: 1000n,
    reservationBlocks: 5n,
    graceBlocks: 1n,
    maxReservationAmount: 20,
});

// Admin
await nft.setMintEnabled(true);

// Read
await nft.isMintEnabled();
await nft.getStatus();       // { minted, reserved, available, maxSupply, ... }
await nft.getReservationInfo();

// Reservation flow
const reservation = await nft.reserve(5n, sender);  // { remainingPayment, reservationBlock }
const claimed = await nft.claim(sender);             // { startTokenId, amountClaimed }
const purged = await nft.purgeExpired();             // { totalPurged, blocksProcessed }

// Utility methods
nft.calculateReservationFee(quantity);
nft.calculateRemainingPayment(quantity);
nft.isReservationExpired(reservationBlock, currentBlock);
nft.getBlocksUntilExpiry(reservationBlock, currentBlock);

// Event decoders (static)
OP721Extended.decodeReservationCreatedEvent(data);
OP721Extended.decodeReservationClaimedEvent(data);
OP721Extended.decodeReservationExpiredEvent(data);
OP721Extended.decodeMintStatusChangedEvent(data);
```

---

## Advanced Topics

### Contract-to-Contract Calls

When testing contracts that call other contracts, register all contracts with the `Blockchain`:

```typescript
const tokenA = new OP20({ address: addrA, deployer, file: './TokenA.wasm', decimals: 18 });
const tokenB = new OP20({ address: addrB, deployer, file: './TokenB.wasm', decimals: 18 });
const swap = new MySwapContract(deployer, swapAddr);

Blockchain.register(tokenA);
Blockchain.register(tokenB);
Blockchain.register(swap);

await Blockchain.init();
```

The VM automatically routes cross-contract calls to the registered contract instances.

### Upgradeable Contracts

Test contract upgrades using `updateFromAddress`:

```typescript
import { opnet, OPNetUnit, Assert, Blockchain, BytecodeManager } from '@btc-vision/unit-test-framework';
import { UpgradeableContractRuntime } from './UpgradeableContractRuntime';

await opnet('Upgrade Tests', async (vm: OPNetUnit) => {
    let contract: UpgradeableContractRuntime;

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        contract = new UpgradeableContractRuntime(deployer, contractAddress);
        Blockchain.register(contract);
        await contract.init();

        // Register the V2 source contract (bytecode provider)
        const v2Source = new V2SourceContract(deployer, v2Address);
        BytecodeManager.loadBytecode('./ContractV2.wasm', v2Address);
        Blockchain.register(v2Source);
        await v2Source.init();
    });

    await vm.it('should upgrade and change behavior', async () => {
        const valueBefore = await contract.getValue();
        Assert.expect(valueBefore).toEqual(1);

        // Trigger the upgrade
        await contract.upgrade(v2Address);

        // Must mine a block for upgrade to take effect
        Blockchain.mineBlock();

        const valueAfter = await contract.getValue();
        Assert.expect(valueAfter).toEqual(2);
    });

    await vm.it('should preserve storage across upgrade', async () => {
        const key = new Uint8Array(32).fill(0xAA);
        const value = new Uint8Array(32).fill(0xBB);

        await contract.storeValue(key, value);
        await contract.upgrade(v2Address);
        Blockchain.mineBlock();

        const loaded = await contract.loadValue(key);
        Assert.expect(loaded).toDeepEqual(value);
    });
});
```

### Transaction Simulation

Simulate Bitcoin transactions with inputs and outputs:

```typescript
import { Transaction, TransactionInput, TransactionOutput, generateTransactionId } from '@btc-vision/unit-test-framework';

// Create a simulated transaction
const tx = new Transaction(
    generateTransactionId(),
    [new TransactionInput({
        txHash: new Uint8Array(32),
        outputIndex: 0,
        scriptSig: new Uint8Array(0),
    })],
    [],
);

// Add outputs
tx.addOutput(100000n, receiverAddress);

// Set as current transaction
Blockchain.transaction = tx;
```

### Signature Verification

Test ML-DSA (post-quantum), Schnorr, and ECDSA signatures:

```typescript
import { MessageSigner } from '@btc-vision/transaction';

// ML-DSA signature
const wallet = Blockchain.generateRandomWallet();
const message = new BinaryWriter();
message.writeString('Hello World');

const mldsaSig = MessageSigner.signMLDSAMessage(wallet.mldsaKeypair, message.getBuffer());
// Pass mldsaSig.signature to your contract's verify method

// Schnorr signature
const schnorrSig = MessageSigner.tweakAndSignMessage(
    wallet.keypair,
    message.getBuffer(),
    Blockchain.network,
);

// Verify locally
const isValid = MessageSigner.tweakAndVerifySignature(
    wallet.keypair.publicKey,
    message.getBuffer(),
    schnorrSig.signature,
);
```

### State Overrides & Block Replay

Load contract state from external sources (e.g., mainnet state dumps) for debugging:

```typescript
import { StateHandler } from '@btc-vision/unit-test-framework';

// Override states for a specific contract
StateHandler.overrideStates(contractAddress, statesMap);
StateHandler.overrideDeployment(contractAddress);

// Read global state
const value = StateHandler.globalLoad(contractAddress, pointer);
const hasPointer = StateHandler.globalHas(contractAddress, pointer);

// Temporary state management (for cross-contract calls)
StateHandler.setTemporaryStates(contractAddress, tempStates);
StateHandler.clearTemporaryStates(contractAddress);

// Push temporary states to global
StateHandler.pushAllTempStatesToGlobal();

// Reset everything
StateHandler.purgeAll();
```

### Gas Profiling

Track gas consumption for performance optimization:

```typescript
// Enable gas tracing
Blockchain.traceGas = true;

await vm.it('should measure gas', async () => {
    const response = await contract.execute({ calldata: buffer });

    vm.info(`Gas used: ${response.usedGas}`);
    Assert.expect(response.usedGas).toBeLessThan(1_000_000n);
});

// Convert gas to BTC/USD
import { gas2Sat, gas2BTC, gas2USD } from '@btc-vision/unit-test-framework';

const sats = gas2Sat(response.usedGas);
const btc = gas2BTC(response.usedGas);
const usd = gas2USD(response.usedGas, 100000); // $100k BTC price
```

### Consensus Rules

Configure consensus rules for testing:

```typescript
import { ConsensusRules, ConsensusManager } from '@btc-vision/unit-test-framework';

// Create custom consensus rules
const rules = ConsensusRules.new();
rules.insertFlag(ConsensusRules.ALLOW_CLASSICAL_SIGNATURES);
rules.insertFlag(ConsensusRules.UPDATE_CONTRACT_BY_ADDRESS);

// Check flags
rules.containsFlag(ConsensusRules.ALLOW_CLASSICAL_SIGNATURES); // true
rules.unsafeSignaturesAllowed(); // true

// Use the global consensus manager
ConsensusManager.default();
const flags = ConsensusManager.getFlags();
```

---

## Utilities

```typescript
import {
    generateEmptyTransaction,
    gas2Sat,
    sat2BTC,
    gas2BTC,
    gas2USD,
} from '@btc-vision/unit-test-framework';

// Generate an empty transaction for testing
const tx = generateEmptyTransaction();

// Gas/price conversions
const satoshis = gas2Sat(1_000_000n);      // Gas to satoshis
const btc = sat2BTC(100_000n);             // Satoshis to BTC
const btcFromGas = gas2BTC(1_000_000n);    // Gas to BTC
const usd = gas2USD(1_000_000n, 100_000);  // Gas to USD
```

---

## Running Tests

Tests run directly via `tsx` (TypeScript executor):

```bash
# Run a single test
npx tsx test/my-contract.test.ts

# Run all tests
npm test

# Run specific test suites
npm run test:blockchain
npm run test:storage
npm run test:ecdsa
```

### Build the Library

```bash
# Build with gulp
npm run build

# Or directly
npx gulp
```

### Build Test Contracts (AssemblyScript)

```bash
npm run build:test-contract
```

---

## API Reference

### Exports

All public types are exported from the package root:

```typescript
import {
    // Test Runner
    opnet,
    OPNetUnit,

    // Assertions
    Assert,
    Assertion,

    // Blockchain Simulator
    Blockchain,

    // Contract Runtime
    ContractRuntime,
    CallResponse,
    ContractDetails,
    ExecutionParameters,

    // Bytecode Management
    BytecodeManager,

    // Built-in Contract Helpers
    OP20,
    OP721,
    OP721Extended,

    // VM Internals
    RustContract,
    StateHandler,

    // Transaction Simulation
    Transaction,
    TransactionInput,
    TransactionOutput,
    generateTransactionId,
    generateEmptyTransaction,

    // Consensus
    ConsensusRules,
    ConsensusManager,

    // ML-DSA
    MLDSAMetadata,
    MLDSASecurityLevel,
    MLDSAPublicKeyMetadata,

    // Utilities
    gas2Sat,
    sat2BTC,
    gas2BTC,
    gas2USD,

    // Configuration
    configs,
} from '@btc-vision/unit-test-framework';
```

---

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature`).
3. Commit your changes (`git commit -am 'Add new feature'`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a Pull Request.

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

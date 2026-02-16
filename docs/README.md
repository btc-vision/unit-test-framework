# OPNet Unit Test Framework Documentation

Welcome to the documentation for `@btc-vision/unit-test-framework`. This framework lets you test OPNet smart contracts against the real OP_VM runtime in a local environment.

## Documentation Structure

### Getting Started

- [Installation](./getting-started/installation.md) - Setup and requirements
- [Quick Start](./getting-started/quick-start.md) - Write your first test

### Writing Tests

- [Basic Tests](./writing-tests/basic-tests.md) - Test structure and lifecycle hooks
- [OP20 Token Tests](./writing-tests/op20-tokens.md) - Testing fungible tokens
- [OP721 NFT Tests](./writing-tests/op721-nfts.md) - Testing non-fungible tokens
- [Custom Contracts](./writing-tests/custom-contracts.md) - Building typed contract wrappers

### Built-in Contract Helpers

- [OP20](./built-in-contracts/op20.md) - Fungible token helper
- [OP721](./built-in-contracts/op721.md) - NFT helper
- [OP721Extended](./built-in-contracts/op721-extended.md) - Extended NFT with reservation minting

### Advanced Topics

- [Cross-Contract Calls](./advanced/cross-contract-calls.md) - Multi-contract testing
- [Upgradeable Contracts](./advanced/upgradeable-contracts.md) - Testing contract upgrades
- [Transaction Simulation](./advanced/transaction-simulation.md) - Bitcoin transaction inputs/outputs
- [Signature Verification](./advanced/signature-verification.md) - ML-DSA, Schnorr, ECDSA
- [State Management](./advanced/state-management.md) - State overrides and block replay
- [Gas Profiling](./advanced/gas-profiling.md) - Measuring gas consumption
- [Consensus Rules](./advanced/consensus-rules.md) - Configuring consensus flags

### Examples

- [NativeSwap Testing](./examples/nativeswap-testing.md) - Complex DeFi contract tests
- [Block Replay](./examples/block-replay.md) - Replaying mainnet transactions

### API Reference

- [Assertions](./api-reference/assertions.md) - Assert & Assertion classes
- [Blockchain](./api-reference/blockchain.md) - Blockchain singleton
- [Contract Runtime](./api-reference/contract-runtime.md) - ContractRuntime base class
- [Types & Interfaces](./api-reference/types-interfaces.md) - All exported types
- [Utilities](./api-reference/utilities.md) - Helper functions and constants

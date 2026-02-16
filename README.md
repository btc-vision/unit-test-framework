# OPNet Unit Test Framework

![Bitcoin](https://img.shields.io/badge/Bitcoin-000?style=for-the-badge&logo=bitcoin&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![AssemblyScript](https://img.shields.io/badge/assembly%20script-%23000000.svg?style=for-the-badge&logo=assemblyscript&logoColor=white)
![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![NPM](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

The official unit testing framework for OPNet smart contracts. Test your AssemblyScript contracts against the real OP_VM runtime with full TypeScript support, gas metering, state management, and built-in helpers for OP20/OP721 tokens.

## Installation

```bash
npm install @btc-vision/unit-test-framework
```

## Documentation

Check out the full documentation in [`/docs`](./docs)!

- [Getting Started](./docs/getting-started/quick-start.md) - Installation & first test
- [Writing Tests](./docs/writing-tests/basic-tests.md) - Test patterns & lifecycle
- [Built-in Contracts](./docs/built-in-contracts/op20.md) - OP20, OP721, OP721Extended helpers
- [Assertions](./docs/api-reference/assertions.md) - Static & fluent assertion API
- [Blockchain API](./docs/api-reference/blockchain.md) - Blockchain simulator
- [Contract Runtime](./docs/api-reference/contract-runtime.md) - Custom contract wrappers
- [Advanced Topics](./docs/advanced/cross-contract-calls.md) - Upgrades, signatures, gas profiling
- [Examples](./docs/examples/nativeswap-testing.md) - Real-world test examples
- [API Reference](./docs/api-reference/types-interfaces.md) - Full type reference

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

        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;
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

## Requirements

- Node.js >= 22
- Rust toolchain (for building `@btc-vision/op-vm`)

## Development

```bash
git clone https://github.com/btc-vision/unit-test-framework.git
cd unit-test-framework
npm install
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## Reporting Issues

- **Bugs**: Open an issue on GitHub
- **Security**: See [SECURITY.md](./SECURITY.md) - do not open public issues for vulnerabilities

## License

[Apache-2.0](LICENSE)

## Links

- [OPNet](https://opnet.org)
- [Documentation](./docs/)
- [GitHub](https://github.com/btc-vision/unit-test-framework)
- [npm](https://www.npmjs.com/package/@btc-vision/unit-test-framework)

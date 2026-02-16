# Installation

This guide covers installing and configuring the OPNet Unit Test Framework.

## Prerequisites

- **Node.js** >= 22
- **Rust toolchain** - Required for building `@btc-vision/op-vm` (the WebAssembly VM runtime)

### Installing Rust

If you don't have Rust installed:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Install the Package

```bash
npm install @btc-vision/unit-test-framework
```

### Peer Dependencies

The framework automatically installs these transitive dependencies:

- `@btc-vision/transaction` - Address, BinaryReader/Writer, ABICoder, signatures
- `@btc-vision/bitcoin` - Bitcoin network definitions
- `@btc-vision/op-vm` - The Rust-based OPNet virtual machine (native addon)

## Project Setup

### TypeScript Configuration

Create a `tsconfig.json` for your project:

```json
{
    "compilerOptions": {
        "module": "ESNext",
        "target": "ESNext",
        "strict": true,
        "skipLibCheck": true,
        "moduleResolution": "node",
        "allowSyntheticDefaultImports": true,
        "lib": ["ESNext"]
    },
    "include": ["src/**/*.ts", "test/**/*.ts"],
    "exclude": ["node_modules"]
}
```

### Package Configuration

Ensure your `package.json` has `"type": "module"` for ESM support:

```json
{
    "type": "module",
    "scripts": {
        "test": "tsx test/my-contract.test.ts",
        "test:all": "npm-run-all test:*"
    }
}
```

### Install tsx

Tests run directly via `tsx` (TypeScript executor), not through a build step:

```bash
npm install -D tsx
```

## Verify Installation

Create a minimal test file `test/sanity.test.ts`:

```typescript
import { opnet, OPNetUnit, Assert, Blockchain } from '@btc-vision/unit-test-framework';

await opnet('Sanity Check', async (vm: OPNetUnit) => {
    vm.beforeEach(async () => {
        await Blockchain.init();
    });

    vm.afterEach(() => {
        Blockchain.dispose();
    });

    await vm.it('should generate addresses', async () => {
        const addr = Blockchain.generateRandomAddress();
        Assert.expect(addr).toBeDefined();
    });
});
```

Run it:

```bash
npx tsx test/sanity.test.ts
```

If you see a green pass message, you're ready to write tests.

---

[Next: Quick Start ->](./quick-start.md)

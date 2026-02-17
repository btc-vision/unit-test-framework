# Testing OP20 Tokens

The framework provides a built-in `OP20` class that wraps all standard fungible token methods. No need to write a custom runtime for standard OP20 tokens.

## Table of Contents

- [Setup](#setup)
- [Reading Token Data](#reading-token-data)
- [Minting](#minting)
- [Transfers](#transfers)
- [Allowances](#allowances)
- [Burning](#burning)
- [Airdrops](#airdrops)
- [Event Decoding](#event-decoding)
- [Complete Example](#complete-example)

---

## Setup

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

        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;
    });

    vm.afterEach(() => {
        token.dispose();
        Blockchain.dispose();
    });

    // Tests go here...
});
```

### OP20 Constructor

```typescript
new OP20({
    address: Address,          // Contract address
    deployer: Address,         // Deployer address
    file: string,              // Path to compiled .wasm file
    decimals: number,          // Token decimals (e.g. 8, 18)
    gasLimit?: bigint,         // Optional gas limit (default: 100_000_000_000_000n)
    deploymentCalldata?: Buffer, // Optional deployment calldata
})
```

---

## Reading Token Data

### Metadata

```typescript
await vm.it('should read token metadata', async () => {
    const { metadata } = await token.metadata();

    vm.info(`Name: ${metadata.name}`);
    vm.info(`Symbol: ${metadata.symbol}`);
    vm.info(`Decimals: ${metadata.decimals}`);
    vm.info(`Total Supply: ${metadata.totalSupply}`);
    vm.info(`Max Supply: ${metadata.maximumSupply}`);
});
```

### Balance

```typescript
await vm.it('should check balance', async () => {
    const balance = await token.balanceOf(alice);
    Assert.expect(balance).toEqual(0n);

    // Human-readable balance (divides by 10^decimals)
    const readable = await token.balanceOfNoDecimals(alice);
    Assert.expect(readable).toEqual(0);
});
```

### Total Supply

```typescript
await vm.it('should read total supply', async () => {
    const supply = await token.totalSupply();
    Assert.expect(supply).toBeGreaterThanOrEqual(0n);
});
```

### Domain Separator

```typescript
await vm.it('should read domain separator', async () => {
    const separator = await token.domainSeparator();
    Assert.expect(separator.length).toEqual(32);
});
```

---

## Minting

### Mint in whole tokens

```typescript
await vm.it('should mint tokens (whole units)', async () => {
    // Mints 1000 tokens (automatically multiplied by 10^decimals)
    await token.mint(alice, 1000);

    const balance = await token.balanceOf(alice);
    Assert.expect(balance).toEqual(Blockchain.expandToDecimal(1000, 18));
});
```

### Mint raw amount

```typescript
await vm.it('should mint raw token amount', async () => {
    const rawAmount = 500_000_000_000_000_000_000n; // 500 * 10^18
    await token.mintRaw(alice, rawAmount);

    const balance = await token.balanceOf(alice);
    Assert.expect(balance).toEqual(rawAmount);
});
```

---

## Transfers

### Safe Transfer

```typescript
await vm.it('should transfer tokens', async () => {
    await token.mint(alice, 1000);

    const amount = Blockchain.expandToDecimal(100, 18);
    const response = await token.safeTransfer(alice, bob, amount);

    Assert.expect(response.usedGas).toBeGreaterThan(0n);

    const aliceBalance = await token.balanceOf(alice);
    const bobBalance = await token.balanceOf(bob);

    Assert.expect(bobBalance).toEqual(amount);
    Assert.expect(aliceBalance).toEqual(Blockchain.expandToDecimal(900, 18));
});
```

### Safe Transfer From (with allowance)

```typescript
await vm.it('should transferFrom with allowance', async () => {
    await token.mint(alice, 1000);

    const amount = Blockchain.expandToDecimal(200, 18);

    // Alice approves bob
    await token.increaseAllowance(alice, bob, amount);

    // Bob transfers from Alice's account
    Blockchain.msgSender = bob;
    await token.safeTransferFrom(alice, bob, amount);

    const bobBalance = await token.balanceOf(bob);
    Assert.expect(bobBalance).toEqual(amount);
});
```

---

## Allowances

### Increase/Decrease Allowance

```typescript
await vm.it('should manage allowances', async () => {
    const amount = Blockchain.expandToDecimal(500, 18);

    await token.increaseAllowance(alice, bob, amount);
    let allowance = await token.allowance(alice, bob);
    Assert.expect(allowance).toEqual(amount);

    const decrease = Blockchain.expandToDecimal(200, 18);
    await token.decreaseAllowance(alice, bob, decrease);
    allowance = await token.allowance(alice, bob);
    Assert.expect(allowance).toEqual(amount - decrease);
});
```

### Signature-based Allowance

```typescript
await vm.it('should approve by signature', async () => {
    const wallet = Blockchain.generateRandomWallet();
    const spender = Blockchain.generateRandomAddress();
    const amount = 1000n;
    const deadline = BigInt(Date.now()) + 3600n;
    const signature = new Uint8Array(64); // Your actual signature

    await token.increaseAllowanceBySignature(
        wallet.address, spender, amount, deadline, signature
    );
});
```

---

## Burning

```typescript
await vm.it('should burn tokens', async () => {
    await token.mint(alice, 1000);

    const burnAmount = Blockchain.expandToDecimal(300, 18);
    const response = await token.burn(alice, burnAmount);

    Assert.expect(response.usedGas).toBeGreaterThan(0n);

    const balance = await token.balanceOf(alice);
    Assert.expect(balance).toEqual(Blockchain.expandToDecimal(700, 18));
});
```

---

## Airdrops

Batch mint to multiple addresses:

```typescript
import { AddressMap } from '@btc-vision/transaction';

await vm.it('should airdrop to multiple addresses', async () => {
    const recipients = new AddressMap<bigint>();
    const amount = Blockchain.expandToDecimal(100, 18);

    recipients.set(alice, amount);
    recipients.set(bob, amount);

    const response = await token.airdrop(recipients);
    Assert.expect(response.usedGas).toBeGreaterThan(0n);

    const aliceBalance = await token.balanceOf(alice);
    const bobBalance = await token.balanceOf(bob);

    Assert.expect(aliceBalance).toEqual(amount);
    Assert.expect(bobBalance).toEqual(amount);
});
```

---

## Event Decoding

### Transfer Events

```typescript
await vm.it('should decode transfer events', async () => {
    await token.mint(alice, 1000);
    const amount = Blockchain.expandToDecimal(50, 18);
    const response = await token.safeTransfer(alice, bob, amount);

    for (const event of response.events) {
        const decoded = OP20.decodeTransferredEvent(event.data);
        vm.info(`From: ${decoded.from.toHex()}`);
        vm.info(`To: ${decoded.to.toHex()}`);
        vm.info(`Value: ${decoded.value}`);
    }
});
```

### All Event Decoders

```typescript
// Transfer event: { operator, from, to, value }
OP20.decodeTransferredEvent(data);

// Mint event: { to, value }
OP20.decodeMintedEvent(data);

// Burn event: { from, value }
OP20.decodeBurnedEvent(data);

// Approval event: { owner, spender, value }
OP20.decodeApprovedEvent(data);
```

---

## Complete Example

```typescript
import { opnet, OPNetUnit, Assert, Blockchain, OP20 } from '@btc-vision/unit-test-framework';
import { Address } from '@btc-vision/transaction';

await opnet('Complete OP20 Test Suite', async (vm: OPNetUnit) => {
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
            decimals: 8,
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

    await vm.it('should have correct metadata', async () => {
        const { metadata } = await token.metadata();
        Assert.expect(metadata.decimals).toEqual(8);
        vm.success(`Token: ${metadata.name} (${metadata.symbol})`);
    });

    await vm.it('should mint and transfer', async () => {
        await token.mint(alice, 1000);
        const amount = Blockchain.expandToDecimal(250, 8);
        await token.safeTransfer(alice, bob, amount);

        Assert.expect(await token.balanceOf(bob)).toEqual(amount);
        Assert.expect(await token.balanceOf(alice)).toEqual(
            Blockchain.expandToDecimal(750, 8)
        );
    });

    await vm.it('should fail to transfer more than balance', async () => {
        await token.mint(alice, 100);
        const tooMuch = Blockchain.expandToDecimal(200, 8);

        await Assert.expect(async () => {
            await token.safeTransfer(alice, bob, tooMuch);
        }).toThrow();
    });
});
```

---

## Next Steps

- [OP721 NFT Tests](./op721-nfts.md) - Testing non-fungible tokens
- [Custom Contracts](./custom-contracts.md) - Building contract wrappers
- [OP20 API Reference](../built-in-contracts/op20.md) - Full method reference

---

[<- Previous: Basic Tests](./basic-tests.md) | [Next: OP721 NFT Tests ->](./op721-nfts.md)

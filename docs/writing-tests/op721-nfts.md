# Testing OP721 NFTs

The framework provides built-in `OP721` and `OP721Extended` classes for testing non-fungible token contracts.

## Table of Contents

- [Setup](#setup)
- [Reading Collection Data](#reading-collection-data)
- [Transfers](#transfers)
- [Approvals](#approvals)
- [Burning](#burning)
- [Enumeration](#enumeration)
- [Event Decoding](#event-decoding)
- [OP721Extended: Reservation Minting](#op721extended-reservation-minting)
- [Complete Example](#complete-example)

---

## Setup

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

    // Tests go here...
});
```

---

## Reading Collection Data

```typescript
await vm.it('should read collection info', async () => {
    const name = await nft.name();
    const symbol = await nft.symbol();
    const totalSupply = await nft.totalSupply();
    const maxSupply = await nft.maxSupply();

    vm.info(`Collection: ${name} (${symbol})`);
    vm.info(`Supply: ${totalSupply} / ${maxSupply}`);
});

await vm.it('should read token URI', async () => {
    const uri = await nft.tokenURI(1n);
    vm.info(`Token 1 URI: ${uri}`);
});

await vm.it('should check ownership', async () => {
    const owner = await nft.ownerOf(1n);
    vm.info(`Token 1 owned by: ${owner.toHex()}`);
});

await vm.it('should check balance', async () => {
    const balance = await nft.balanceOf(alice);
    Assert.expect(balance).toBeGreaterThanOrEqual(0n);
});
```

---

## Transfers

### Direct Transfer

```typescript
await vm.it('should transfer an NFT', async () => {
    const tokenId = 1n;

    // Transfer from alice to bob (alice is the sender)
    await nft.transferFrom(alice, bob, tokenId, alice);

    const newOwner = await nft.ownerOf(tokenId);
    Assert.expect(newOwner).toEqualAddress(bob);
});
```

### Safe Transfer (with data)

```typescript
await vm.it('should safe transfer with data', async () => {
    const tokenId = 1n;
    const data = new Uint8Array([0x01, 0x02, 0x03]);

    const response = await nft.safeTransferFrom(alice, bob, tokenId, data, alice);
    Assert.expect(response.usedGas).toBeGreaterThan(0n);
});
```

### Signature-based Transfer

```typescript
await vm.it('should transfer by signature', async () => {
    const tokenId = 1n;
    const deadline = BigInt(Date.now()) + 3600n;
    const signature = new Uint8Array(64); // Actual signature

    await nft.transferBySignature(alice, bob, tokenId, deadline, signature);
});
```

---

## Approvals

### Single Token Approval

```typescript
await vm.it('should approve a spender', async () => {
    const tokenId = 1n;
    await nft.approve(bob, tokenId, alice);

    const approved = await nft.getApproved(tokenId);
    Assert.expect(approved).toEqualAddress(bob);
});
```

### Operator Approval (All Tokens)

```typescript
await vm.it('should set approval for all', async () => {
    await nft.setApprovalForAll(bob, true, alice);

    const isApproved = await nft.isApprovedForAll(alice, bob);
    Assert.expect(isApproved).toEqual(true);
});

await vm.it('should revoke approval for all', async () => {
    await nft.setApprovalForAll(bob, false, alice);

    const isApproved = await nft.isApprovedForAll(alice, bob);
    Assert.expect(isApproved).toEqual(false);
});
```

---

## Burning

```typescript
await vm.it('should burn an NFT', async () => {
    const tokenId = 1n;
    const response = await nft.burn(tokenId, alice);

    Assert.expect(response.usedGas).toBeGreaterThan(0n);

    // Querying burned token should fail
    await Assert.expect(async () => {
        await nft.ownerOf(tokenId);
    }).toThrow();
});
```

---

## Enumeration

```typescript
await vm.it('should enumerate tokens by owner', async () => {
    // Get first token of owner
    const firstToken = await nft.tokenOfOwnerByIndex(alice, 0n);
    vm.info(`Alice's first token: ${firstToken}`);

    // Get all tokens of owner
    const allTokens = await nft.getAllTokensOfOwner(alice);
    vm.info(`Alice owns ${allTokens.length} tokens: ${allTokens.join(', ')}`);
});
```

---

## Event Decoding

```typescript
// Transfer: { operator, from, to, tokenId }
OP721.decodeTransferredEvent(data);

// Approval: { owner, approved, tokenId }
OP721.decodeApprovedEvent(data);

// ApprovalForAll: { owner, operator, approved }
OP721.decodeApprovedForAllEvent(data);

// URI: { uri, tokenId }
OP721.decodeURIEvent(data);
```

### Example

```typescript
await vm.it('should decode transfer events', async () => {
    const response = await nft.transferFrom(alice, bob, 1n, alice);

    for (const event of response.events) {
        const decoded = OP721.decodeTransferredEvent(event.data);
        Assert.expect(decoded.to).toEqualAddress(bob);
        Assert.expect(decoded.tokenId).toEqual(1n);
    }
});
```

---

## OP721Extended: Reservation Minting

`OP721Extended` adds a reservation-based minting system on top of standard OP721:

```typescript
import { OP721Extended } from '@btc-vision/unit-test-framework';

const nft = new OP721Extended({
    address: contractAddress,
    deployer: deployer,
    file: './bytecodes/MyNFTExtended.wasm',
    mintPrice: 100000n,              // Price per token in sats
    reservationFeePercent: 15n,       // 15% reservation fee
    minReservationFee: 1000n,         // Min fee in sats
    reservationBlocks: 5n,            // Blocks to claim
    graceBlocks: 1n,                  // Grace period
    maxReservationAmount: 20,         // Max tokens per reservation
});
```

### Reservation Flow

```typescript
await vm.it('should complete reservation flow', async () => {
    // 1. Enable minting
    await nft.setMintEnabled(true);
    Assert.expect(await nft.isMintEnabled()).toEqual(true);

    // 2. Reserve tokens
    const reservation = await nft.reserve(5n, alice);
    vm.info(`Remaining payment: ${reservation.remainingPayment}`);
    vm.info(`Reserved at block: ${reservation.reservationBlock}`);

    // 3. Claim minted tokens
    const claimed = await nft.claim(alice);
    vm.info(`Claimed ${claimed.amountClaimed} tokens starting at #${claimed.startTokenId}`);

    Assert.expect(claimed.amountClaimed).toEqual(5n);
});
```

### Purging Expired Reservations

```typescript
await vm.it('should purge expired reservations', async () => {
    await nft.reserve(3n, alice);

    // Advance blocks past expiry
    for (let i = 0; i < 10; i++) {
        Blockchain.mineBlock();
    }

    const purged = await nft.purgeExpired();
    vm.info(`Purged ${purged.totalPurged} reservations across ${purged.blocksProcessed} blocks`);
});
```

### Status & Utility Methods

```typescript
await vm.it('should read collection status', async () => {
    const status = await nft.getStatus();

    vm.info(`Minted: ${status.minted}`);
    vm.info(`Reserved: ${status.reserved}`);
    vm.info(`Available: ${status.available}`);
    vm.info(`Max Supply: ${status.maxSupply}`);

    // Calculate fees
    const fee = nft.calculateReservationFee(5n);
    const remaining = nft.calculateRemainingPayment(5n);
    vm.info(`Fee for 5 tokens: ${fee}`);
    vm.info(`Remaining payment: ${remaining}`);

    // Check expiry
    const expired = nft.isReservationExpired(100n, 110n);
    const blocksLeft = nft.getBlocksUntilExpiry(100n, 103n);
});
```

---

## Complete Example

```typescript
import { opnet, OPNetUnit, Assert, Blockchain, OP721Extended } from '@btc-vision/unit-test-framework';
import { Address } from '@btc-vision/transaction';

await opnet('NFT Reservation Tests', async (vm: OPNetUnit) => {
    let nft: OP721Extended;
    const deployer: Address = Blockchain.generateRandomAddress();
    const minter: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        nft = new OP721Extended({
            address: Blockchain.generateRandomAddress(),
            deployer: deployer,
            file: './bytecodes/MyNFTExtended.wasm',
        });

        Blockchain.register(nft);
        await nft.init();

        Blockchain.msgSender = deployer;
        Blockchain.txOrigin = deployer;

        await nft.setMintEnabled(true);
    });

    vm.afterEach(() => {
        nft.dispose();
        Blockchain.dispose();
    });

    await vm.it('should reserve and claim', async () => {
        Blockchain.msgSender = minter;
        const reservation = await nft.reserve(3n, minter);

        const claimed = await nft.claim(minter);
        Assert.expect(claimed.amountClaimed).toEqual(3n);
    });

    await vm.it('should track supply changes', async () => {
        const supplyBefore = await nft.totalSupply();
        Blockchain.msgSender = minter;
        await nft.reserve(2n, minter);
        await nft.claim(minter);

        const supplyAfter = await nft.totalSupply();
        Assert.expect(supplyAfter).toEqual(supplyBefore + 2n);
    });
});
```

---

## Next Steps

- [Custom Contracts](./custom-contracts.md) - Building contract wrappers
- [OP721 API Reference](../built-in-contracts/op721.md) - Full method reference
- [OP721Extended API Reference](../built-in-contracts/op721-extended.md) - Extended methods

---

[<- Previous: OP20 Token Tests](./op20-tokens.md) | [Next: Custom Contracts ->](./custom-contracts.md)

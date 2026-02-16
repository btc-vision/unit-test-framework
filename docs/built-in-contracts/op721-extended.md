# OP721Extended API Reference

Extended NFT helper with reservation-based minting. Inherits all methods from [OP721](./op721.md).

**Import:** `import { OP721Extended } from '@btc-vision/unit-test-framework'`
**Extends:** `OP721`

---

## Constructor

```typescript
new OP721Extended(details: ExtendedOP721Configuration)
```

```typescript
interface ExtendedOP721Configuration extends OP721Interface {
    readonly mintPrice?: bigint;             // Default: 100000n
    readonly reservationFeePercent?: bigint;  // Default: 15n
    readonly minReservationFee?: bigint;      // Default: 1000n
    readonly reservationBlocks?: bigint;      // Default: 5n
    readonly graceBlocks?: bigint;            // Default: 1n
    readonly maxReservationAmount?: number;   // Default: 20
}
```

### Example

```typescript
const nft = new OP721Extended({
    address: contractAddress,
    deployer: deployer,
    file: './bytecodes/MyNFT.wasm',
    mintPrice: 50000n,
    reservationFeePercent: 10n,
    maxReservationAmount: 50,
});
```

---

## Properties

| Property | Type | Default |
|----------|------|---------|
| `MINT_PRICE` | `bigint` | `100000n` |
| `RESERVATION_FEE_PERCENT` | `bigint` | `15n` |
| `MIN_RESERVATION_FEE` | `bigint` | `1000n` |
| `RESERVATION_BLOCKS` | `bigint` | `5n` |
| `GRACE_BLOCKS` | `bigint` | `1n` |
| `MAX_RESERVATION_AMOUNT` | `number` | `20` |

---

## Admin Methods

### `setMintEnabled(enabled)`

```typescript
async setMintEnabled(enabled: boolean): Promise<CallResponse>
```

### `isMintEnabled()`

```typescript
async isMintEnabled(): Promise<boolean>
```

---

## Reservation Methods

### `reserve(quantity, sender)`

```typescript
async reserve(quantity: bigint, sender: Address): Promise<ReservationResponse>
```

```typescript
interface ReservationResponse {
    readonly remainingPayment: bigint;
    readonly reservationBlock: bigint;
}
```

### `claim(sender)`

```typescript
async claim(sender: Address): Promise<ClaimResponse>
```

```typescript
interface ClaimResponse {
    readonly startTokenId: bigint;
    readonly amountClaimed: bigint;
}
```

### `purgeExpired()`

```typescript
async purgeExpired(): Promise<PurgeResponse>
```

```typescript
interface PurgeResponse {
    readonly totalPurged: bigint;
    readonly blocksProcessed: number;
}
```

### `getStatus()`

```typescript
async getStatus(): Promise<OP721ExtendedStatus>
```

```typescript
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

### `getReservationInfo()`

```typescript
async getReservationInfo(): Promise<{
    status: OP721ExtendedStatus;
    constants: {
        mintPrice: string;
        reservationFeePercent: string;
        minReservationFee: string;
        reservationBlocks: number;
        graceBlocks: number;
        maxReservationAmount: number;
        totalExpiryBlocks: number;
    };
}>
```

### `onOP721Received(...)`

```typescript
async onOP721Received(
    operator: Address, from: Address, tokenId: bigint,
    data: Uint8Array, receiver: Address
): Promise<number>
```

---

## Utility Methods (Non-async)

```typescript
calculateReservationFee(quantity: bigint): bigint
calculateRemainingPayment(quantity: bigint): bigint
isReservationExpired(reservationBlock: bigint, currentBlock: bigint): boolean
getBlocksUntilExpiry(reservationBlock: bigint, currentBlock: bigint): bigint
static formatBTC(sats: bigint): string
```

---

## Static Event Decoders

### `decodeReservationCreatedEvent(data)`

```typescript
interface ReservationCreatedEvent {
    readonly user: Address;
    readonly amount: bigint;
    readonly blockNumber: bigint;
    readonly feePaid: bigint;
}
```

### `decodeReservationClaimedEvent(data)`

```typescript
interface ReservationClaimedEvent {
    readonly user: Address;
    readonly amount: bigint;
    readonly startTokenId: bigint;
}
```

### `decodeReservationExpiredEvent(data)`

```typescript
interface ReservationExpiredEvent {
    readonly blockNumber: bigint;
    readonly totalExpired: bigint;
}
```

### `decodeMintStatusChangedEvent(data)`

```typescript
interface MintStatusChangedEvent {
    readonly enabled: boolean;
}
```

---

[<- Previous: OP721](./op721.md) | [Next: Assertions API ->](../api-reference/assertions.md)

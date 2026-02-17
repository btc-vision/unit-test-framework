# Assertions API Reference

The framework provides two assertion styles: **static methods** on `Assert` and a **fluent API** via `Assert.expect()`.

**Import:** `import { Assert, Assertion } from '@btc-vision/unit-test-framework'`

---

## Static Methods

### `Assert.equal(actual, expected, message?)`

```typescript
static equal<T>(actual: T, expected: T, message?: string): void
```

Strict equality check. Throws if `actual !== expected`.

### `Assert.notEqual(actual, unexpected, message?)`

```typescript
static notEqual<T>(actual: T, unexpected: T, message?: string): void
```

### `Assert.deepEqual(actual, expected, message?)`

```typescript
static deepEqual<T>(actual: T, expected: T, message?: string): void
```

Deep structural equality. Works with objects, arrays, `Uint8Array`, nested structures.

### `Assert.toBeCloseTo(actual, expected, tolerance, message?)`

```typescript
static toBeCloseTo(actual: bigint, expected: bigint, tolerance: bigint, message?: string): void
```

Checks that `abs(actual - expected) <= tolerance`.

### `Assert.toBeGreaterThan(actual, expected, message?)`

```typescript
static toBeGreaterThan(actual: bigint, expected: bigint, message?: string): void
```

### `Assert.toBeGreaterThanOrEqual(actual, expected, message?)`

```typescript
static toBeGreaterThanOrEqual(actual: bigint, expected: bigint, message?: string): void
```

### `Assert.toBeLessThanOrEqual(actual, expected, message?)`

```typescript
static toBeLessThanOrEqual(actual: bigint, expected: bigint, message?: string): void
```

### `Assert.addressArrayEqual(actual, expected, message?)`

```typescript
static addressArrayEqual(actual: Address[], expected: Address[], message?: string): void
```

Compares two arrays of `Address` objects for equality.

### `Assert.throws(fn, expectedError?)`

```typescript
static throws(fn: () => void, expectedError?: string | RegExp): void
```

Asserts that `fn()` throws. When `expectedError` is a string, uses **exact match** against the error message. When it is a `RegExp`, tests the pattern.

### `Assert.throwsAsync(fn, expectedError?)`

```typescript
static async throwsAsync(fn: () => Promise<void>, expectedError?: string | RegExp): Promise<void>
```

Async version of `throws`. Same exact-match behavior for strings.

---

## Fluent API

Create assertions with `Assert.expect(value)`:

```typescript
Assert.expect(actualValue).toEqual(expectedValue);
```

### `toEqual(expected)`

```typescript
toEqual(expected: unknown): void
```

Strict equality. Works with primitives, `bigint`, and objects.

### `toNotEqual(unexpected)`

```typescript
toNotEqual(unexpected: unknown): void
```

### `toDeepEqual(expected)`

```typescript
toDeepEqual(expected: unknown): void
```

Deep structural equality.

### `toBeDefined()`

```typescript
toBeDefined(): void
```

Asserts value is not `undefined`.

### `toBeUndefined()`

```typescript
toBeUndefined(): void
```

### `toBeGreaterThan(expected)`

```typescript
toBeGreaterThan(expected: number | bigint): void
```

### `toBeGreaterThanOrEqual(expected)`

```typescript
toBeGreaterThanOrEqual(expected: number | bigint): void
```

### `toBeLessThan(expected)`

```typescript
toBeLessThan(expected: number | bigint): void
```

### `toBeLessThanOrEqual(expected)`

```typescript
toBeLessThanOrEqual(expected: number | bigint): void
```

### `toEqualAddress(address)`

```typescript
toEqualAddress(address: Address): void
```

Compares two `Address` objects.

### `toEqualAddressList(expected)`

```typescript
toEqualAddressList(expected: Address[]): void
```

Compares two arrays of `Address` objects.

### `toThrow(expectedError?)`

```typescript
async toThrow(expectedError?: string | RegExp): Promise<void>
```

Asserts that the value (an async function) throws when called. When `expectedError` is a string, uses **substring match** (`error.message.includes(expectedError)`). When it is a `RegExp`, tests the pattern.

> **Note:** This differs from the static `Assert.throws()`, which uses **exact match** for strings.

```typescript
// Match any error
await Assert.expect(async () => {
    await contract.invalidCall();
}).toThrow();

// Match by substring (not exact)
await Assert.expect(async () => {
    await contract.invalidCall();
}).toThrow('out of gas');

// Match by regex
await Assert.expect(async () => {
    await contract.invalidCall();
}).toThrow(/not authorized/);
```

### `toNotThrow()`

```typescript
async toNotThrow(): Promise<void>
```

Asserts that the value (an async function) does NOT throw.

---

## Examples

```typescript
import { Assert } from '@btc-vision/unit-test-framework';

// Primitive equality
Assert.expect(42n).toEqual(42n);
Assert.expect('hello').toEqual('hello');

// Comparison
Assert.expect(100n).toBeGreaterThan(50n);
Assert.expect(response.usedGas).toBeLessThan(1_000_000_000n);

// Address comparison
Assert.expect(owner).toEqualAddress(expectedOwner);

// Deep equality (Uint8Array, objects)
Assert.expect(hash).toDeepEqual(expectedHash);

// Defined/undefined
Assert.expect(result).toBeDefined();
Assert.expect(missing).toBeUndefined();

// Error testing
await Assert.expect(async () => {
    await contract.unauthorizedCall();
}).toThrow('not authorized');

// Static methods
Assert.equal(value, 42n);
Assert.toBeCloseTo(actual, expected, 100n);
Assert.deepEqual(obj, expectedObj);
```

---

[<- Previous: OP721Extended](../built-in-contracts/op721-extended.md) | [Next: Blockchain API ->](./blockchain.md)

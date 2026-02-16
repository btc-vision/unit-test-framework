# Gas Profiling

Measure and optimize gas consumption of your contracts.

---

## Enable Gas Tracing

```typescript
// In your test setup
Blockchain.traceGas = true;
Blockchain.traceDeployments = true;
Blockchain.traceCalls = true;
Blockchain.tracePointers = true;
```

This enables detailed logging of gas consumption per call, storage operations, and deployments.

---

## Measuring Gas

Every `CallResponse` includes `usedGas`:

```typescript
await vm.it('should measure gas for basic execution', async () => {
    const response = await contract.execute({
        calldata: calldata.getBuffer(),
    });

    vm.info(`Gas used: ${response.usedGas}`);
    Assert.expect(response.usedGas).toBeGreaterThan(0n);
});
```

### Compare Gas Costs

```typescript
await vm.it('should compare gas costs', async () => {
    // Simple read
    const readResponse = await contract.getValue();
    vm.info(`Read gas: ${readResponse.usedGas}`);

    // Storage write (more expensive)
    const writeResponse = await contract.setValue(42n);
    vm.info(`Write gas: ${writeResponse.usedGas}`);

    Assert.expect(writeResponse.usedGas).toBeGreaterThan(readResponse.usedGas);
});
```

### Assert Gas Bounds

```typescript
await vm.it('should stay within gas budget', async () => {
    const response = await contract.expensiveOperation();

    // Ensure operation doesn't exceed budget
    Assert.expect(response.usedGas).toBeLessThan(1_000_000_000n);
});
```

---

## Gas Conversion Utilities

Convert gas to real-world costs:

```typescript
import { gas2Sat, gas2BTC, gas2USD } from '@btc-vision/unit-test-framework';

await vm.it('should calculate operation cost', async () => {
    const response = await contract.execute({ calldata });

    const sats = gas2Sat(response.usedGas);
    const btc = gas2BTC(response.usedGas);
    const usd = gas2USD(response.usedGas, 100_000); // $100k BTC

    vm.info(`Gas: ${response.usedGas}`);
    vm.info(`Cost: ${sats} sats / ${btc.toFixed(8)} BTC / $${usd.toFixed(4)}`);
});
```

---

## Gas for Storage Operations

Storage writes are significantly more expensive than reads:

```typescript
await vm.it('should measure storage gas costs', async () => {
    // New storage slot (cold write - most expensive)
    const coldWrite = await contract.storeNewSlot(key, value);
    vm.info(`Cold storage write: ${coldWrite.usedGas}`);

    // Existing slot (warm write - cheaper)
    const warmWrite = await contract.storeExistingSlot(key, newValue);
    vm.info(`Warm storage write: ${warmWrite.usedGas}`);

    Assert.expect(coldWrite.usedGas).toBeGreaterThan(warmWrite.usedGas);
});
```

---

## Deployment Gas

Track gas used during contract deployment:

```typescript
Blockchain.traceDeployments = true;

await vm.it('should measure deployment gas', async () => {
    const contract = new MyContract(deployer, address);
    Blockchain.register(contract);
    await contract.init();

    vm.info(`Deployment gas: ${contract.gasUsed}`);
});
```

---

## Consensus Gas Limits

Access gas-related consensus parameters:

```typescript
import { configs } from '@btc-vision/unit-test-framework';

const maxGas = configs.CONSENSUS.GAS.TRANSACTION_MAX_GAS;
const satToGas = configs.CONSENSUS.GAS.SAT_TO_GAS_RATIO;
const targetGas = configs.CONSENSUS.GAS.TARGET_GAS;

vm.info(`Max gas per tx: ${maxGas}`);
vm.info(`Sat-to-gas ratio: ${satToGas}`);
```

---

[<- Previous: State Management](./state-management.md) | [Next: Consensus Rules ->](./consensus-rules.md)

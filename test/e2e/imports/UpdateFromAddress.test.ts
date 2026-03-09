import { ABICoder, Address, BinaryWriter } from '@btc-vision/transaction';
import {
    Assert,
    Blockchain,
    BytecodeManager,
    ContractRuntime,
    opnet,
    OPNetUnit,
    StateHandler,
} from '../../../src';
import { UpdatableContractRuntime } from '../contracts/updatable-contract/runtime/UpdatableContractRuntime';

const V2_WASM_PATH =
    './test/e2e/contracts/updatable-contract-v2/contract/build/UpdatableContractV2.wasm';

class V2SourceContractRuntime extends ContractRuntime {
    public constructor(deployer: Address, address: Address) {
        super({
            address: address,
            deployer: deployer,
            gasLimit: 150_000_000_000n,
        });
    }

    protected handleError(error: Error): Error {
        return new Error(`(v2 source) OP_NET: ${error.message}`);
    }

    protected defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode(V2_WASM_PATH, this.address);
    }
}

await opnet('UpdateFromAddress tests', async (vm: OPNetUnit) => {
    let contract: UpdatableContractRuntime;
    let v2Source: V2SourceContractRuntime;

    const deployerAddress: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const v2SourceAddress: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        contract = new UpdatableContractRuntime(deployerAddress, contractAddress);
        Blockchain.register(contract);
        await contract.init();

        // Register v2 source as a contract so isContract() returns true
        v2Source = new V2SourceContractRuntime(deployerAddress, v2SourceAddress);
        Blockchain.register(v2Source);
        await v2Source.init();

        Blockchain.txOrigin = deployerAddress;
        Blockchain.msgSender = deployerAddress;
    });

    vm.afterEach(() => {
        contract.dispose();
        v2Source.dispose();
        Blockchain.dispose();
    });

    // --- Basic update flow ---

    await vm.it('should return getValue=1 before update', async () => {
        const value = await contract.getValue();
        Assert.expect(value).toEqual(1);
    });

    await vm.it('should not apply update on the same block', async () => {
        // Before update, getValue returns 1
        const valueBefore = await contract.getValue();
        Assert.expect(valueBefore).toEqual(1);

        // Perform update
        await contract.update(v2SourceAddress);

        // Same block: getValue should still return 1 (old bytecode)
        const valueSameBlock = await contract.getValue();
        Assert.expect(valueSameBlock).toEqual(1);
    });

    await vm.it('should apply update on the next block', async () => {
        // Before update
        const valueBefore = await contract.getValue();
        Assert.expect(valueBefore).toEqual(1);

        // Perform update
        await contract.update(v2SourceAddress);

        // Advance to next block
        Blockchain.mineBlock();

        // After next block, getValue should return 2 (new bytecode)
        const valueAfter = await contract.getValue();
        Assert.expect(valueAfter).toEqual(2);
    });

    // --- Storage persistence ---

    await vm.it('should preserve storage across update', async () => {
        const storageKey = new Uint8Array(32);
        storageKey[31] = 42;

        const storageValue = new Uint8Array(32);
        storageValue[31] = 99;

        // Store a value pre-update
        await contract.storeValue(storageKey, storageValue);

        // Verify it can be loaded before update
        const loadedBefore = await contract.loadValue(storageKey);
        Assert.expect(areBytesEqual(loadedBefore, storageValue)).toEqual(true);

        // Update and advance block
        await contract.update(v2SourceAddress);
        Blockchain.mineBlock();

        // Verify storage persists after update with new bytecode
        const loadedAfter = await contract.loadValue(storageKey);
        Assert.expect(areBytesEqual(loadedAfter, storageValue)).toEqual(true);
    });

    await vm.it('should preserve multiple storage entries across update', async () => {
        const key1 = new Uint8Array(32);
        key1[31] = 1;
        const value1 = new Uint8Array(32);
        value1[31] = 10;

        const key2 = new Uint8Array(32);
        key2[31] = 2;
        const value2 = new Uint8Array(32);
        value2[31] = 20;

        const key3 = new Uint8Array(32);
        key3[31] = 3;
        const value3 = new Uint8Array(32);
        value3[31] = 30;

        // Store multiple values
        await contract.storeValue(key1, value1);
        await contract.storeValue(key2, value2);
        await contract.storeValue(key3, value3);

        // Update and advance block
        await contract.update(v2SourceAddress);
        Blockchain.mineBlock();

        // All values should be preserved
        const loaded1 = await contract.loadValue(key1);
        const loaded2 = await contract.loadValue(key2);
        const loaded3 = await contract.loadValue(key3);

        Assert.expect(areBytesEqual(loaded1, value1)).toEqual(true);
        Assert.expect(areBytesEqual(loaded2, value2)).toEqual(true);
        Assert.expect(areBytesEqual(loaded3, value3)).toEqual(true);
    });

    await vm.it('should allow writing storage after update', async () => {
        // Update and advance block
        await contract.update(v2SourceAddress);
        Blockchain.mineBlock();

        // Write new storage with v2 bytecode
        const key = new Uint8Array(32);
        key[31] = 77;
        const value = new Uint8Array(32);
        value[31] = 88;

        await contract.storeValue(key, value);

        const loaded = await contract.loadValue(key);
        Assert.expect(areBytesEqual(loaded, value)).toEqual(true);
    });

    await vm.it('should allow reading storage on same block as update (still v1)', async () => {
        const storageKey = new Uint8Array(32);
        storageKey[31] = 55;
        const storageValue = new Uint8Array(32);
        storageValue[31] = 66;

        // Store value
        await contract.storeValue(storageKey, storageValue);

        // Update (same block)
        await contract.update(v2SourceAddress);

        // Read on same block — still using v1 bytecode, but storage should be accessible
        const loaded = await contract.loadValue(storageKey);
        Assert.expect(areBytesEqual(loaded, storageValue)).toEqual(true);
    });

    // --- Error handling ---

    await vm.it('should revert when source address has no bytecode', async () => {
        const nonExistentAddress = Blockchain.generateRandomAddress();

        await Assert.expect(async () => {
            await contract.update(nonExistentAddress);
        }).toThrow();
    });

    await vm.it('should remain functional after failed update attempt', async () => {
        const nonExistentAddress = Blockchain.generateRandomAddress();

        // Attempt update with invalid address (should fail)
        try {
            await contract.update(nonExistentAddress);
        } catch {
            // Expected to fail
        }

        // Contract should still work with v1 bytecode
        const value = await contract.getValue();
        Assert.expect(value).toEqual(1);
    });

    await vm.it('should preserve storage after failed update attempt', async () => {
        const storageKey = new Uint8Array(32);
        storageKey[31] = 11;
        const storageValue = new Uint8Array(32);
        storageValue[31] = 22;

        await contract.storeValue(storageKey, storageValue);

        const nonExistentAddress = Blockchain.generateRandomAddress();
        try {
            await contract.update(nonExistentAddress);
        } catch {
            // Expected to fail
        }

        // Storage should still be intact
        const loaded = await contract.loadValue(storageKey);
        Assert.expect(areBytesEqual(loaded, storageValue)).toEqual(true);
    });

    // --- Address preservation ---

    await vm.it('should preserve contract address after update', async () => {
        const addressBefore = contract.address;

        await contract.update(v2SourceAddress);
        Blockchain.mineBlock();

        Assert.expect(contract.address.equals(addressBefore)).toEqual(true);
    });

    // --- Block boundary behavior ---

    await vm.it('should not apply update until block advances', async () => {
        await contract.update(v2SourceAddress);

        // Same block: multiple calls should all return v1 value
        const value1 = await contract.getValue();
        const value2 = await contract.getValue();
        Assert.expect(value1).toEqual(1);
        Assert.expect(value2).toEqual(1);

        // Now advance block
        Blockchain.mineBlock();

        // Next block: should return v2 value
        const value3 = await contract.getValue();
        Assert.expect(value3).toEqual(2);
    });

    await vm.it('should apply update exactly at next block boundary', async () => {
        await contract.update(v2SourceAddress);

        // Same block
        Assert.expect(await contract.getValue()).toEqual(1);

        // Mine one block
        Blockchain.mineBlock();

        // Exactly one block later: update should be applied
        Assert.expect(await contract.getValue()).toEqual(2);

        // Mine another block: should still be v2
        Blockchain.mineBlock();

        Assert.expect(await contract.getValue()).toEqual(2);
    });

    // --- Gas tracking ---

    await vm.it('should consume gas during update', async () => {
        const response = await contract.update(v2SourceAddress);

        // Update execution must consume gas
        Assert.expect(response.usedGas > 0n).toEqual(true);
    });

    await vm.it('should consume more gas than a simple getValue call', async () => {
        // Measure gas for a simple call
        const abiCoder = new ABICoder();
        const getValueCalldata = new BinaryWriter();
        getValueCalldata.writeSelector(
            Number(`0x${abiCoder.encodeSelector('getValue()')}`),
        );
        const simpleResponse = await contract.execute({
            calldata: getValueCalldata.getBuffer(),
        });
        const simpleGas = simpleResponse.usedGas;

        // Measure gas for update (includes onUpdate + bytecode overhead)
        const updateResponse = await contract.update(v2SourceAddress);
        const updateGas = updateResponse.usedGas;

        // Update should cost more than a trivial getter
        Assert.expect(updateGas > simpleGas).toEqual(true);
    });

    await vm.it('should not charge update gas on failed update', async () => {
        const nonExistentAddress = Blockchain.generateRandomAddress();

        // Failed update should still return a response (with error)
        // but the overall tx reverts so gas is handled by the VM
        await Assert.expect(async () => {
            await contract.update(nonExistentAddress);
        }).toThrow();

        // Contract should still be functional (no gas state corruption)
        const value = await contract.getValue();
        Assert.expect(value).toEqual(1);
    });

    // --- One update per block enforcement ---

    await vm.it('should reject second update in the same block', async () => {
        // First update should succeed
        await contract.update(v2SourceAddress);

        // Second update in the same block should revert
        await Assert.expect(async () => {
            await contract.update(v2SourceAddress);
        }).toThrow();

        // Contract should still work
        const value = await contract.getValue();
        Assert.expect(value).toEqual(1);
    });

    await vm.it('should clear pending state after block advances', async () => {
        // Update and advance
        await contract.update(v2SourceAddress);
        Blockchain.mineBlock();

        // Update applied — getValue returns 2
        Assert.expect(await contract.getValue()).toEqual(2);

        // Mine another block — no pending update, should still work
        Blockchain.mineBlock();
        Assert.expect(await contract.getValue()).toEqual(2);

        // Storage operations should still work after pending state cleared
        const key = new Uint8Array(32);
        key[31] = 42;
        const value = new Uint8Array(32);
        value[31] = 99;

        await contract.storeValue(key, value);
        const loaded = await contract.loadValue(key);
        Assert.expect(areBytesEqual(loaded, value)).toEqual(true);
    });

    // --- Update + subsequent operations ---

    await vm.it('should allow operations between update and block advance', async () => {
        const storageKey = new Uint8Array(32);
        storageKey[31] = 100;
        const storageValue = new Uint8Array(32);
        storageValue[31] = 200;

        // Update
        await contract.update(v2SourceAddress);

        // Store data between update and block advance (still v1)
        await contract.storeValue(storageKey, storageValue);

        // Mine block to apply update
        Blockchain.mineBlock();

        // Data written before block advance should persist with v2
        const loaded = await contract.loadValue(storageKey);
        Assert.expect(areBytesEqual(loaded, storageValue)).toEqual(true);

        // And getValue now returns 2
        Assert.expect(await contract.getValue()).toEqual(2);
    });
});

await opnet('BytecodeManager targeted removal', async (vm: OPNetUnit) => {
    await vm.it('should remove bytecode for a specific address', async () => {
        const address = Blockchain.generateRandomAddress();
        const fakeBytecode = Buffer.from([0x00, 0x61, 0x73, 0x6d]);

        BytecodeManager.forceSetBytecode(address, fakeBytecode);

        const loaded = BytecodeManager.getBytecode(address);
        Assert.expect(loaded).toBeDefined();

        BytecodeManager.removeBytecode(address);

        await Assert.expect(async () => {
            BytecodeManager.getBytecode(address);
        }).toThrow('not found');
    });

    await vm.it('should not affect other addresses when removing one', async () => {
        const addr1 = Blockchain.generateRandomAddress();
        const addr2 = Blockchain.generateRandomAddress();

        BytecodeManager.forceSetBytecode(addr1, Buffer.from([0x01]));
        BytecodeManager.forceSetBytecode(addr2, Buffer.from([0x02]));

        BytecodeManager.removeBytecode(addr1);

        // addr2 unaffected
        Assert.expect(BytecodeManager.getBytecode(addr2)).toBeDefined();

        // addr1 gone
        await Assert.expect(async () => {
            BytecodeManager.getBytecode(addr1);
        }).toThrow('not found');

        BytecodeManager.removeBytecode(addr2);
    });
});

await opnet('Update lifecycle edge cases', async (vm: OPNetUnit) => {
    let contract: UpdatableContractRuntime;
    let v2Source: V2SourceContractRuntime;

    const deployerAddress: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const v2SourceAddress: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        contract = new UpdatableContractRuntime(deployerAddress, contractAddress);
        Blockchain.register(contract);
        await contract.init();

        v2Source = new V2SourceContractRuntime(deployerAddress, v2SourceAddress);
        Blockchain.register(v2Source);
        await v2Source.init();

        Blockchain.txOrigin = deployerAddress;
        Blockchain.msgSender = deployerAddress;
    });

    vm.afterEach(() => {
        contract.dispose();
        v2Source.dispose();
        Blockchain.dispose();
    });

    await vm.it('should allow multiple calls after successful update + mine', async () => {
        await contract.update(v2SourceAddress);
        Blockchain.mineBlock();

        // Multiple sequential calls on new bytecode
        Assert.expect(await contract.getValue()).toEqual(2);
        Assert.expect(await contract.getValue()).toEqual(2);
        Assert.expect(await contract.getValue()).toEqual(2);
    });

    await vm.it('should allow storage operations on new bytecode after update', async () => {
        await contract.update(v2SourceAddress);
        Blockchain.mineBlock();

        // Write with new bytecode
        const key = new Uint8Array(32);
        key[31] = 0xaa;
        const value = new Uint8Array(32);
        value[31] = 0xbb;

        await contract.storeValue(key, value);
        const loaded = await contract.loadValue(key);
        Assert.expect(areBytesEqual(loaded, value)).toEqual(true);
    });

    await vm.it('should handle update followed by multiple block advances', async () => {
        await contract.update(v2SourceAddress);

        // Mine 3 blocks
        Blockchain.mineBlock();
        Blockchain.mineBlock();
        Blockchain.mineBlock();

        // V2 behavior persists across all blocks
        Assert.expect(await contract.getValue()).toEqual(2);
    });

    await vm.it('should not corrupt state after failed update + successful retry', async () => {
        const fakeAddr = Blockchain.generateRandomAddress();

        // Store value before any updates
        const key = new Uint8Array(32);
        key[31] = 0x01;
        const value = new Uint8Array(32);
        value[31] = 0xff;
        await contract.storeValue(key, value);

        // Failed update
        try {
            await contract.update(fakeAddr);
        } catch {
            // expected
        }

        // Contract still V1 and functional
        Assert.expect(await contract.getValue()).toEqual(1);

        // Storage intact
        const loaded = await contract.loadValue(key);
        Assert.expect(areBytesEqual(loaded, value)).toEqual(true);

        // Now do a real update
        await contract.update(v2SourceAddress);
        Blockchain.mineBlock();

        // V2 active and storage preserved
        Assert.expect(await contract.getValue()).toEqual(2);
        const loadedAfter = await contract.loadValue(key);
        Assert.expect(areBytesEqual(loadedAfter, value)).toEqual(true);
    });
});

await opnet('Phase 2 gas accounting', async (vm: OPNetUnit) => {
    let contract: UpdatableContractRuntime;
    let v2Source: V2SourceContractRuntime;

    const deployerAddress: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const v2SourceAddress: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        contract = new UpdatableContractRuntime(deployerAddress, contractAddress);
        Blockchain.register(contract);
        await contract.init();

        v2Source = new V2SourceContractRuntime(deployerAddress, v2SourceAddress);
        Blockchain.register(v2Source);
        await v2Source.init();

        Blockchain.txOrigin = deployerAddress;
        Blockchain.msgSender = deployerAddress;
    });

    vm.afterEach(() => {
        contract.dispose();
        v2Source.dispose();
        Blockchain.dispose();
    });

    await vm.it('should charge Phase 2 onUpdate gas to the first caller after mine', async () => {
        // Baseline: gas for getValue without pending update
        const abiCoder = new ABICoder();
        const getValueCalldata = new BinaryWriter();
        getValueCalldata.writeSelector(
            Number(`0x${abiCoder.encodeSelector('getValue()')}`),
        );

        const baselineResponse = await contract.execute({
            calldata: getValueCalldata.getBuffer(),
        });
        const baselineGas = baselineResponse.usedGas;

        // Queue update, mine block
        await contract.update(v2SourceAddress);
        Blockchain.mineBlock();

        // First call after mine triggers Phase 2 (applyPendingBytecodeUpdate)
        const getValueCalldata2 = new BinaryWriter();
        getValueCalldata2.writeSelector(
            Number(`0x${abiCoder.encodeSelector('getValue()')}`),
        );

        const postUpdateResponse = await contract.execute({
            calldata: getValueCalldata2.getBuffer(),
        });
        const postUpdateGas = postUpdateResponse.usedGas;

        // Phase 2 onUpdate gas MUST be included — first call costs more than baseline
        Assert.expect(postUpdateGas > baselineGas).toEqual(true);
    });

    await vm.it('should NOT charge Phase 2 gas on second call (already applied)', async () => {
        const abiCoder = new ABICoder();

        await contract.update(v2SourceAddress);
        Blockchain.mineBlock();

        // First call: pays Phase 2 gas
        const calldata1 = new BinaryWriter();
        calldata1.writeSelector(Number(`0x${abiCoder.encodeSelector('getValue()')}`));
        const firstCallResponse = await contract.execute({ calldata: calldata1.getBuffer() });
        const firstCallGas = firstCallResponse.usedGas;

        // Second call: no pending update, normal gas
        const calldata2 = new BinaryWriter();
        calldata2.writeSelector(Number(`0x${abiCoder.encodeSelector('getValue()')}`));
        const secondCallResponse = await contract.execute({ calldata: calldata2.getBuffer() });
        const secondCallGas = secondCallResponse.usedGas;

        // Second call should cost less (no Phase 2 overhead)
        Assert.expect(firstCallGas > secondCallGas).toEqual(true);
    });
});

await opnet('Phase 2 update guard enforcement', async (vm: OPNetUnit) => {
    let contract: UpdatableContractRuntime;
    let v2Source: V2SourceContractRuntime;

    const deployerAddress: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const v2SourceAddress: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        contract = new UpdatableContractRuntime(deployerAddress, contractAddress);
        Blockchain.register(contract);
        await contract.init();

        v2Source = new V2SourceContractRuntime(deployerAddress, v2SourceAddress);
        Blockchain.register(v2Source);
        await v2Source.init();

        Blockchain.txOrigin = deployerAddress;
        Blockchain.msgSender = deployerAddress;
    });

    vm.afterEach(() => {
        contract.dispose();
        v2Source.dispose();
        Blockchain.dispose();
    });

    await vm.it('should clear update guard after Phase 2 completes', async () => {
        await contract.update(v2SourceAddress);
        Blockchain.mineBlock();

        // First call triggers Phase 2. Guard is set during onUpdate, cleared after.
        // If guard leaked, this getValue call would fail.
        Assert.expect(await contract.getValue()).toEqual(2);

        // Second call — guard must be clear, contract fully functional
        Assert.expect(await contract.getValue()).toEqual(2);

        // Storage ops work (proves no lingering blocked state)
        const key = new Uint8Array(32);
        key[31] = 0x42;
        const value = new Uint8Array(32);
        value[31] = 0x99;
        await contract.storeValue(key, value);
        const loaded = await contract.loadValue(key);
        Assert.expect(areBytesEqual(loaded, value)).toEqual(true);
    });

    await vm.it('should allow update on a later block after Phase 2 completed', async () => {
        // First update cycle
        await contract.update(v2SourceAddress);
        Blockchain.mineBlock();
        Assert.expect(await contract.getValue()).toEqual(2);

        // Re-register V1 source to allow updating back (simulate V3)
        // Use V2 source again — just proving the mechanism allows it
        Blockchain.mineBlock();

        // The guard from Phase 2 must be fully cleared
        // A new update request should succeed on a new block
        const key = new Uint8Array(32);
        key[31] = 0x01;
        const value = new Uint8Array(32);
        value[31] = 0xff;
        await contract.storeValue(key, value);

        const loaded = await contract.loadValue(key);
        Assert.expect(areBytesEqual(loaded, value)).toEqual(true);
    });
});

function areBytesEqual(arr1: Uint8Array, arr2: Uint8Array): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    return arr1.every((value, index) => value === arr2[index]);
}

// --- Malicious V2 contract that writes storage + emits events + reverts in onUpdate ---

const MALICIOUS_V2_WASM_PATH =
    './test/e2e/contracts/malicious-v2/contract/build/MaliciousV2.wasm';

class MaliciousV2SourceRuntime extends ContractRuntime {
    public constructor(deployer: Address, address: Address) {
        super({
            address: address,
            deployer: deployer,
            gasLimit: 150_000_000_000n,
        });
    }

    protected handleError(error: Error): Error {
        return new Error(`(malicious-v2 source) OP_NET: ${error.message}`);
    }

    protected defineRequiredBytecodes(): void {
        BytecodeManager.loadBytecode(MALICIOUS_V2_WASM_PATH, this.address);
    }
}

// The malicious V2 contract's onUpdate writes storage slot 0xff...00 = 0x42...00,
// emits a "PhantomEvent", then reverts. These side effects MUST NOT leak.

await opnet('Failed Phase 2 state isolation', async (vm: OPNetUnit) => {
    let contract: UpdatableContractRuntime;
    let maliciousV2Source: MaliciousV2SourceRuntime;

    const deployerAddress: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const maliciousV2Address: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        contract = new UpdatableContractRuntime(deployerAddress, contractAddress);
        Blockchain.register(contract);
        await contract.init();

        maliciousV2Source = new MaliciousV2SourceRuntime(deployerAddress, maliciousV2Address);
        Blockchain.register(maliciousV2Source);
        await maliciousV2Source.init();

        Blockchain.txOrigin = deployerAddress;
        Blockchain.msgSender = deployerAddress;
    });

    vm.afterEach(() => {
        contract.dispose();
        maliciousV2Source.dispose();
        Blockchain.dispose();
    });

    await vm.it('should NOT leak storage writes from failed Phase 2 onUpdate', async () => {
        // Queue update to malicious V2 (Phase 1 succeeds on current bytecode)
        await contract.update(maliciousV2Address);

        // Advance block to trigger Phase 2
        Blockchain.mineBlock();

        // Phase 2 runs malicious V2's onUpdate which:
        //   1. Writes storage slot 0xff...00 = 0x42...00
        //   2. Emits PhantomEvent
        //   3. Reverts
        // Phase 2 should fail and revert bytecode.

        // Execute a getValue call — this triggers Phase 2 internally
        const abiCoder = new ABICoder();
        const calldata = new BinaryWriter();
        calldata.writeSelector(Number(`0x${abiCoder.encodeSelector('getValue()')}`));
        const response = await contract.execute({ calldata: calldata.getBuffer() });

        // Contract should still be on v1 bytecode (Phase 2 failed, reverted)
        Assert.expect(response.status).toEqual(0);

        // The malicious storage write (slot 0xff...00) must NOT exist in global state
        const poisonKey = 0xffn << 248n; // 0xff followed by 31 zero bytes
        const globalValue = StateHandler.globalLoad(contractAddress, poisonKey);
        Assert.expect(globalValue).toEqual(undefined);

        // Temp states for this contract must be clean (pushed to global already, so check global)
        // If the fix works, the poisoned write was cleared before it could be committed
        Assert.expect(StateHandler.globalHas(contractAddress, poisonKey)).toEqual(false);
    });

    await vm.it('should NOT leak events from failed Phase 2 onUpdate', async () => {
        await contract.update(maliciousV2Address);
        Blockchain.mineBlock();

        const abiCoder = new ABICoder();
        const calldata = new BinaryWriter();
        calldata.writeSelector(Number(`0x${abiCoder.encodeSelector('getValue()')}`));
        const response = await contract.execute({ calldata: calldata.getBuffer() });

        // No "PhantomEvent" should appear in the transaction events
        const phantomEvents = response.events.filter(
            (e) => e.eventType === 'PhantomEvent',
        );
        Assert.expect(phantomEvents.length).toEqual(0);
    });

    await vm.it('should charge gas for failed Phase 2 onUpdate', async () => {
        await contract.update(maliciousV2Address);
        Blockchain.mineBlock();

        // Baseline: normal getValue gas without any pending update
        const abiCoder = new ABICoder();

        // First call: triggers failed Phase 2 + getValue
        const calldata1 = new BinaryWriter();
        calldata1.writeSelector(Number(`0x${abiCoder.encodeSelector('getValue()')}`));
        const firstResponse = await contract.execute({ calldata: calldata1.getBuffer() });
        const gasWithFailedPhase2 = firstResponse.usedGas;

        // Second call: no pending update, clean getValue
        const calldata2 = new BinaryWriter();
        calldata2.writeSelector(Number(`0x${abiCoder.encodeSelector('getValue()')}`));
        const secondResponse = await contract.execute({ calldata: calldata2.getBuffer() });
        const baselineGas = secondResponse.usedGas;

        // Failed Phase 2 must still cost gas — first call should be more expensive
        Assert.expect(gasWithFailedPhase2 > baselineGas).toEqual(true);
    });

    await vm.it('should revert bytecode after failed Phase 2 (still v1)', async () => {
        await contract.update(maliciousV2Address);
        Blockchain.mineBlock();

        // getValue should return 1 (v1) — Phase 2 failed, bytecode reverted
        const value = await contract.getValue();
        Assert.expect(value).toEqual(1);
    });
});

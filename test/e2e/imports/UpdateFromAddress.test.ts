import { Address } from '@btc-vision/transaction';
import { Assert, Blockchain, BytecodeManager, ContractRuntime, opnet, OPNetUnit } from '../../../src';
import { UpgradeableContractRuntime } from '../contracts/upgradeable-contract/runtime/UpgradeableContractRuntime';

const V2_WASM_PATH =
    './test/e2e/contracts/upgradeable-contract-v2/contract/build/UpgradeableContractV2.wasm';

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
    let contract: UpgradeableContractRuntime;
    let v2Source: V2SourceContractRuntime;

    const deployerAddress: Address = Blockchain.generateRandomAddress();
    const contractAddress: Address = Blockchain.generateRandomAddress();
    const v2SourceAddress: Address = Blockchain.generateRandomAddress();

    vm.beforeEach(async () => {
        Blockchain.dispose();
        Blockchain.clearContracts();
        await Blockchain.init();

        contract = new UpgradeableContractRuntime(deployerAddress, contractAddress);
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

    // --- Basic upgrade flow ---

    await vm.it('should return getValue=1 before upgrade', async () => {
        const value = await contract.getValue();
        Assert.expect(value).toEqual(1);
    });

    await vm.it('should not apply upgrade on the same block', async () => {
        // Before upgrade, getValue returns 1
        const valueBefore = await contract.getValue();
        Assert.expect(valueBefore).toEqual(1);

        // Perform upgrade
        await contract.upgrade(v2SourceAddress);

        // Same block: getValue should still return 1 (old bytecode)
        const valueSameBlock = await contract.getValue();
        Assert.expect(valueSameBlock).toEqual(1);
    });

    await vm.it('should apply upgrade on the next block', async () => {
        // Before upgrade
        const valueBefore = await contract.getValue();
        Assert.expect(valueBefore).toEqual(1);

        // Perform upgrade
        await contract.upgrade(v2SourceAddress);

        // Advance to next block
        Blockchain.mineBlock();

        // After next block, getValue should return 2 (new bytecode)
        const valueAfter = await contract.getValue();
        Assert.expect(valueAfter).toEqual(2);
    });

    // --- Storage persistence ---

    await vm.it('should preserve storage across upgrade', async () => {
        const storageKey = new Uint8Array(32);
        storageKey[31] = 42;

        const storageValue = new Uint8Array(32);
        storageValue[31] = 99;

        // Store a value pre-upgrade
        await contract.storeValue(storageKey, storageValue);

        // Verify it can be loaded before upgrade
        const loadedBefore = await contract.loadValue(storageKey);
        Assert.expect(areBytesEqual(loadedBefore, storageValue)).toEqual(true);

        // Upgrade and advance block
        await contract.upgrade(v2SourceAddress);
        Blockchain.mineBlock();

        // Verify storage persists after upgrade with new bytecode
        const loadedAfter = await contract.loadValue(storageKey);
        Assert.expect(areBytesEqual(loadedAfter, storageValue)).toEqual(true);
    });

    await vm.it('should preserve multiple storage entries across upgrade', async () => {
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

        // Upgrade and advance block
        await contract.upgrade(v2SourceAddress);
        Blockchain.mineBlock();

        // All values should be preserved
        const loaded1 = await contract.loadValue(key1);
        const loaded2 = await contract.loadValue(key2);
        const loaded3 = await contract.loadValue(key3);

        Assert.expect(areBytesEqual(loaded1, value1)).toEqual(true);
        Assert.expect(areBytesEqual(loaded2, value2)).toEqual(true);
        Assert.expect(areBytesEqual(loaded3, value3)).toEqual(true);
    });

    await vm.it('should allow writing storage after upgrade', async () => {
        // Upgrade and advance block
        await contract.upgrade(v2SourceAddress);
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

    await vm.it('should allow reading storage on same block as upgrade (still v1)', async () => {
        const storageKey = new Uint8Array(32);
        storageKey[31] = 55;
        const storageValue = new Uint8Array(32);
        storageValue[31] = 66;

        // Store value
        await contract.storeValue(storageKey, storageValue);

        // Upgrade (same block)
        await contract.upgrade(v2SourceAddress);

        // Read on same block — still using v1 bytecode, but storage should be accessible
        const loaded = await contract.loadValue(storageKey);
        Assert.expect(areBytesEqual(loaded, storageValue)).toEqual(true);
    });

    // --- Error handling ---

    await vm.it('should revert when source address has no bytecode', async () => {
        const nonExistentAddress = Blockchain.generateRandomAddress();

        await Assert.expect(async () => {
            await contract.upgrade(nonExistentAddress);
        }).toThrow();
    });

    await vm.it('should remain functional after failed upgrade attempt', async () => {
        const nonExistentAddress = Blockchain.generateRandomAddress();

        // Attempt upgrade with invalid address (should fail)
        try {
            await contract.upgrade(nonExistentAddress);
        } catch {
            // Expected to fail
        }

        // Contract should still work with v1 bytecode
        const value = await contract.getValue();
        Assert.expect(value).toEqual(1);
    });

    await vm.it('should preserve storage after failed upgrade attempt', async () => {
        const storageKey = new Uint8Array(32);
        storageKey[31] = 11;
        const storageValue = new Uint8Array(32);
        storageValue[31] = 22;

        await contract.storeValue(storageKey, storageValue);

        const nonExistentAddress = Blockchain.generateRandomAddress();
        try {
            await contract.upgrade(nonExistentAddress);
        } catch {
            // Expected to fail
        }

        // Storage should still be intact
        const loaded = await contract.loadValue(storageKey);
        Assert.expect(areBytesEqual(loaded, storageValue)).toEqual(true);
    });

    // --- Address preservation ---

    await vm.it('should preserve contract address after upgrade', async () => {
        const addressBefore = contract.address;

        await contract.upgrade(v2SourceAddress);
        Blockchain.mineBlock();

        Assert.expect(contract.address.equals(addressBefore)).toEqual(true);
    });

    // --- Block boundary behavior ---

    await vm.it('should not apply upgrade until block advances', async () => {
        await contract.upgrade(v2SourceAddress);

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

    await vm.it('should apply upgrade exactly at next block boundary', async () => {
        await contract.upgrade(v2SourceAddress);

        // Same block
        Assert.expect(await contract.getValue()).toEqual(1);

        // Mine one block
        Blockchain.mineBlock();

        // Exactly one block later: upgrade should be applied
        Assert.expect(await contract.getValue()).toEqual(2);

        // Mine another block: should still be v2
        Blockchain.mineBlock();

        Assert.expect(await contract.getValue()).toEqual(2);
    });

    await vm.it('should allow operations between upgrade and block advance', async () => {
        const storageKey = new Uint8Array(32);
        storageKey[31] = 100;
        const storageValue = new Uint8Array(32);
        storageValue[31] = 200;

        // Upgrade
        await contract.upgrade(v2SourceAddress);

        // Store data between upgrade and block advance (still v1)
        await contract.storeValue(storageKey, storageValue);

        // Mine block to apply upgrade
        Blockchain.mineBlock();

        // Data written before block advance should persist with v2
        const loaded = await contract.loadValue(storageKey);
        Assert.expect(areBytesEqual(loaded, storageValue)).toEqual(true);

        // And getValue now returns 2
        Assert.expect(await contract.getValue()).toEqual(2);
    });
});

function areBytesEqual(arr1: Uint8Array, arr2: Uint8Array): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    return arr1.every((value, index) => value === arr2[index]);
}

import {
    Address,
    Blockchain,
    BytesReader,
    BytesWriter,
    Calldata,
    encodeSelector,
    OP_NET,
} from '@btc-vision/btc-runtime/runtime';
import {
    callContract,
    getCallResult,
    ripemd160,
    sha256,
} from '@btc-vision/btc-runtime/runtime/env/global';

/*const ONE_MB: usize = 1048576; // 1 MiB  = 1 048 576 bytes

// Two contiguous 1 MiB heaps
const src = new StaticArray<u8>(ONE_MB);
const dst = new StaticArray<u8>(ONE_MB);

// Deterministic pattern → corruption becomes obvious if you inspect
for (let i: usize = 0; i < ONE_MB; ++i) {
    unchecked((src[i] = <u8>i));
}

export function spamMemoryCopy(rounds: u32): void {
    // Pound the bulk-memory instruction
    const pSrc = changetype<usize>(src);
    const pDst = changetype<usize>(dst);

    for (let n: u32 = 0; n < rounds; ++n) {
        memory.copy(pDst, pSrc, ONE_MB);
    }

    while (true) {
        memory.fill(pDst, 0, ONE_MB);
    }
}

spamMemoryCopy(i32.MAX_VALUE);*/

@final
export class TestContract extends OP_NET {
    public constructor() {
        super();
    }

    @method('bytes')
    @returns('bytes32')
    public sha256(calldata: Calldata): BytesWriter {
        const data = calldata.readBytesWithLength();

        const result = sha256(data);

        const writer = new BytesWriter(32);
        writer.writeBytes(result);
        return writer;
    }

    @method('bytes')
    @returns('bytes')
    public ripemd160(calldata: Calldata): BytesWriter {
        const data = calldata.readBytesWithLength();

        const result = ripemd160(data);

        const writer = new BytesWriter(20);
        writer.writeBytes(result);
        return writer;
    }

    @method('bytes32', 'bytes32')
    @returns('bytes32')
    public store(calldata: Calldata): BytesWriter {
        const key = calldata.readBytes(32);
        const value = calldata.readBytes(32);

        Blockchain.setStorageAt(key, value);
        const result = new BytesWriter(32);
        result.writeBytes(value);
        return result;
    }

    @method('bytes32')
    @returns('bytes32')
    public load(calldata: Calldata): BytesWriter {
        const key = calldata.readBytes(32);

        const value = Blockchain.getStorageAt(key);
        const result = new BytesWriter(32);
        result.writeBytes(value);
        return result;
    }

    // @method('bytes32', 'bytes32')
    // @returns('bytes32')
    // public tStore(calldata: Calldata): BytesWriter {
    //     const key = calldata.readBytes(32);
    //     const value = calldata.readBytes(32);
    //
    //     Blockchain.setTransientStorageAt(key, value);
    //     const result = new BytesWriter(32);
    //     result.writeBytes(value);
    //     return result;
    // }
    //
    // @method('bytes32')
    // @returns('bytes32')
    // public tLoad(calldata: Calldata): BytesWriter {
    //     const key = calldata.readBytes(32);
    //
    //     const value = Blockchain.getTransientStorageAt(key);
    //     const result = new BytesWriter(32);
    //     result.writeBytes(value);
    //     return result;
    // }

    @method('address')
    @returns('uint32')
    public accountType(calldata: Calldata): BytesWriter {
        const address = calldata.readAddress();
        const result = new BytesWriter(4);
        const accountType = Blockchain.getAccountType(address);
        result.writeU32(accountType);
        return result;
    }

    @method('uint64')
    @returns('bytes32')
    public blockHash(calldata: Calldata): BytesWriter {
        const blockNumber = calldata.readU64();
        const result = new BytesWriter(32);
        const blockHash = Blockchain.getBlockHash(blockNumber);
        result.writeBytes(blockHash);
        return result;
    }

    @method()
    @returns('bytes32')
    public chainId(_: Calldata): BytesWriter {
        const result = new BytesWriter(32);
        result.writeBytes(Blockchain.chainId);
        return result;
    }

    @method()
    @returns('bytes32')
    public protocolId(_: Calldata): BytesWriter {
        const result = new BytesWriter(32);
        result.writeBytes(Blockchain.protocolId);
        return result;
    }

    @method('uint32')
    @returns('bool')
    public callThenGrowMemory(calldata: Calldata): BytesWriter {
        const pages = calldata.readU32();

        const growMemoryCalldata = new BytesWriter(8);
        growMemoryCalldata.writeSelector(encodeSelector('growMemory(uint32)'));
        growMemoryCalldata.writeU32(pages);

        const response = Blockchain.call(this.address, growMemoryCalldata);
        const success = response.readBoolean();

        const result = new BytesWriter(1);
        result.writeBoolean(success);

        return result;
    }

    @method('uint32', 'uint32')
    public growMemoryThenRecursiveCall(calldata: Calldata): BytesWriter {
        const pages = calldata.readU32();
        const numberOfCalls = calldata.readU32();

        this._growMemory(pages);

        const recursiveCallCalldata = new BytesWriter(8);
        recursiveCallCalldata.writeSelector(encodeSelector('recursiveCall(uint32)'));
        recursiveCallCalldata.writeU32(numberOfCalls - 1);
        Blockchain.call(this.address, recursiveCallCalldata);

        return new BytesWriter(0);
    }

    @method('uint32')
    @returns('bool')
    public growMemory(calldata: Calldata): BytesWriter {
        const pages = calldata.readU32();

        const success = this._growMemory(pages);

        const result = new BytesWriter(1);
        result.writeBoolean(success);
        return result;
    }

    public _growMemory(pages: u32): boolean {
        const previousMemorySize = memory.grow(pages);

        return previousMemorySize != -1;
    }

    @method('uint32')
    public recursiveCall(calldata: Calldata): BytesWriter {
        const numberOfCalls = calldata.readU32();

        if (numberOfCalls == 0) {
            return new BytesWriter(0);
        }

        const recursiveCallCalldata = new BytesWriter(8);
        recursiveCallCalldata.writeSelector(encodeSelector('recursiveCall(uint32)'));
        recursiveCallCalldata.writeU32(numberOfCalls - 1);

        Blockchain.call(this.address, recursiveCallCalldata);

        return new BytesWriter(0);
    }

    @method('bytes32', 'bytes32', 'bytes32')
    @returns('bytes32')
    public modifyStateThenCallFunctionModifyingStateThatReverts(calldata: Calldata): BytesWriter {
        const storageKey = calldata.readBytes(32);
        const firstStorageValue = calldata.readBytes(32);
        const secondStorageValue = calldata.readBytes(32);

        Blockchain.setStorageAt(storageKey, firstStorageValue);

        const subCallCalldata = new BytesWriter(4 + 32 + 32);
        subCallCalldata.writeSelector(encodeSelector('modifyStateThenRevert(bytes32,bytes32)'));
        subCallCalldata.writeBytes(storageKey);
        subCallCalldata.writeBytes(secondStorageValue);

        this.callDontRevertOnFailure(this.address, subCallCalldata);

        const finalStorageValue = Blockchain.getStorageAt(storageKey);

        const result = new BytesWriter(32);
        result.writeBytes(finalStorageValue);
        return result;
    }

    @method('bytes32', 'bytes32')
    public modifyStateThenRevert(calldata: Calldata): BytesWriter {
        const storageKey = calldata.readBytes(32);
        const storageValue = calldata.readBytes(32);

        Blockchain.setStorageAt(storageKey, storageValue);

        throw new Error('die');
    }

    @method('bytes32', 'bytes32')
    public callThenModifyState(calldata: Calldata): BytesWriter {
        const storageKey = calldata.readBytes(32);
        const storageValue = calldata.readBytes(32);

        const subCallCalldata = new BytesWriter(4 + 32 + 32);
        subCallCalldata.writeSelector(encodeSelector('modifyState(bytes32,bytes32)'));
        subCallCalldata.writeBytes(storageKey);
        subCallCalldata.writeBytes(storageValue);

        this.callDontRevertOnFailure(this.address, subCallCalldata);

        const finalStorageValue = Blockchain.getStorageAt(storageKey);

        const result = new BytesWriter(32);
        result.writeBytes(finalStorageValue);
        return result;
    }

    @method('bytes32', 'bytes32')
    public modifyState(calldata: Calldata): BytesWriter {
        const storageKey = calldata.readBytes(32);
        const storageValue = calldata.readBytes(32);

        Blockchain.setStorageAt(storageKey, storageValue);

        return new BytesWriter(0);
    }

    private callDontRevertOnFailure(
        destinationContract: Address,
        calldata: BytesWriter,
    ): BytesReader {
        const resultLengthBuffer = new ArrayBuffer(32);
        callContract(
            destinationContract.buffer,
            calldata.getBuffer().buffer,
            calldata.bufferLength(),
            resultLengthBuffer,
        );

        const reader = new BytesReader(Uint8Array.wrap(resultLengthBuffer));
        const resultLength = reader.readU32(true);
        const resultBuffer = new ArrayBuffer(resultLength);
        getCallResult(0, resultLength, resultBuffer);

        return new BytesReader(Uint8Array.wrap(resultBuffer));
    }
}

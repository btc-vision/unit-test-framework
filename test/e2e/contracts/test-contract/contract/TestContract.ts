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

/*
// @ts-ignore
@inline
function blackhole<T>(_x: T): void {
}

function TEST_E(): void {
    const blocks = new Array<ArrayBuffer>();
    while (true) blocks.push(new ArrayBuffer(1 << 16));
}

function TEST_F(): void {
    const funcs = new Array<() => void>();
    while (true) {
        funcs.push(TEST_F);
    }
}

function TEST_G(): void {
    const p: usize = memory.data(4);
    atomic.store<i32>(p, 0);

    const proof = new Uint8Array(192);
    const verifier = new Uint8Array(492);
    const result = Atomics.wait32(p, 0, <i64>0x7fff_ffff_ffff_ffff, proof, verifier); // let's wait 292 years

    if (result === Atomics.OK) {
        Blockchain.log('TEST_G: Atomics.wait32 returned OK');
    }

    if (result === Atomics.FAULT) {
        Blockchain.log('TEST_G: Atomics.wait32 returned FAULT');
    }

    if (result === Atomics.TIMED_OUT) {
        Blockchain.log('TEST_G: Atomics.wait32 returned TIMEOUT');
    }

    if (result === Atomics.NOT_EQUAL) {
        Blockchain.log('TEST_G: Atomics.wait32 returned NOT_EQUAL');
    }
}

function TEST_H(): void {
    const dst = memory.data(1 << 20);
    while (true) memory.fill(dst, 0, 1 << 20);
}

type Fn = () => void;

function PONG(): void {
    (PING as Fn)();
}

function PING(): void {
    (PONG as Fn)();
}

function TEST_J(): void {
    PING();
}

function TEST_K(): void {
    let x: f64 = NaN;
    while (!isNaN(x)) x *= 1.0001;
}

function TEST_L(): void {
    let v = v128.splat<i8>(1);      // lane type = i8
    while (true) {
        v = v128.add<i8>(v, v);       // use the same lane type here
    }
    blackhole(v);
}

function boom(): never {
    throw new Error('trap');
}

function TEST_M(): void {
    try {
        boom();
    } catch (err) {
        TEST_M();
    }
}

function TEST_N(): void {
    for (; ;) {
    }
}

function TEST_O(): void {
    let x = 1;
    while (true) {
        try {
            blackhole(x / (x - 1));
        } catch (err) {
        }
    }
}

function TEST_P(): void {
    const a = v128.splat<i32>(0);
    let b = a;
    for (; ;) {
        b = v128.relaxed_madd<i32>(a, b, a); // potential consensus hazard
    }
}

function fingerprint(iterations: i32): i64 {
    const vecA: v128 = f32x4.splat(1.337);
    const vecB: v128 = f32x4.splat(-3.1415);
    let acc: v128 = f32x4.splat(0.0);

    for (let i = 0; i < iterations; ++i) {
        // create a varying vector
        const ints: v128 = i32x4.splat(i);
        const floats: v128 = f32x4.convert_i32x4_s(ints);

        // relaxed-deterministic, hardware-driven ops
        const m = v128.relaxed_min<f32>(floats, vecA); // f32x4.relaxed_min
        const mx = v128.relaxed_max<f32>(m, vecB);   // f32x4.relaxed_max
        acc = f32x4.add(acc, mx);
    }

    // reduce four lanes → single 64-bit hash
    const h0 = reinterpret<i32>(f32x4.extract_lane(acc, 0));
    const h1 = reinterpret<i32>(f32x4.extract_lane(acc, 1));
    const h2 = reinterpret<i32>(f32x4.extract_lane(acc, 2));
    const h3 = reinterpret<i32>(f32x4.extract_lane(acc, 3));

    return ((h0 ^ h1) as i64) << 32 | (((h2 ^ h3) as i64) & 0xFFFF_FFFF);
}

@inline
function spin(cb: () => void): void {
    while (true) cb();
}

export function spin_fill0(): void {
    const dst: usize = 0;
    spin(() => memory.fill(dst, 0, 0));
}

function spin_copy0(): void {
    spin(() => memory.copy(4, 0, 0));
}

const SEG: u32 = <u32>memory.data<u8>([
    0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
    0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa,
]);

function spin_init0(): void {
    spin(() => memory.init(SEG, 0, 0, 0));
}

function spin_init256(): void {
    spin(() => memory.init(SEG, 0, 0, 256));
}
*/

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

import {
    Blockchain,
    BytesWriter,
    Calldata,
    encodeSelector,
    OP_NET,
} from '@btc-vision/btc-runtime/runtime';
import { sha256 } from '@btc-vision/btc-runtime/runtime/env/global';

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
}

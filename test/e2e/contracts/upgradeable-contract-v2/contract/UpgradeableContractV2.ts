import {
    Blockchain,
    BytesWriter,
    Calldata,
    OP_NET,
} from '@btc-vision/btc-runtime/runtime';

@final
export class UpgradeableContractV2 extends OP_NET {
    public constructor() {
        super();
    }

    @method()
    @returns('uint32')
    public getValue(_: Calldata): BytesWriter {
        const result = new BytesWriter(4);
        result.writeU32(2);
        return result;
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
}

import { Blockchain, BytesWriter, Calldata, OP_NET } from '@btc-vision/btc-runtime/runtime';
import { sha256, ripemd160 } from '@btc-vision/btc-runtime/runtime/env/global';

@final
export class TestContract extends OP_NET {
    public constructor() {
        super();
    }

    @method({
        name: 'value',
        type: ABIDataTypes.BYTES,
    })
    @returns({
        name: 'value',
        type: ABIDataTypes.BYTES32,
    })
    public sha256(calldata: Calldata): BytesWriter {
        const data = calldata.readBytesWithLength();

        const result = sha256(data)

        const writer = new BytesWriter(32);
        writer.writeBytes(result);
        return writer;
    }

    @method({
        name: 'value',
        type: ABIDataTypes.BYTES,
    })
    @returns({
        name: 'value',
        type: ABIDataTypes.BYTES,
    })
    public ripemd160(calldata: Calldata): BytesWriter {
        const data = calldata.readBytesWithLength();

        const result = ripemd160(data)

        const writer = new BytesWriter(20);
        writer.writeBytes(result);
        return writer;
    }

    @method(
        {
            name: 'key',
            type: ABIDataTypes.BYTES32,
        },
        {
            name: 'value',
            type: ABIDataTypes.BYTES32,
        },
    )
    @returns({
        name: 'value',
        type: ABIDataTypes.BYTES,
    })
    public store(calldata: Calldata): BytesWriter {
        const key = calldata.readBytes(32);
        const value = calldata.readBytes(32);

        Blockchain.setStorageAt(key, value)
        const result = new BytesWriter(32)
        result.writeBytes(value)
        Blockchain.log(`store[${key}] ${value}`)
        return result
    }

    @method({
        name: 'key',
        type: ABIDataTypes.BYTES32,
    })
    @returns({
        name: 'value',
        type: ABIDataTypes.BYTES,
    })
    public load(calldata: Calldata): BytesWriter {
        const key = calldata.readBytes(32);

        const value = Blockchain.getStorageAt(key)
        Blockchain.log(`load[${key}] ${value}`)
        const result = new BytesWriter(32)
        result.writeBytes(value)
        return result
    }

    @method(
        {
            name: 'key',
            type: ABIDataTypes.BYTES32,
        },
        {
            name: 'value',
            type: ABIDataTypes.BYTES32,
        }
    )
    @returns({
        name: 'value',
        type: ABIDataTypes.BYTES,
    })
    public tStore(calldata: Calldata): BytesWriter {
        const key = calldata.readBytes(32);
        const value = calldata.readBytes(32);

        Blockchain.setTransientAt(key, value)

        Blockchain.log(`tStore[${key}] ${value}`)
        const result = new BytesWriter(32)
        result.writeBytes(value)
        return result
    }

    @method({
        name: 'key',
        type: ABIDataTypes.BYTES32,
    })
    @returns({
        name: 'value',
        type: ABIDataTypes.BYTES,
    })
    public tLoad(calldata: Calldata): BytesWriter {
        const key = calldata.readBytes(32);

        const value = Blockchain.getTransientAt(key)
        Blockchain.log(`tLoad[${key}] ${value}`)
        const result = new BytesWriter(32)
        result.writeBytes(value)
        return result
    }

    @method({
        name: 'address',
        type: ABIDataTypes.ADDRESS,
    })
    @returns({
        name: 'value',
        type: ABIDataTypes.UINT32,
    })
    public accountType(calldata: Calldata): BytesWriter {
        const address = calldata.readAddress();
        const result = new BytesWriter(4);
        const accountType = Blockchain.getAccountType(address);
        result.writeU32(accountType)

        return result
    }

    @method({
        name: 'blockNumber',
        type: ABIDataTypes.UINT64,
    })
    @returns({
        name: 'value',
        type: ABIDataTypes.BYTES32,
    })
    public blockHash(calldata: Calldata): BytesWriter {
        const blockNumber = calldata.readU64()
        const result = new BytesWriter(32);
        Blockchain.log(`Block number: ${blockNumber}`);
        const blockHash = Blockchain.getBlockHash(blockNumber);
        Blockchain.log(`Block blockHash`);
        result.writeBytes(blockHash)

        Blockchain.log(`${calldata} ${blockHash}`);
        return result
    }
}

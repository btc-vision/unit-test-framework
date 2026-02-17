import {
    Blockchain,
    BytesWriter,
    Calldata,
    OP_NET,
} from '@btc-vision/btc-runtime/runtime';
import { sha256 } from '@btc-vision/btc-runtime/runtime/env/global';

@final
export class ECDSAContract extends OP_NET {
    public constructor() {
        super();
    }

    @method('bytes', 'bytes', 'bytes')
    @returns({
        type: ABIDataTypes.BOOL,
        name: 'valid',
    })
    public verifyECDSAEthereum(calldata: Calldata): BytesWriter {
        const publicKey = calldata.readBytesWithLength();
        const signature = calldata.readBytesWithLength();
        const hash = calldata.readBytesWithLength();

        const isValid = Blockchain.verifyECDSASignature(publicKey, signature, hash);

        const writer = new BytesWriter(1);
        writer.writeBoolean(isValid);
        return writer;
    }

    @method('bytes', 'bytes', 'bytes')
    @returns({
        type: ABIDataTypes.BOOL,
        name: 'valid',
    })
    public verifyECDSABitcoin(calldata: Calldata): BytesWriter {
        const publicKey = calldata.readBytesWithLength();
        const signature = calldata.readBytesWithLength();
        const hash = calldata.readBytesWithLength();

        const isValid = Blockchain.verifyBitcoinECDSASignature(publicKey, signature, hash);

        const writer = new BytesWriter(1);
        writer.writeBoolean(isValid);
        return writer;
    }

    @method('bytes')
    @returns('bytes32')
    public hashMessage(calldata: Calldata): BytesWriter {
        const data = calldata.readBytesWithLength();
        const result = sha256(data);

        const writer = new BytesWriter(32);
        writer.writeBytes(result);
        return writer;
    }
}

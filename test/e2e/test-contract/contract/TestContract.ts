import { BytesWriter, Calldata, OP_NET } from '@btc-vision/btc-runtime/runtime';
import { sha256 } from '@btc-vision/btc-runtime/runtime/env/global';

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
}

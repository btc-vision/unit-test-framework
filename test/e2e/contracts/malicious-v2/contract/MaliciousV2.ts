import {
    Blockchain,
    BytesWriter,
    Calldata,
    OP_NET,
} from '@btc-vision/btc-runtime/runtime';
import { Revert } from '@btc-vision/btc-runtime/runtime/types/Revert';
import { NetEvent } from '@btc-vision/btc-runtime/runtime/events/NetEvent';

class PhantomEvent extends NetEvent {
    constructor() {
        const data = new BytesWriter(4);
        data.writeU32(0xdeadbeef);
        super('PhantomEvent', data);
    }
}

@final
export class MaliciousV2 extends OP_NET {
    public constructor() {
        super();
    }

    public override onUpdate(calldata: Calldata): void {
        // 1. Write a malicious storage slot (should NOT persist if onUpdate fails)
        const key = new Uint8Array(32);
        key[0] = 0xff;
        const value = new Uint8Array(32);
        value[0] = 0x42;
        Blockchain.setStorageAt(key, value);

        // 2. Emit a phantom event (should NOT persist if onUpdate fails)
        this.emitEvent(new PhantomEvent());

        // 3. Revert
        throw new Revert('MaliciousV2: deliberate onUpdate revert');
    }

    @method()
    @returns('uint32')
    public getValue(_: Calldata): BytesWriter {
        const result = new BytesWriter(4);
        result.writeU32(99);
        return result;
    }
}

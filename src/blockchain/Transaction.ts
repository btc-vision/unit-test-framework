import { BinaryWriter } from '@btc-vision/transaction';

export class TransactionInput {
    public constructor(
        public readonly txHash: Uint8Array,
        public readonly outputIndex: number,
        public readonly scriptSig: Uint8Array,
    ) {}
}

export class TransactionOutput {
    public constructor(
        public readonly index: number,
        public readonly to: string,
        public readonly value: bigint,
    ) {}
}

export function generateTransactionId(): Uint8Array {
    const id = new Uint8Array(32);
    crypto.getRandomValues(id);

    return id;
}

export class Transaction {
    public constructor(
        public readonly id: Uint8Array,
        public readonly inputs: TransactionInput[],
        public readonly outputs: TransactionOutput[],
    ) {
        // Simulate opnet behavior
        const opnetInput = new TransactionInput(generateTransactionId(), 0, new Uint8Array(0));
        this.inputs = [opnetInput, ...inputs];

        const opnetOutput = new TransactionOutput(0, 'OPNET', 0n);
        this.outputs = [opnetOutput, ...outputs];
    }

    public addOutput(value: bigint, receiver: string): void {
        this.outputs.push(new TransactionOutput(this.outputs.length, receiver, value));
    }

    public addInput(txHash: Uint8Array, outputIndex: number, scriptSig: Uint8Array): void {
        this.inputs.push(new TransactionInput(txHash, outputIndex, scriptSig));
    }

    public serializeInputs(): Uint8Array {
        const writer = new BinaryWriter();
        writer.writeU16(this.inputs.length);

        for (const input of this.inputs) {
            writer.writeBytes(input.txHash);
            writer.writeU16(input.outputIndex);
            writer.writeBytesWithLength(input.scriptSig);
        }

        return writer.getBuffer();
    }

    public serializeOutputs(): Uint8Array {
        const writer = new BinaryWriter();
        writer.writeU16(this.outputs.length);

        for (const output of this.outputs) {
            writer.writeU16(output.index);
            writer.writeStringWithLength(output.to);
            writer.writeU64(output.value);
        }

        return writer.getBuffer();
    }
}

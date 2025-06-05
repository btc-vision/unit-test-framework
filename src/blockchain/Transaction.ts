import { BinaryWriter } from '@btc-vision/transaction';
import { TransactionInputFlags, TransactionOutputFlags } from 'opnet';

export interface ITransactionInput {
    readonly txHash: Uint8Array;
    readonly outputIndex: number;
    readonly scriptSig: Uint8Array;
    readonly flags: number;
    readonly coinbase?: Buffer;
}

export interface ITransactionOutput {
    readonly index: number;
    readonly to?: string;
    readonly value: bigint;
    readonly scriptPubKey?: Uint8Array | undefined;
    readonly flags: number;
}

export class TransactionInput {
    public readonly txHash: Uint8Array;
    public readonly outputIndex: number;
    public readonly scriptSig: Uint8Array;
    public readonly flags: number;
    public readonly coinbase?: Buffer;

    public constructor(params: ITransactionInput) {
        this.txHash = params.txHash;
        this.outputIndex = params.outputIndex;
        this.scriptSig = params.scriptSig;
        this.flags = params.flags;
        this.coinbase = params.coinbase;
    }
}

export class TransactionOutput {
    public readonly index: number;
    public readonly to?: string;
    public readonly value: bigint;
    public readonly scriptPubKey: Uint8Array | undefined;
    public readonly flags: number;

    public constructor(params: ITransactionOutput) {
        if (!params.to && !params.scriptPubKey) {
            throw new Error('Either "to" or "scriptPubKey" must be provided.');
        }

        this.index = params.index;
        this.to = params.to;
        this.value = params.value;
        this.scriptPubKey = params.scriptPubKey;
        this.flags = params.flags;
    }
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
        const opnetInput = new TransactionInput({
            txHash: generateTransactionId(),
            outputIndex: 0,
            scriptSig: new Uint8Array(0),
            flags: 0,
        });

        this.inputs = [opnetInput, ...inputs];

        const opnetOutput = new TransactionOutput({
            index: 0,
            to: 'OP_NET',
            value: 0n,
            flags: TransactionOutputFlags.hasTo,
        });

        this.outputs = [opnetOutput, ...outputs];
    }

    public addOutput(value: bigint, receiver: string | undefined, scriptPubKey?: Uint8Array): void {
        this.outputs.push(
            new TransactionOutput({
                index: this.outputs.length,
                to: receiver,
                value,
                scriptPubKey: scriptPubKey,
                flags: scriptPubKey
                    ? TransactionOutputFlags.hasScriptPubKey
                    : TransactionOutputFlags.hasTo,
            }),
        );
    }

    public addInputWithFlags(input: TransactionInput): void {
        this.inputs.push(input);
    }

    public addOutputWithFlags(output: TransactionOutput): void {
        this.outputs.push(output);
    }

    public addInput(txHash: Uint8Array, outputIndex: number, scriptSig: Uint8Array): void {
        this.inputs.push(
            new TransactionInput({
                txHash,
                outputIndex,
                scriptSig,
                flags: 0,
            }),
        );
    }

    public serializeInputs(): Uint8Array {
        const writer = new BinaryWriter();
        writer.writeU16(this.inputs.length);

        for (let i = 0; i < this.inputs.length; i++) {
            const input = this.inputs[i];

            writer.writeU8(input.flags);

            writer.writeBytes(input.txHash);
            writer.writeU16(input.outputIndex);
            writer.writeBytesWithLength(input.scriptSig);

            if (input.flags & TransactionInputFlags.hasCoinbase) {
                if (!input.coinbase) {
                    throw new Error('OP_NET: Impossible case, input.coinbase is undefined.');
                }

                writer.writeBytesWithLength(input.coinbase);
            }
        }

        return writer.getBuffer();
    }

    public serializeOutputs(): Uint8Array {
        const writer = new BinaryWriter();
        writer.writeU16(this.outputs.length);

        for (let i = 0; i < this.outputs.length; i++) {
            const output = this.outputs[i];
            writer.writeU8(output.flags);
            writer.writeU16(output.index);

            if (output.flags & TransactionOutputFlags.hasScriptPubKey) {
                if (!output.scriptPubKey) {
                    throw new Error('OP_NET: Impossible case, output.scriptPubKey is undefined.');
                }

                writer.writeBytesWithLength(output.scriptPubKey);
            }

            if (output.flags & TransactionOutputFlags.hasTo) {
                if (!output.to) {
                    throw new Error('OP_NET: Impossible case, output.to is undefined.');
                }

                writer.writeStringWithLength(output.to);
            }

            writer.writeU64(output.value);
        }

        return writer.getBuffer();
    }
}

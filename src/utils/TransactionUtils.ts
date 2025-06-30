import {
    generateTransactionId,
    Transaction,
    TransactionInput,
    TransactionOutput,
} from '../blockchain/Transaction.js';

export function generateEmptyTransaction(addDefault: boolean = true): Transaction {
    const txId = generateTransactionId();

    const inputs: TransactionInput[] = [];
    const outputs: TransactionOutput[] = [];

    return new Transaction(txId, inputs, outputs, addDefault);
}

export function gas2Sat(gas: bigint): bigint {
    return gas / 1_000_000n;
}

export function sat2BTC(satoshis: bigint): number {
    return Number(satoshis) / 100_000_000;
}

export function gas2BTC(gas: bigint): number {
    return sat2BTC(gas2Sat(gas));
}

export function gas2USD(gas: bigint, btcPrice: number = 78_000): number {
    return gas2BTC(gas) * btcPrice;
}

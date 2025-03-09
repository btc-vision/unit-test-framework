import { AddressSet, NetEvent } from '@btc-vision/transaction';

export interface CallResponse {
    status: number
    response: Uint8Array;
    error?: Error;
    events: NetEvent[];
    callStack: AddressSet;

    usedGas: bigint;
}

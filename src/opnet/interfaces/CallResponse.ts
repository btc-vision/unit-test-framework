import { AddressSet, NetEvent } from '@btc-vision/transaction';
import { AddressStack } from '../modules/AddressStack';

export interface CallResponse {
    status: number;
    response: Uint8Array;
    error?: Error;
    events: NetEvent[];
    callStack: AddressStack;
    touchedAddresses: AddressSet;
    touchedBlocks: Set<bigint>;

    usedGas: bigint;
}

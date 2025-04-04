import { Address, AddressSet, NetEvent } from '@btc-vision/transaction';

export interface CallResponse {
    status: number;
    response: Uint8Array;
    error?: Error;
    events: NetEvent[];
    callStack: Address[];
    touchedAddresses: AddressSet;
    touchedBlocks: Set<bigint>

    usedGas: bigint;
}

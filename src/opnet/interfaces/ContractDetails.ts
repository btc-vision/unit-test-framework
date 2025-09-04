import { Address, AddressSet, NetEvent } from '@btc-vision/transaction';
import { AddressStack } from '../modules/AddressStack.js';

export interface StateOverride {
    events: NetEvent[];
    callStack: AddressStack;
    touchedAddresses: AddressSet;
    touchedBlocks: Set<bigint>;
    totalEventLength: number;

    loadedPointers: bigint;
    storedPointers: bigint;
    memoryPagesUsed: bigint;
}

export interface ContractDetails {
    readonly address: Address;
    readonly deployer: Address;

    readonly gasLimit?: bigint;
    readonly gasUsed?: bigint;
    readonly memoryPagesUsed?: bigint;

    readonly deploymentCalldata?: Buffer;
    readonly bytecode?: Buffer;
}

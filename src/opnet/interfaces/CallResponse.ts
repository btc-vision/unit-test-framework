import { AddressSet, NetEvent } from '@btc-vision/transaction';
import { AddressStack } from '../modules/AddressStack';
import { ExitDataResponse } from '@btc-vision/op-vm';
import { RustContract } from '../vm/RustContract.js';

export interface ICallResponse {
    exitData: ExitDataResponse;
    events: NetEvent[];
    callStack: AddressStack;
    touchedAddresses: AddressSet;
    touchedBlocks: Set<bigint>;
}

export class CallResponse {
    public status: number;
    public response: Uint8Array;
    public error?: Error;
    public events: NetEvent[];
    public callStack: AddressStack;
    public touchedAddresses: AddressSet;
    public touchedBlocks: Set<bigint>;

    public usedGas: bigint;

    constructor(data: ICallResponse) {
        this.status = data.exitData.status;
        this.response = new Uint8Array(data.exitData.data);
        this.events = data.events;
        this.callStack = data.callStack;
        this.touchedAddresses = data.touchedAddresses;
        this.touchedBlocks = data.touchedBlocks;

        this.usedGas = data.exitData.gasUsed;

        if (this.status === 1) {
            this.error = RustContract.decodeRevertData(this.response);
        }
    }
}

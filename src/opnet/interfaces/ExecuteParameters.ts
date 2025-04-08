import { Address } from '@btc-vision/transaction';

export interface ExecutionParameters {
    readonly calldata: Buffer | Uint8Array;
    readonly sender?: Address;
    readonly txOrigin?: Address;
    readonly gasUsed?: bigint;
    readonly memoryPagesUsed?: bigint;
    readonly saveStates?: boolean;
}

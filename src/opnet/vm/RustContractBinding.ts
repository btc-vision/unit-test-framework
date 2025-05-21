import { AccountTypeResponse, BlockHashResponse } from '@btc-vision/op-vm';

export interface RustContractBinding {
    readonly id: bigint;
    readonly load: (data: Buffer) => Promise<Buffer>;
    readonly store: (data: Buffer) => Promise<Buffer>;
    readonly tLoad: (data: Buffer) => Promise<Buffer>;
    readonly tStore: (data: Buffer) => Promise<Buffer>;
    readonly call: (data: Buffer) => Promise<Buffer>;
    readonly deployContractAtAddress: (data: Buffer) => Promise<Buffer>;
    readonly log: (data: Buffer) => void;
    readonly emit: (data: Buffer) => void;
    readonly inputs: () => Promise<Buffer>;
    readonly outputs: () => Promise<Buffer>;
    readonly accountType: (data: Buffer) => Promise<AccountTypeResponse>;
    readonly blockHash: (blockNumber: bigint) => Promise<BlockHashResponse>;
}

import { ContractRuntime } from '../opnet/modules/ContractRuntime.js';
import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { BytecodeManager } from '../opnet/modules/GetBytecode.js';
import { CallResponse } from '../opnet/interfaces/CallResponse.js';
import { ContractDetails } from '../opnet/interfaces/ContractDetails.js';

export interface TransferredEventNFT {
    readonly operator: Address;
    readonly from: Address;
    readonly to: Address;
    readonly tokenId: bigint;
}

export interface ApprovedEventNFT {
    readonly owner: Address;
    readonly approved: Address;
    readonly tokenId: bigint;
}

export interface ApprovedForAllEvent {
    readonly owner: Address;
    readonly operator: Address;
    readonly approved: boolean;
}

export interface URIEvent {
    readonly uri: string;
    readonly tokenId: bigint;
}

export interface OP721Interface extends ContractDetails {
    readonly file: string;
}

export class OP721 extends ContractRuntime {
    public readonly file: string;

    // Selector definitions
    protected readonly nameSelector: number = Number(`0x${this.abiCoder.encodeSelector('name()')}`);

    protected readonly symbolSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('symbol()')}`,
    );

    protected readonly totalSupplySelector: number = Number(
        `0x${this.abiCoder.encodeSelector('totalSupply()')}`,
    );

    protected readonly maxSupplySelector: number = Number(
        `0x${this.abiCoder.encodeSelector('maxSupply()')}`,
    );

    protected readonly balanceOfSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('balanceOf(address)')}`,
    );

    protected readonly ownerOfSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('ownerOf(uint256)')}`,
    );

    protected readonly tokenURISelector: number = Number(
        `0x${this.abiCoder.encodeSelector('tokenURI(uint256)')}`,
    );

    protected readonly getApprovedSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('getApproved(uint256)')}`,
    );

    protected readonly isApprovedForAllSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('isApprovedForAll(address,address)')}`,
    );

    protected readonly transferFromSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('transferFrom(address,address,uint256)')}`,
    );

    protected readonly safeTransferFromSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('safeTransferFrom(address,address,uint256,bytes)')}`,
    );

    protected readonly approveSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('approve(address,uint256)')}`,
    );

    protected readonly setApprovalForAllSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('setApprovalForAll(address,bool)')}`,
    );

    protected readonly burnSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('burn(uint256)')}`,
    );

    protected readonly setBaseURISelector: number = Number(
        `0x${this.abiCoder.encodeSelector('setBaseURI(string)')}`,
    );

    protected readonly tokenOfOwnerByIndexSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('tokenOfOwnerByIndex(address,uint256)')}`,
    );

    protected readonly transferBySignatureSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('transferBySignature(address,address,uint256,uint64,bytes)')}`,
    );

    protected readonly approveBySignatureSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('approveBySignature(address,address,uint256,uint64,bytes)')}`,
    );

    protected readonly getTransferNonceSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('getTransferNonce(address)')}`,
    );

    protected readonly getApproveNonceSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('getApproveNonce(address)')}`,
    );

    protected readonly domainSeparatorSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('domainSeparator()')}`,
    );

    constructor(details: OP721Interface) {
        super(details);
        this.file = details.file;
    }

    public static decodeTransferredEvent(data: Buffer | Uint8Array): TransferredEventNFT {
        const reader = new BinaryReader(data);
        const operator = reader.readAddress();
        const from = reader.readAddress();
        const to = reader.readAddress();
        const tokenId = reader.readU256();

        return { operator, from, to, tokenId };
    }

    public static decodeApprovedEvent(data: Buffer | Uint8Array): ApprovedEventNFT {
        const reader = new BinaryReader(data);
        const owner = reader.readAddress();
        const approved = reader.readAddress();
        const tokenId = reader.readU256();

        return { owner, approved, tokenId };
    }

    public static decodeApprovedForAllEvent(data: Buffer | Uint8Array): ApprovedForAllEvent {
        const reader = new BinaryReader(data);
        const owner = reader.readAddress();
        const operator = reader.readAddress();
        const approved = reader.readBoolean();

        return { owner, operator, approved };
    }

    public static decodeURIEvent(data: Buffer | Uint8Array): URIEvent {
        const reader = new BinaryReader(data);
        const uri = reader.readStringWithLength();
        const tokenId = reader.readU256();

        return { uri, tokenId };
    }

    public async name(): Promise<string> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.nameSelector);

        const result = await this.execute({
            calldata: writer.getBuffer(),
            saveStates: false,
        });

        if (!result.response) {
            this.dispose();
            throw result.error;
        }

        const reader = new BinaryReader(result.response);
        return reader.readStringWithLength();
    }

    public async symbol(): Promise<string> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.symbolSelector);

        const result = await this.execute({
            calldata: writer.getBuffer(),
            saveStates: false,
        });

        if (!result.response) {
            this.dispose();
            throw result.error;
        }

        const reader = new BinaryReader(result.response);
        return reader.readStringWithLength();
    }

    public async totalSupply(): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.totalSupplySelector);

        const result = await this.execute({
            calldata: writer.getBuffer(),
            saveStates: false,
        });

        if (!result.response) {
            this.dispose();
            throw result.error;
        }

        const reader = new BinaryReader(result.response);
        return reader.readU256();
    }

    public async maxSupply(): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.maxSupplySelector);

        const result = await this.execute({
            calldata: writer.getBuffer(),
            saveStates: false,
        });

        if (!result.response) {
            this.dispose();
            throw result.error;
        }

        const reader = new BinaryReader(result.response);
        return reader.readU256();
    }

    public async balanceOf(owner: Address): Promise<bigint> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.balanceOfSelector);
        calldata.writeAddress(owner);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            saveStates: false,
        });

        const reader = new BinaryReader(result.response);
        return reader.readU256();
    }

    public async ownerOf(tokenId: bigint): Promise<Address> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.ownerOfSelector);
        calldata.writeU256(tokenId);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            saveStates: false,
        });

        const reader = new BinaryReader(result.response);
        return reader.readAddress();
    }

    public async tokenURI(tokenId: bigint): Promise<string> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.tokenURISelector);
        calldata.writeU256(tokenId);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            saveStates: false,
        });

        const reader = new BinaryReader(result.response);
        return reader.readStringWithLength();
    }

    public async getApproved(tokenId: bigint): Promise<Address> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.getApprovedSelector);
        calldata.writeU256(tokenId);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            saveStates: false,
        });

        const reader = new BinaryReader(result.response);
        return reader.readAddress();
    }

    public async isApprovedForAll(owner: Address, operator: Address): Promise<boolean> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.isApprovedForAllSelector);
        calldata.writeAddress(owner);
        calldata.writeAddress(operator);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            saveStates: false,
        });

        const reader = new BinaryReader(result.response);
        return reader.readBoolean();
    }

    public async transferFrom(
        from: Address,
        to: Address,
        tokenId: bigint,
        sender?: Address,
    ): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.transferFromSelector);
        calldata.writeAddress(from);
        calldata.writeAddress(to);
        calldata.writeU256(tokenId);

        return await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            sender: sender || from,
            txOrigin: sender || from,
        });
    }

    public async safeTransferFrom(
        from: Address,
        to: Address,
        tokenId: bigint,
        data: Uint8Array = new Uint8Array(),
        sender?: Address,
    ): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.safeTransferFromSelector);
        calldata.writeAddress(from);
        calldata.writeAddress(to);
        calldata.writeU256(tokenId);
        calldata.writeBytesWithLength(data);

        return await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            sender: sender || from,
            txOrigin: sender || from,
        });
    }

    public async approve(
        spender: Address,
        tokenId: bigint,
        sender: Address,
    ): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.approveSelector);
        calldata.writeAddress(spender);
        calldata.writeU256(tokenId);

        return await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            sender: sender,
            txOrigin: sender,
        });
    }

    public async setApprovalForAll(
        operator: Address,
        approved: boolean,
        sender: Address,
    ): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.setApprovalForAllSelector);
        calldata.writeAddress(operator);
        calldata.writeBoolean(approved);

        return await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            sender: sender,
            txOrigin: sender,
        });
    }

    public async burn(tokenId: bigint, sender: Address): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.burnSelector);
        calldata.writeU256(tokenId);

        return await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            sender: sender,
            txOrigin: sender,
        });
    }

    public async setBaseURI(baseURI: string): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.setBaseURISelector);
        calldata.writeStringWithLength(baseURI);

        return await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
        });
    }

    public async tokenOfOwnerByIndex(owner: Address, index: bigint): Promise<bigint> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.tokenOfOwnerByIndexSelector);
        calldata.writeAddress(owner);
        calldata.writeU256(index);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            saveStates: false,
        });

        const reader = new BinaryReader(result.response);
        return reader.readU256();
    }

    public async transferBySignature(
        owner: Address,
        to: Address,
        tokenId: bigint,
        deadline: bigint,
        signature: Uint8Array,
    ): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.transferBySignatureSelector);
        calldata.writeAddress(owner);
        calldata.writeAddress(to);
        calldata.writeU256(tokenId);
        calldata.writeU64(deadline);
        calldata.writeBytesWithLength(signature);

        return await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
        });
    }

    public async approveBySignature(
        owner: Address,
        spender: Address,
        tokenId: bigint,
        deadline: bigint,
        signature: Uint8Array,
    ): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.approveBySignatureSelector);
        calldata.writeAddress(owner);
        calldata.writeAddress(spender);
        calldata.writeU256(tokenId);
        calldata.writeU64(deadline);
        calldata.writeBytesWithLength(signature);

        return await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
        });
    }

    public async getTransferNonce(owner: Address): Promise<bigint> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.getTransferNonceSelector);
        calldata.writeAddress(owner);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            saveStates: false,
        });

        const reader = new BinaryReader(result.response);
        return reader.readU256();
    }

    public async getApproveNonce(owner: Address): Promise<bigint> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.getApproveNonceSelector);
        calldata.writeAddress(owner);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            saveStates: false,
        });

        const reader = new BinaryReader(result.response);
        return reader.readU256();
    }

    public async domainSeparator(): Promise<Uint8Array> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.domainSeparatorSelector);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            saveStates: false,
        });

        const reader = new BinaryReader(result.response);
        return reader.readBytes(32);
    }

    public async getAllTokensOfOwner(owner: Address): Promise<bigint[]> {
        const balance = await this.balanceOf(owner);
        const tokens: bigint[] = [];

        for (let i = 0n; i < balance; i++) {
            const tokenId = await this.tokenOfOwnerByIndex(owner, i);
            tokens.push(tokenId);
        }

        return tokens;
    }

    protected defineRequiredBytecodes(): void {
        const path: string = this.file.includes('/') ? this.file : `./bytecode/${this.file}.wasm`;
        BytecodeManager.loadBytecode(path, this.address);
    }

    protected handleError(error: Error): Error {
        return new Error(`(in OP_721: ${this.address}) OP_NET: ${error.stack}`);
    }
}

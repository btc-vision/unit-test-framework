import { ContractRuntime } from '../opnet/modules/ContractRuntime.js';
import { Address, AddressMap, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { BytecodeManager } from '../opnet/modules/GetBytecode.js';
import { Blockchain } from '../blockchain/Blockchain.js';
import { CallResponse } from '../opnet/interfaces/CallResponse.js';
import { ContractDetails } from '../opnet/interfaces/ContractDetails.js';

export interface TransferEvent {
    readonly from: Address;
    readonly to: Address;
    readonly value: bigint;
}

export interface MintEvent {
    readonly to: Address;
    readonly value: bigint;
}

export interface BurnEvent {
    readonly value: bigint;
}

export interface OP_20Interface extends ContractDetails {
    readonly file: string;
    readonly decimals: number;
}

export class OP_20 extends ContractRuntime {
    public readonly file: string;
    public readonly decimals: number;

    protected readonly transferSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('transfer(address,uint256)')}`,
    );

    protected readonly transferFromSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('transferFrom(address,address,uint256)')}`,
    );

    protected readonly mintSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('mint(address,uint256)')}`,
    );
    protected readonly balanceOfSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('balanceOf(address)')}`,
    );

    protected readonly totalSupplySelector: number = Number(
        `0x${this.abiCoder.encodeSelector('totalSupply()')}`,
    );

    protected readonly approveSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('approve(address,uint256)')}`,
    );

    protected readonly airdropSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('airdrop(tuple(address,uint256))')}`,
    );

    protected readonly allowanceSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('allowance(address,address)')}`,
    );

    constructor(details: OP_20Interface) {
        super(details);

        this.file = details.file;
        this.decimals = details.decimals;
    }

    public static decodeBurnEvent(data: Buffer | Uint8Array): BurnEvent {
        const reader = new BinaryReader(data);
        const value = reader.readU256();

        return { value };
    }

    public static decodeTransferEvent(data: Buffer | Uint8Array): TransferEvent {
        const reader = new BinaryReader(data);
        const from = reader.readAddress();
        const to = reader.readAddress();
        const value = reader.readU256();

        return { from, to, value };
    }

    public static decodeMintEvent(data: Buffer | Uint8Array): MintEvent {
        const reader = new BinaryReader(data);
        const to = reader.readAddress();
        const value = reader.readU256();

        return { to, value };
    }

    public async totalSupply(): Promise<bigint> {
        const writer = new BinaryWriter();
        writer.writeSelector(this.totalSupplySelector);

        const result = await this.execute({
            calldata: writer.getBuffer(),
            saveStates: false,
        });

        const response = result.response;
        if (!response) {
            this.dispose();
            throw result.error;
        }

        const reader: BinaryReader = new BinaryReader(response);
        return reader.readU256();
    }

    public async mint(to: Address, amount: number): Promise<void> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.mintSelector);
        calldata.writeAddress(to);
        calldata.writeU256(Blockchain.expandToDecimal(amount, this.decimals));
        calldata.writeAddressValueTuple(new AddressMap());
        calldata.writeU256(0n);

        const buf = calldata.getBuffer();
        const result = await this.executeThrowOnError({
            calldata: buf,
            sender: this.deployer,
            txOrigin: this.deployer,
        });

        const reader = new BinaryReader(result.response);
        if (!reader.readBoolean()) {
            throw new Error('Mint failed');
        }
    }

    public async transferFrom(from: Address, to: Address, amount: bigint): Promise<void> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.transferFromSelector);
        calldata.writeAddress(from);
        calldata.writeAddress(to);
        calldata.writeU256(amount);

        const buf = calldata.getBuffer();
        const result = await this.executeThrowOnError({
            calldata: buf,
            sender: from,
            txOrigin: from,
        });

        const reader = new BinaryReader(result.response);
        if (!reader.readBoolean()) {
            throw new Error('Transfer failed');
        }
    }

    public async allowance(owner: Address, spender: Address): Promise<bigint> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.allowanceSelector);
        calldata.writeAddress(owner);
        calldata.writeAddress(spender);

        const buf = calldata.getBuffer();
        const result = await this.executeThrowOnError({
            calldata: buf,
            saveStates: false,
        });

        const reader = new BinaryReader(result.response);
        return reader.readU256();
    }

    public async airdrop(map: AddressMap<bigint>): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.airdropSelector);
        calldata.writeAddressValueTuple(map);

        const buf = calldata.getBuffer();
        return await this.executeThrowOnError({
            calldata: buf,
            sender: this.deployer,
            txOrigin: this.deployer,
        });
    }

    public async mintRaw(to: Address, amount: bigint): Promise<void> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.mintSelector);
        calldata.writeAddress(to);
        calldata.writeU256(amount);

        const buf = calldata.getBuffer();
        const result = await this.executeThrowOnError({
            calldata: buf,
            sender: this.deployer,
            txOrigin: this.deployer,
        });

        const response = result.response;
        if (!response) {
            this.dispose();
            throw result.error;
        }

        const reader = new BinaryReader(response);
        if (!reader.readBoolean()) {
            throw new Error('Mint failed');
        }
    }

    public async approve(owner: Address, spender: Address, amount: bigint): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.approveSelector);
        calldata.writeAddress(spender);
        calldata.writeU256(amount);

        const buf = calldata.getBuffer();
        const result = await this.executeThrowOnError({
            calldata: buf,
            sender: owner,
            txOrigin: owner,
        });

        const reader = new BinaryReader(result.response);
        if (!reader.readBoolean()) {
            throw new Error('Mint failed');
        }

        return result;
    }

    public async transfer(from: Address, to: Address, amount: bigint): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.transferSelector);
        calldata.writeAddress(to);
        calldata.writeU256(amount);

        const buf = calldata.getBuffer();
        const result = await this.executeThrowOnError({
            calldata: buf,
            sender: from,
            txOrigin: from,
        });

        const reader = new BinaryReader(result.response);
        if (!reader.readBoolean()) {
            throw new Error('Transfer failed');
        }

        return result;
    }

    public async balanceOf(owner: Address): Promise<bigint> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.balanceOfSelector);
        calldata.writeAddress(owner);

        const buf = calldata.getBuffer();
        const result = await this.executeThrowOnError({
            calldata: buf,
            saveStates: false,
        });

        const response = result.response;
        const reader = new BinaryReader(response);
        return reader.readU256();
    }

    public async balanceOfNoDecimals(owner: Address): Promise<number> {
        const balance = await this.balanceOf(owner);

        return Blockchain.decodeFromDecimal(balance, this.decimals);
    }

    protected defineRequiredBytecodes(): void {
        const path: string = this.file.includes('/') ? this.file : `./bytecode/${this.file}.wasm`;

        BytecodeManager.loadBytecode(path, this.address);
    }

    protected handleError(error: Error): Error {
        return new Error(`(in op_20: ${this.address}) OP_NET: ${error.stack}`);
    }
}

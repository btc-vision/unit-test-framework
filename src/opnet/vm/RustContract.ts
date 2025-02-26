import { BitcoinNetworkRequest, CallResponse, ContractManager } from '@btc-vision/op-vm';
import { RustContractBinding } from './RustContractBinding.js';
import { Blockchain } from '../../blockchain/Blockchain.js';

export interface ContractParameters extends Omit<RustContractBinding, 'id'> {
    readonly address: string;

    readonly bytecode: Buffer;
    readonly gasLimit: bigint;
    readonly network: BitcoinNetworkRequest;
    readonly isDebugMode: boolean;
    readonly gasCallback: (gas: bigint, method: string) => void;

    readonly contractManager: ContractManager;
}

export class RustContract {
    private refCounts: Map<number, number> = new Map<number, number>();

    private readonly enableDebug: boolean = false;
    private readonly enableDisposeLog: boolean = false;

    private gasUsed: bigint = 0n;

    private readonly contractManager: ContractManager;

    constructor(params: ContractParameters) {
        this._params = params;
        this.contractManager = params.contractManager;
    }

    private _id?: bigint;

    public get id() {
        if (this.disposed) {
            throw new Error('Contract is disposed.');
        }

        if (this._id == null) {
            this._id = this.contractManager.reserveId();

            Blockchain.registerBinding({
                id: this._id,
                load: this.params.load,
                store: this.params.store,
                call: this.params.call,
                deployContractAtAddress: this.params.deployContractAtAddress,
                log: this.params.log,
                emit: this.params.emit,
                inputs: this.params.inputs,
                outputs: this.params.outputs,
            });

            this.instantiate();
        }

        return this._id;
    }

    public instantiate(): void {
        if (this._id == null) throw new Error('Contract is not instantiated');
        if (this._instantiated) return;

        this.contractManager.instantiate(
            this._id,
            this.params.address,
            this.params.bytecode,
            this.params.gasLimit,
            this.params.network,
            this.params.isDebugMode,
        );

        this._instantiated = true;
    }

    private _instantiated: boolean = false;

    public get instantiated(): boolean {
        return this._instantiated;
    }

    private _disposed: boolean = false;

    public get disposed(): boolean {
        return this._disposed;
    }

    private _params?: ContractParameters | null;

    private get params(): ContractParameters {
        if (!this._params) {
            throw new Error('Contract is disposed - cannot access parameters.');
        }

        return this._params;
    }

    public dispose(): void {
        if (!this.instantiated) return;

        if (this._id == null) {
            throw new Error('Contract is not instantiated');
        }

        if (this.enableDebug || this.enableDisposeLog) console.log('Disposing contract', this._id);

        let deadlock: unknown;
        try {
            this.gasUsed = this.getUsedGas();
        } catch (e) {
            deadlock = e;
        }

        delete this._params;

        if (this.disposed) return;
        this._disposed = true;

        Blockchain.removeBinding(this._id);
        this.contractManager.destroyContract(this._id);

        if (deadlock) {
            const strErr = (deadlock as Error).message;

            if (strErr.includes('mutex')) {
                throw new Error('OPNET: REENTRANCY DETECTED');
            }
        }
    }

    public async execute(buffer: Uint8Array | Buffer): Promise<Uint8Array> {
        if (this.enableDebug) console.log('execute', buffer);

        try {
            const pointer = await this.__lowerTypedArray(13, 0, buffer);

            const resp = await this.contractManager.call(this.id, 'execute', [pointer]);
            const gasUsed = this.contractManager.getUsedGas(this.id);
            this.gasCallback(gasUsed, 'execute');

            const result = resp.filter((n) => n !== undefined);
            return this.__liftTypedArray(result[0] >>> 0);
        } catch (e) {
            if (this.enableDebug) console.log('Error in execute', e);

            const error = e as Error;
            throw this.getError(error);
        }
    }

    public async setEnvironment(buffer: Uint8Array | Buffer): Promise<void> {
        if (this.enableDebug) console.log('Setting environment', buffer);

        try {
            const data = await this.__lowerTypedArray(13, 0, buffer);
            if (data == null) throw new Error('Data cannot be null');

            await this.contractManager.call(this.id, 'setEnvironment', [data]);
            const gasUsed = this.contractManager.getUsedGas(this.id);

            this.gasCallback(gasUsed, 'setEnvironment');
        } catch (e) {
            if (this.enableDebug) console.log('Error in setEnvironment', e);

            const error = e as Error;
            throw this.getError(error);
        }
    }

    public async onDeploy(buffer: Uint8Array | Buffer): Promise<CallResponse> {
        if (this.enableDebug) console.log('Setting onDeployment', buffer);

        try {
            const data = await this.__lowerTypedArray(13, 0, buffer);
            if (data == null) throw new Error('Data cannot be null');

            const resp = await this.contractManager.call(this.id, 'onDeploy', [data]);
            const gasUsed = this.contractManager.getUsedGas(this.id);

            this.gasCallback(gasUsed, 'onDeploy');

            return {
                result: resp.filter((n) => n !== undefined),
                gasUsed: gasUsed,
            };
        } catch (e) {
            if (this.enableDebug) console.log('Error in onDeployment', e);

            const error = e as Error;
            throw this.getError(error);
        }
    }

    public setUsedGas(gas: bigint): void {
        try {
            this.contractManager.setUsedGas(this.id, gas);
        } catch (e) {
            const error = e as Error;
            throw this.getError(error);
        }
    }

    public getUsedGas(): bigint {
        try {
            if (this.disposed && this.gasUsed) {
                return this.gasUsed;
            }

            return this.contractManager.getUsedGas(this.id);
        } catch (e) {
            const error = e as Error;
            throw this.getError(error);
        }
    }

    public useGas(amount: bigint): void {
        try {
            return this.contractManager.useGas(this.id, amount);
        } catch (e) {
            const error = e as Error;
            throw this.getError(error);
        }
    }

    public getRemainingGas(): bigint {
        try {
            return this.contractManager.getRemainingGas(this.id);
        } catch (e) {
            const error = e as Error;
            throw this.getError(error);
        }
    }

    public setRemainingGas(gas: bigint): void {
        try {
            this.contractManager.setRemainingGas(this.id, gas);
        } catch (e) {
            const error = e as Error;
            throw this.getError(error);
        }
    }

    private __liftString(pointer: number): string | null {
        if (this.enableDebug) console.log('Lifting string', pointer);

        if (!pointer) return null;

        // Read the length of the string
        const lengthPointer = pointer - 4;
        const lengthBuffer = this.contractManager.readMemory(this.id, BigInt(lengthPointer), 4n);
        const length = new Uint32Array(lengthBuffer.buffer)[0];

        const end = (pointer + length) >>> 1;
        const stringParts: Array<string> = [];
        let start = pointer >>> 1;

        while (end - start > 1024) {
            const chunkBuffer = this.contractManager.readMemory(this.id, BigInt(start * 2), 2048n);
            const memoryU16 = new Uint16Array(chunkBuffer.buffer);
            stringParts.push(String.fromCharCode(...memoryU16));
            start += 1024;
        }

        const remainingBuffer = this.contractManager.readMemory(
            this.id,
            BigInt(start * 2),
            BigInt((end - start) * 2),
        );

        const remainingU16 = new Uint16Array(remainingBuffer.buffer);
        stringParts.push(String.fromCharCode(...remainingU16));

        return stringParts.join('');
    }

    private __liftTypedArray(pointer: number): Uint8Array {
        if (this.enableDebug) console.log('Lifting typed array', pointer);

        if (!pointer) throw new Error('Pointer cannot be null');

        // Read the data offset and length
        const buffer = this.contractManager.readMemory(this.id, BigInt(pointer + 4), 8n);

        const dataView = new DataView(buffer.buffer);
        const dataOffset = dataView.getUint32(0, true);
        const length = dataView.getUint32(4, true) / Uint8Array.BYTES_PER_ELEMENT;

        // Read the actual data
        const dataBuffer = this.contractManager.readMemory(
            this.id,
            BigInt(dataOffset),
            BigInt(length * Uint8Array.BYTES_PER_ELEMENT),
        );

        // Create the typed array and return its slice
        const typedArray = new Uint8Array(dataBuffer.buffer);
        return typedArray.slice();
    }

    private async __lowerTypedArray(
        id: number,
        align: number,
        values: Uint8Array | Buffer,
    ): Promise<number> {
        if (this.enableDebug) console.log('Lowering typed array', id, align, values);

        if (values == null) return 0;

        const length = values.length;
        const bufferSize = length << align;

        // Allocate memory for the array
        const newPointer = await this.__new(bufferSize, 1);
        const buffer = newPointer >>> 0;
        const header = (await this.__new(12, id)) >>> 0;

        // Set the buffer and length in the header
        const headerBuffer = Buffer.alloc(12);
        const headerView = new DataView(headerBuffer.buffer);
        headerView.setUint32(0, buffer, true);
        headerView.setUint32(4, buffer, true);
        headerView.setUint32(8, bufferSize, true);
        this.contractManager.writeMemory(this.id, BigInt(header), headerBuffer);

        // Write the values into the buffer
        const valuesBuffer = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
        this.contractManager.writeMemory(this.id, BigInt(buffer), valuesBuffer);

        return header;
    }

    private gasCallback(gas: bigint, method: string): void {
        this.params.gasCallback(gas, method);
    }

    private getError(err: Error): Error {
        if (this.enableDebug) console.log('Getting error', err);

        const msg = err.message;
        if (msg.includes('Execution reverted') && !msg.includes('Execution reverted:')) {
            return this.revert();
        } else {
            return err;
        }
    }

    private revert(): Error {
        const revertData = this.contractManager.getRevertData(this.id).data;

        try {
            this.dispose();
        } catch {}

        if (revertData.length === 0) {
            return new Error(`Execution reverted`);
        } else {
            const revertDataBytes = Uint8Array.from(revertData);
            if (this.startsWithErrorSelector(revertData, revertDataBytes)) {
                const decoder = new TextDecoder();
                const revertMessage = decoder.decode(revertDataBytes.slice(6));
                return new Error(`Execution reverted: ${revertMessage}`);
            } else {
                return new Error(`Execution reverted: 0x${this.bytesToHexString(revertDataBytes)}`);
            }
        }
    }

    private startsWithErrorSelector(
        revertData: Array<number>,
        revertDataBytes: Uint8Array<ArrayBuffer>,
    ) {
        const errorSelectorBytes = Uint8Array.from([0x63, 0x73, 0x9d, 0x5c]);
        return (
            revertData.length >= 4 &&
            this.areBytesEqual(revertDataBytes.slice(0, 4), errorSelectorBytes)
        );
    }

    private areBytesEqual(a: Uint8Array, b: Uint8Array) {
        if (a.length !== b.length) return false;

        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }

        return true;
    }

    private bytesToHexString(byteArray: Uint8Array): string {
        return Array.from(byteArray, function (byte) {
            return ('0' + (byte & 0xff).toString(16)).slice(-2);
        }).join('');
    }

    private async __new(size: number, align: number): Promise<number> {
        if (this.enableDebug) console.log('Creating new', size, align);

        let finalResult;
        try {
            const resp = await this.contractManager.call(this.id, '__new', [size, align]);
            const gasUsed = this.contractManager.getUsedGas(this.id);

            this.gasCallback(gasUsed, '__new');

            const result = resp.filter((n) => n !== undefined);
            finalResult = result[0];
        } catch (e) {
            if (this.enableDebug) console.log('Error in __new', e);

            const error = e as Error;
            throw this.getError(error);
        }

        return finalResult;
    }
}

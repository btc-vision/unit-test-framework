import { Address, AddressMap } from '@btc-vision/transaction';
import fs from 'fs';

class BytecodeManagerBase {
    private bytecodeMap: AddressMap<Buffer | Uint8Array> = new AddressMap();
    private fileNameMap: AddressMap<string> = new AddressMap();

    public loadBytecode(path: string, address: Address): void {
        const bytecode = fs.readFileSync(path);
        this.fileNameMap.set(address, path);

        this.setBytecode(address, bytecode);
    }

    public getFileName(address: Address): string {
        const fileName = this.fileNameMap.get(address);
        if (!fileName) {
            return 'unknown';
        }

        return fileName;
    }

    public getBytecode(address: Address): Buffer | Uint8Array {
        const bytecode = this.bytecodeMap.get(address);
        if (!bytecode) {
            throw new Error(`Bytecode for address ${address} not found`);
        }

        return bytecode;
    }

    public setBytecode(address: Address, bytecode: Buffer): void {
        if (this.bytecodeMap.has(address)) {
            return;
        }

        this.bytecodeMap.set(address, bytecode);
    }
}

export const BytecodeManager = new BytecodeManagerBase();

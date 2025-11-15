import { Address, AddressMap } from '@btc-vision/transaction';

export class MLDSAPublicKeyCache {
    private cache: AddressMap<Uint8Array> = new AddressMap<Uint8Array>();

    public get(address: Address): Uint8Array | undefined {
        return this.cache.get(address);
    }

    public set(address: Address, publicKey: Uint8Array): void {
        this.cache.set(address, publicKey);
    }

    public has(address: Address): boolean {
        return this.cache.has(address);
    }

    public clear(): void {
        this.cache.clear();
    }
}

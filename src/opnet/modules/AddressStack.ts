import { Address } from '@btc-vision/transaction';

export class AddressStack {
    private items: Address[] = [];
    private bigintItems: bigint[] = [];

    public get length(): number {
        return this.items.length;
    }

    public push(address: Address): number {
        this.bigintItems.push(address.toBigInt());

        return this.items.push(address);
    }

    public pop(): Address | undefined {
        this.bigintItems.pop();

        return this.items.pop();
    }

    public peek(): Address | undefined {
        if (this.length == 0) return undefined;

        return this.items[this.length - 1];
    }

    public clear(): void {
        this.items = [];
        this.bigintItems = [];
    }

    public includes(address: Address): boolean {
        return this.bigintItems.includes(address.toBigInt());
    }

    public concat(other: AddressStack): AddressStack {
        const result = new AddressStack();
        result.items = this.items.concat(other.items);
        result.bigintItems = this.bigintItems.concat(other.bigintItems);
        return result;
    }

    public toString(): string {
        return this.items.toString();
    }

    *[Symbol.iterator]() {
        for (const item of this.items) {
            yield item;
        }
    }
}

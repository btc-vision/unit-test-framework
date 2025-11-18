export class FastBigIntMap {
    private items: Record<string, bigint>;
    private keyOrder: bigint[];

    constructor(iterable?: ReadonlyArray<readonly [bigint, bigint]> | null | FastBigIntMap) {
        this.items = {};
        this.keyOrder = [];

        if (iterable instanceof FastBigIntMap) {
            this.setAll(iterable);
        } else {
            if (iterable) {
                for (const [key, value] of iterable) {
                    this.set(key, value);
                }
            }
        }
    }

    get size(): number {
        return this.keyOrder.length;
    }

    public setAll(map: FastBigIntMap): void {
        this.items = { ...map.items };
        this.keyOrder = [...map.keyOrder];
    }

    public addAll(map: FastBigIntMap): void {
        for (const [key, value] of map.entries()) {
            this.set(key, value);
        }
    }

    set(key: bigint, value: bigint): this {
        const keyStr = key.toString();
        if (!this.has(key)) {
            this.keyOrder.push(key);
        }
        this.items[keyStr] = value;
        return this;
    }

    get(key: bigint): bigint | undefined {
        return this.items[key.toString()];
    }

    has(key: bigint): boolean {
        return Object.prototype.hasOwnProperty.call(this.items, key.toString());
    }

    delete(key: bigint): boolean {
        const keyStr = key.toString();
        if (this.has(key)) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete this.items[keyStr];
            // Remove from keyOrder
            this.keyOrder = this.keyOrder.filter((k) => k !== key);
            return true;
        }
        return false;
    }

    clear(): void {
        this.items = {};
        this.keyOrder = [];
    }

    *entries(): IterableIterator<[bigint, bigint]> {
        for (const key of this.keyOrder) {
            yield [key, this.items[key.toString()]];
        }
    }

    *keys(): IterableIterator<bigint> {
        yield* this.keyOrder;
    }

    *values(): IterableIterator<bigint> {
        for (const key of this.keyOrder) {
            yield this.items[key.toString()];
        }
    }

    forEach(
        callback: (value: bigint, key: bigint, map: FastBigIntMap) => void,
        thisArg?: unknown,
    ): void {
        for (const key of this.keyOrder) {
            callback.call(thisArg, this.items[key.toString()], key, this);
        }
    }

    [Symbol.iterator](): IterableIterator<[bigint, bigint]> {
        return this.entries();
    }
}

export class FastBigIntMap {
    private items: Map<bigint, bigint>;
    private keyOrder: bigint[];

    constructor(iterable?: ReadonlyArray<readonly [bigint, bigint]> | null | FastBigIntMap) {
        this.items = new Map();
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
        this.items = new Map(map.items);
        this.keyOrder = [...map.keyOrder];
    }

    public addAll(map: FastBigIntMap): void {
        for (const [key, value] of map.entries()) {
            this.set(key, value);
        }
    }

    set(key: bigint, value: bigint): this {
        if (!this.items.has(key)) {
            this.keyOrder.push(key);
        }
        this.items.set(key, value);
        return this;
    }

    get(key: bigint): bigint | undefined {
        return this.items.get(key);
    }

    has(key: bigint): boolean {
        return this.items.has(key);
    }

    delete(key: bigint): boolean {
        if (this.items.delete(key)) {
            this.keyOrder = this.keyOrder.filter((k) => k !== key);
            return true;
        }
        return false;
    }

    clear(): void {
        this.items.clear();
        this.keyOrder = [];
    }

    *entries(): IterableIterator<[bigint, bigint]> {
        for (const key of this.keyOrder) {
            yield [key, this.items.get(key) as bigint];
        }
    }

    *keys(): IterableIterator<bigint> {
        yield* this.keyOrder;
    }

    *values(): IterableIterator<bigint> {
        for (const key of this.keyOrder) {
            yield this.items.get(key) as bigint;
        }
    }

    forEach(
        callback: (value: bigint, key: bigint, map: FastBigIntMap) => void,
        thisArg?: unknown,
    ): void {
        for (const key of this.keyOrder) {
            callback.call(thisArg, this.items.get(key) as bigint, key, this);
        }
    }

    [Symbol.iterator](): IterableIterator<[bigint, bigint]> {
        return this.entries();
    }
}

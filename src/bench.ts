import { Address, AddressMap } from '@btc-vision/transaction';
import { performance } from 'perf_hooks';
import crypto from 'crypto';

// #region Original FastBigIntMap
class FastBigIntMap<V> {
    private items: Record<string, V>;
    private keyOrder: bigint[];

    constructor(iterable?: ReadonlyArray<readonly [bigint, V]> | null | FastBigIntMap<V>) {
        // NOTE: Object.create(null) is faster, but sticking to original implementation
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

    public setAll(map: FastBigIntMap<V>): void {
        this.items = { ...map.items };
        this.keyOrder = [...map.keyOrder];
    }

    public addAll(map: FastBigIntMap<V>): void {
        for (const [key, value] of map.entries()) {
            this.set(key, value);
        }
    }

    set(key: bigint, value: V): this {
        const keyStr = key.toString();
        if (!this.has(key)) {
            this.keyOrder.push(key);
        }
        this.items[keyStr] = value;
        return this;
    }

    get(key: bigint): V | undefined {
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
            this.keyOrder = this.keyOrder.filter((k) => k !== key);
            return true;
        }
        return false;
    }

    clear(): void {
        this.items = {};
        this.keyOrder = [];
    }

    *entries(): IterableIterator<[bigint, V]> {
        for (const key of this.keyOrder) {
            yield [key, this.items[key.toString()]];
        }
    }

    *keys(): IterableIterator<bigint> {
        yield* this.keyOrder;
    }

    *values(): IterableIterator<V> {
        for (const key of this.keyOrder) {
            yield this.items[key.toString()];
        }
    }

    forEach(
        callback: (value: V, key: bigint, map: FastBigIntMap<V>) => void,
        thisArg?: unknown,
    ): void {
        for (const key of this.keyOrder) {
            callback.call(thisArg, this.items[key.toString()], key, this);
        }
    }

    [Symbol.iterator](): IterableIterator<[bigint, V]> {
        return this.entries();
    }
}
// #endregion

// #region Cache Implementations
interface CacheImplementation {
    size: number;
    get(address: Address): Uint8Array | undefined;
    set(address: Address, value: Uint8Array): void;
    has(address: Address): boolean;
    cleanup?(): void; // Optional cleanup method
}

class HybridCache implements CacheImplementation {
    private cache: Map<number, { items: Record<string, Uint8Array>; keys: bigint[] }> = new Map();
    private _size = 0;

    public get size(): number {
        return this._size;
    }

    public get(address: Address): Uint8Array | undefined {
        const bigint = address.toBigInt();
        const bucket = Number(bigint >> 224n); // Top 32 bits as bucket key
        const shard = this.cache.get(bucket);
        if (!shard) return undefined;
        return shard.items[bigint.toString()];
    }

    public set(address: Address, value: Uint8Array): void {
        const bigint = address.toBigInt();
        const bucket = Number(bigint >> 224n); // Top 32 bits as bucket key

        let shard = this.cache.get(bucket);
        if (!shard) {
            shard = { items: {}, keys: [] };
            this.cache.set(bucket, shard);
        }

        const keyStr = bigint.toString();
        if (!Object.prototype.hasOwnProperty.call(shard.items, keyStr)) {
            shard.keys.push(bigint);
            this._size++;
        }
        shard.items[keyStr] = value;
    }

    public has(address: Address): boolean {
        const bigint = address.toBigInt();
        const bucket = Number(bigint >> 224n);
        const shard = this.cache.get(bucket);
        if (!shard) return false;
        return Object.prototype.hasOwnProperty.call(shard.items, bigint.toString());
    }

    public mainMapSize(): number {
        return this.cache.size;
    }
}

class SingleBigIntCache implements CacheImplementation {
    private cache: Map<bigint, Uint8Array> = new Map();

    public get size(): number {
        return this.cache.size;
    }

    public get(address: Address): Uint8Array | undefined {
        return this.cache.get(address.toBigInt());
    }

    public set(address: Address, value: Uint8Array): void {
        this.cache.set(address.toBigInt(), value);
    }

    public has(address: Address): boolean {
        return this.cache.has(address.toBigInt());
    }
}

class FastBigIntMapCache implements CacheImplementation {
    private cache: FastBigIntMap<Uint8Array> = new FastBigIntMap();

    public get size(): number {
        return this.cache.size;
    }

    public get(address: Address): Uint8Array | undefined {
        return this.cache.get(address.toBigInt());
    }

    public set(address: Address, value: Uint8Array): void {
        this.cache.set(address.toBigInt(), value);
    }

    public has(address: Address): boolean {
        return this.cache.has(address.toBigInt());
    }
}

class NestedBigIntCache implements CacheImplementation {
    private cache: Map<bigint, Map<bigint, Map<bigint, Map<bigint, Uint8Array>>>> = new Map();
    private _size = 0;

    public get size(): number {
        return this._size;
    }

    public mainMapSize(): number {
        return this.cache.size;
    }

    public get(address: Address): Uint8Array | undefined {
        const [k1, k2, k3, k4] = address.toUint64Array();
        return this.cache.get(k1)?.get(k2)?.get(k3)?.get(k4);
    }

    public set(address: Address, value: Uint8Array): void {
        const [k1, k2, k3, k4] = address.toUint64Array();

        let l2 = this.cache.get(k1);
        if (!l2) {
            l2 = new Map();
            this.cache.set(k1, l2);
        }

        let l3 = l2.get(k2);
        if (!l3) {
            l3 = new Map();
            l2.set(k2, l3);
        }

        let l4 = l3.get(k3);
        if (!l4) {
            l4 = new Map();
            l3.set(k3, l4);
        }

        if (!l4.has(k4)) {
            this._size++;
        }
        l4.set(k4, value);
    }

    public has(address: Address): boolean {
        const [k1, k2, k3, k4] = address.toUint64Array();
        return this.cache.get(k1)?.get(k2)?.get(k3)?.has(k4) ?? false;
    }
}

class HexKeyCache implements CacheImplementation {
    private cache: Map<string, Uint8Array> = new Map();

    public get size(): number {
        return this.cache.size;
    }

    public get(address: Address): Uint8Array | undefined {
        return this.cache.get(this.getKey(address));
    }

    public set(address: Address, value: Uint8Array): void {
        this.cache.set(this.getKey(address), value);
    }

    public has(address: Address): boolean {
        return this.cache.has(this.getKey(address));
    }

    private getKey(address: Address): string {
        return address.toBuffer().toString('hex');
    }
}

class StringKeyCache implements CacheImplementation {
    private cache: Map<string, Uint8Array> = new Map();

    public get size(): number {
        return this.cache.size;
    }

    public get(address: Address): Uint8Array | undefined {
        return this.cache.get(this.getKey(address));
    }

    public set(address: Address, value: Uint8Array): void {
        this.cache.set(this.getKey(address), value);
    }

    public has(address: Address): boolean {
        return this.cache.has(this.getKey(address));
    }

    private getKey(address: Address): string {
        return address.toString();
    }
}

export class CustomMap<K, V> {
    private static readonly INITIAL_CAPACITY = 16;
    private static readonly LOAD_FACTOR = 0.75;

    #keys: (K | undefined)[];
    #values: (V | undefined)[];

    private deleted: boolean[];
    private capacity: number;

    constructor() {
        this.capacity = CustomMap.INITIAL_CAPACITY;
        this.#keys = new Array<K>(this.capacity);
        this.#values = new Array<V>(this.capacity);
        this.deleted = new Array<boolean>(this.capacity).fill(false);
    }

    private _size: number = 0;

    public get size(): number {
        return this._size;
    }

    public set(key: K, value: V): void {
        const index = this.findInsertIndex(key);

        if (this.#keys[index] === undefined || this.deleted[index]) {
            this._size++;
        }

        this.#keys[index] = key;
        this.#values[index] = value;
        this.deleted[index] = false;

        if (this._size > this.capacity * CustomMap.LOAD_FACTOR) {
            this.resize();
        }
    }

    public get(key: K): V | undefined {
        const index = this.findIndex(key);
        return index === -1 ? undefined : this.#values[index];
    }

    public has(key: K): boolean {
        return this.findIndex(key) !== -1;
    }

    public delete(key: K): boolean {
        const index = this.findIndex(key);

        if (index === -1) {
            return false;
        }

        this.#keys[index] = undefined;
        this.#values[index] = undefined;
        this.deleted[index] = true;
        this._size--;

        return true;
    }

    public clear(): void {
        this.#keys = new Array<K>(this.capacity);
        this.#values = new Array<V>(this.capacity);
        this.deleted = new Array<boolean>(this.capacity).fill(false);
        this._size = 0;
    }

    public *entries(): IterableIterator<[K, V]> {
        for (let i = 0; i < this.capacity; i++) {
            if (this.#keys[i] !== undefined && !this.deleted[i]) {
                yield [this.#keys[i] as K, this.#values[i] as V];
            }
        }
    }

    public *keys(): IterableIterator<K> {
        for (let i = 0; i < this.capacity; i++) {
            if (this.#keys[i] !== undefined && !this.deleted[i]) {
                yield this.#keys[i] as K;
            }
        }
    }

    public *values(): IterableIterator<V> {
        for (let i = 0; i < this.capacity; i++) {
            if (this.#keys[i] !== undefined && !this.deleted[i]) {
                yield this.#values[i] as V;
            }
        }
    }

    *[Symbol.iterator](): IterableIterator<[K, V]> {
        yield* this.entries();
    }

    private hashBigInt(key: bigint): number {
        // For small bigints that fit in 32 bits, use direct conversion
        if (key >= -2147483648n && key <= 2147483647n) {
            return Number(key) | 0;
        }

        // For larger bigints, use bit manipulation
        // Mix high and low 32-bit parts
        let hash = 2166136261; // FNV-1a initial value

        // Process the bigint in 32-bit chunks
        let n = key < 0n ? -key : key;

        while (n > 0n) {
            // Extract 32-bit chunk
            const chunk = Number(n & 0xffffffffn);
            hash ^= chunk;
            hash = Math.imul(hash, 16777619);
            n = n >> 32n;
        }

        // Mix in the sign
        if (key < 0n) {
            hash ^= 0x80000000;
            hash = Math.imul(hash, 16777619);
        }

        return Math.abs(hash);
    }

    private hash(key: K): number {
        let hash = 0;

        switch (typeof key) {
            case 'number':
                // Handle NaN and infinity specially
                if (key !== key) return 0x7ff8000000000000; // NaN
                if (!isFinite(key)) return key > 0 ? 0x7ff0000000000000 : 0xfff0000000000000;
                // Use the number itself as hash
                hash = key | 0; // Convert to 32-bit integer
                break;

            case 'string':
                // FNV-1a hash for strings
                hash = 2166136261;
                for (let i = 0; i < (key as string).length; i++) {
                    hash ^= (key as string).charCodeAt(i);
                    hash = Math.imul(hash, 16777619);
                }
                break;

            case 'boolean':
                hash = key ? 1231 : 1237;
                break;

            case 'symbol': {
                // Symbols need special handling - use description
                const desc = (key as symbol).description || '';
                hash = this.hash(desc as K); // Recursive call with string
                break;
            }

            case 'bigint':
                // Convert bigint to string for hashing
                hash = this.hashBigInt(key);
                break;

            case 'undefined':
                hash = 0;
                break;

            case 'object':
                if (key === null) {
                    hash = 0;
                } else if (key instanceof Date) {
                    hash = key.getTime() | 0;
                } else if (ArrayBuffer.isView(key) || key instanceof ArrayBuffer) {
                    // Handle Buffer, TypedArrays, ArrayBuffer
                    hash = this.hashBuffer(key);
                } else if (Array.isArray(key)) {
                    // Hash arrays by combining element hashes
                    hash = 1;
                    for (const item of key) {
                        hash = Math.imul(hash, 31) + this.hash(item as K);
                    }
                } else {
                    throw new Error('Raw object not supported.');
                    // For objects, we need reference equality
                    // So we'll use linear probing with === comparison
                    // Start with a random-ish position
                    //hash = 0x42424242;
                }
                break;

            case 'function':
                // Hash function by its string representation
                hash = this.hash(key.toString() as K);
                break;
        }

        // Ensure positive index
        return Math.abs(hash) % this.capacity;
    }

    private hashBuffer(buffer: ArrayBuffer | object): number {
        let bytes: Uint8Array;

        if (buffer instanceof ArrayBuffer) {
            bytes = new Uint8Array(buffer);
        } else if (ArrayBuffer.isView(buffer)) {
            bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        } else {
            return 0;
        }

        // FNV-1a hash for bytes
        let hash = 2166136261;
        for (let i = 0; i < Math.min(bytes.length, 100); i++) {
            // Cap at 100 bytes for performance
            hash ^= bytes[i];
            hash = Math.imul(hash, 16777619);
        }
        return hash;
    }

    private equals(a: K, b: K): boolean {
        // Handle special cases
        if (a === b) return true;

        // NaN === NaN should be true for map #keys
        if (typeof a === 'number' && typeof b === 'number' && a !== a && b !== b) {
            return true;
        }

        // For buffers, do deep comparison
        if (
            (ArrayBuffer.isView(a) || a instanceof ArrayBuffer) &&
            (ArrayBuffer.isView(b) || b instanceof ArrayBuffer)
        ) {
            return this.buffersEqual(a, b);
        }

        return false;
    }

    private buffersEqual(a: ArrayBuffer | object, b: ArrayBuffer | object): boolean {
        const bytesA = this.getBytes(a);
        const bytesB = this.getBytes(b);

        if (bytesA.length !== bytesB.length) return false;

        for (let i = 0; i < bytesA.length; i++) {
            if (bytesA[i] !== bytesB[i]) return false;
        }

        return true;
    }

    private getBytes(buffer: ArrayBuffer | object): Uint8Array {
        if (buffer instanceof ArrayBuffer) {
            return new Uint8Array(buffer);
        } else if (ArrayBuffer.isView(buffer)) {
            return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        }
        return new Uint8Array(0);
    }

    private findIndex(key: K): number {
        let index = this.hash(key);

        while (this.#keys[index] !== undefined || this.deleted[index]) {
            if (this.#keys[index] !== undefined && this.equals(this.#keys[index] as K, key)) {
                return index;
            }
            index = (index + 1) % this.capacity;
        }

        return -1;
    }

    private findInsertIndex(key: K): number {
        let index = this.hash(key);

        while (this.#keys[index] !== undefined && !this.deleted[index]) {
            if (this.equals(this.#keys[index] as K, key)) {
                return index; // Key already exists
            }
            index = (index + 1) % this.capacity;
        }

        return index;
    }

    private resize(): void {
        const oldKeys = this.#keys;
        const oldValues = this.#values;

        this.capacity *= 2;
        this.#keys = new Array<K>(this.capacity);
        this.#values = new Array<V>(this.capacity);
        this.deleted = new Array<boolean>(this.capacity).fill(false);
        this._size = 0;

        for (let i = 0; i < oldKeys.length; i++) {
            if (oldKeys[i] !== undefined && !this.deleted[i]) {
                this.set(oldKeys[i] as K, oldValues[i] as V);
            }
        }
    }
}

class CustomMapCache implements CacheImplementation {
    private cache: CustomMap<bigint, Uint8Array>;

    constructor() {
        this.cache = new CustomMap<bigint, Uint8Array>();
    }

    public get size(): number {
        return this.cache.size;
    }

    public get(address: Address): Uint8Array | undefined {
        return this.cache.get(address.toBigInt());
    }

    public set(address: Address, value: Uint8Array): void {
        this.cache.set(address.toBigInt(), value);
    }

    public has(address: Address): boolean {
        return this.cache.has(address.toBigInt());
    }
}

// #region Benchmark Utils
function generateRandomAddress(): Address {
    const buffer = Buffer.allocUnsafe(32);
    return new Address(crypto.getRandomValues(buffer));
}

function generateRandomPublicKey(): Uint8Array {
    const buffer = new Uint8Array(32);
    return crypto.getRandomValues(buffer);
}

async function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

interface BenchmarkResult {
    name: string;
    setTimeMs: number;
    getTimeMs: number;
    hasTimeMs: number;
    writeTimeMs: number;
    readTimeMs: number;
    writeOpsPerSecond: number;
    readOpsPerSecond: number;
    writeSpeedup: number;
    readSpeedup: number;
}

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function benchmark(
    name: string,
    cache: CacheImplementation,
    parsedArray: [Address, Uint8Array | Buffer][],
    iterations: number,
): BenchmarkResult {
    const setStartMark = `${name}-set-start`;
    const setEndMark = `${name}-set-end`;

    performance.mark(setStartMark);

    for (let i = 0; i < parsedArray.length; i++) {
        const o = parsedArray[i];
        cache.set(o[0], o[1]);
    }

    console.log('length after set:', cache.size);

    if ('mainMapSize' in cache) {
        // @ts-expect-error dfds fsda fas df adf  fasd
        console.log('main map size after set:', cache.mainMapSize());
    }

    performance.mark(setEndMark);
    performance.measure(`${name}-set`, setStartMark, setEndMark);
    const setMeasure = performance.getEntriesByName(`${name}-set`)[0];
    const setTimeMs = setMeasure.duration;

    const getStartMark = `${name}-get-start`;
    const getEndMark = `${name}-get-end`;
    performance.mark(getStartMark);
    for (let i = 0; i < iterations; i++) {
        const randomIndex = Math.floor(Math.random() * parsedArray.length);
        cache.get(parsedArray[randomIndex][0]);
    }
    performance.mark(getEndMark);
    performance.measure(`${name}-get`, getStartMark, getEndMark);
    const getMeasure = performance.getEntriesByName(`${name}-get`)[0];
    const getTimeMs = getMeasure.duration;

    const hasStartMark = `${name}-has-start`;
    const hasEndMark = `${name}-has-end`;
    performance.mark(hasStartMark);
    for (let i = 0; i < iterations; i++) {
        const randomIndex = Math.floor(Math.random() * parsedArray.length);
        cache.has(parsedArray[randomIndex][0]);
    }
    performance.mark(hasEndMark);
    performance.measure(`${name}-has`, hasStartMark, hasEndMark);
    const hasMeasure = performance.getEntriesByName(`${name}-has`)[0];
    const hasTimeMs = hasMeasure.duration;

    const writeStartMark = `${name}-write-start`;
    const writeEndMark = `${name}-write-end`;
    performance.mark(writeStartMark);
    for (let i = 0; i < iterations; i++) {
        const randomIndex = Math.floor(Math.random() * parsedArray.length);
        cache.set(parsedArray[randomIndex][0], parsedArray[randomIndex][1]);
    }
    performance.mark(writeEndMark);
    performance.measure(`${name}-write`, writeStartMark, writeEndMark);
    const writeMeasure = performance.getEntriesByName(`${name}-write`)[0];
    const writeTimeMs = writeMeasure.duration;

    const readStartMark = `${name}-read-start`;
    const readEndMark = `${name}-read-end`;
    performance.mark(readStartMark);
    for (let i = 0; i < iterations; i++) {
        const randomIndex = Math.floor(Math.random() * parsedArray.length);
        cache.get(parsedArray[randomIndex][0]);
    }
    performance.mark(readEndMark);
    performance.measure(`${name}-read`, readStartMark, readEndMark);
    const readMeasure = performance.getEntriesByName(`${name}-read`)[0];
    const readTimeMs = readMeasure.duration;

    performance.clearMarks();
    performance.clearMeasures();

    const writeOpsPerSecond = (iterations * 1000) / writeTimeMs;
    const readOpsPerSecond = (iterations * 1000) / readTimeMs;

    return {
        name,
        setTimeMs,
        getTimeMs,
        hasTimeMs,
        writeTimeMs,
        readTimeMs,
        writeOpsPerSecond,
        readOpsPerSecond,
        writeSpeedup: 1,
        readSpeedup: 1,
    };
}
// #endregion

// #region Main Runner
export async function runBenchmarks(parsedArray: [bigint, bigint][]): Promise<void> {
    const sizes = [280_000]; // Added 250k to hit the V8 cliff
    const lookups = 10_000;
    const runs = 2;
    const lmdbPath = 'lmdb-benchmark-temp';

    // Factory functions allow for async setup (like lmdb)
    const implementationFactories = [
        { name: 'Custom HashMap (Linear Probe)', factory: () => new CustomMapCache() },
        { name: 'AddressMap (V8 Optimized)', factory: () => new AddressMap<Uint8Array>() },
        { name: '4-Level Nested BigInt Maps', factory: () => new NestedBigIntCache() },
        //{ name: 'Single BigInt Map (V8 Map)', factory: () => new SingleBigIntCache() },
        { name: 'Hybrid Map<u32> + Object Shards', factory: () => new HybridCache() },
        { name: 'FastBigIntMap (Object/String)', factory: () => new FastBigIntMapCache() },
        //{ name: 'Hex String Key (V8 Map)', factory: () => new HexKeyCache() },
        { name: 'Address.toString() Key (V8 Map)', factory: () => new StringKeyCache() },
        /*{
            name: 'LMDB (C++ mmap)',
            factory: async () => {
                // Ensure clean state for each run
                fs.rmSync(lmdbPath, { recursive: true, force: true });
                const db = openLmdb({
                    path: lmdbPath,
                    noSync: true, // Ephemeral / RAM-speed
                    compression: false,
                });
                return new LmdbCache(db);
            },
        },*/
    ];

    for (const size of sizes) {
        console.log(`\n${'='.repeat(120)}`);
        console.log(`BENCHMARK: ${size} items, ${lookups} operations, ${runs} runs`);
        console.log('='.repeat(120));

        console.log(`Generated ${size} random addresses.`);

        const aggregatedResults: Map<string, BenchmarkResult[]> = new Map();

        for (let run = 0; run < runs; run++) {
            console.log(`\n--- Run ${run + 1}/${runs} ---`);

            let implementations = implementationFactories;
            if (run !== 0) {
                implementations = shuffleArray(implementationFactories);
            }

            const array: [Address, Uint8Array | Buffer][] = parsedArray.map((val) => {
                const a = Address.fromBigInt(val[0]);
                const b = Address.fromBigInt(val[1]).toBuffer();

                a.toBigInt();

                return [a, b];
            });

            console.log('Ready!');

            await wait(1000); // Let GC settle

            for (const impl of implementations) {
                console.log(`Running: ${impl.name}`);

                // Allow factory to setup (e.g., open db)
                const cache = impl.factory();
                const result = benchmark(impl.name, cache, array, lookups);

                if (!aggregatedResults.has(impl.name)) {
                    aggregatedResults.set(impl.name, []);
                }
                aggregatedResults.get(impl.name)?.push(result);
            }
        }

        const averagedResults: BenchmarkResult[] = [];
        for (const [name, results] of aggregatedResults) {
            const avg: BenchmarkResult = {
                name,
                setTimeMs: results.reduce((sum, r) => sum + r.setTimeMs, 0) / runs,
                getTimeMs: results.reduce((sum, r) => sum + r.getTimeMs, 0) / runs,
                hasTimeMs: results.reduce((sum, r) => sum + r.hasTimeMs, 0) / runs,
                writeTimeMs: results.reduce((sum, r) => sum + r.writeTimeMs, 0) / runs,
                readTimeMs: results.reduce((sum, r) => sum + r.readTimeMs, 0) / runs,
                writeOpsPerSecond: results.reduce((sum, r) => sum + r.writeOpsPerSecond, 0) / runs,
                readOpsPerSecond: results.reduce((sum, r) => sum + r.readOpsPerSecond, 0) / runs,
                writeSpeedup: 1,
                readSpeedup: 1,
            };
            averagedResults.push(avg);
        }

        const baseline =
            averagedResults.find((r) => r.name === 'Single BigInt Map (V8 Map)') ??
            averagedResults[0];
        const baselineWrite = baseline.writeOpsPerSecond;
        const baselineRead = baseline.readOpsPerSecond;

        averagedResults.forEach((result) => {
            result.writeSpeedup = result.writeOpsPerSecond / baselineWrite;
            result.readSpeedup = result.readOpsPerSecond / baselineRead;
        });

        // Sort by best write performance
        averagedResults.sort((a, b) => b.writeOpsPerSecond - a.writeOpsPerSecond);

        console.log(`\n\nAveraged Results: (Baseline: ${baseline.name})`);
        console.log('─'.repeat(120));
        console.log(
            'Method'.padEnd(35) +
                'WRITE (ms)'.padStart(12) +
                'WRITE Ops/s'.padStart(15) +
                'W Speedup'.padStart(12) +
                'READ (ms)'.padStart(12) +
                'READ Ops/s'.padStart(15) +
                'R Speedup'.padStart(12),
        );
        console.log('─'.repeat(120));

        averagedResults.forEach((result) => {
            console.log(
                result.name.padEnd(35) +
                    result.writeTimeMs.toFixed(2).padStart(12) +
                    result.writeOpsPerSecond.toFixed(0).padStart(15) +
                    `${result.writeSpeedup.toFixed(2)}x`.padStart(12) +
                    result.readTimeMs.toFixed(2).padStart(12) +
                    result.readOpsPerSecond.toFixed(0).padStart(15) +
                    `${result.readSpeedup.toFixed(2)}x`.padStart(12),
            );
        });
        console.log('─'.repeat(120));

        const writeWinner = averagedResults[0]; // Already sorted
        const readWinner = [...averagedResults].sort(
            (a, b) => b.readOpsPerSecond - a.readOpsPerSecond,
        )[0];

        console.log(`\n🏆 Write Winner: ${writeWinner.name}`);
        console.log(`   ${(writeWinner.writeOpsPerSecond / 1_000_000).toFixed(2)} million ops/sec`);

        console.log(`\n🏆 Read Winner: ${readWinner.name}`);
        console.log(`   ${(readWinner.readOpsPerSecond / 1_000_000).toFixed(2)} million ops/sec`);
    }
}

//await wait(1000);

//runBenchmarks().catch(console.error);
// #endregion

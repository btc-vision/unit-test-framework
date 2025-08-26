import { OP721, OP721Interface } from './OP721.js';
import { Address, BinaryReader, BinaryWriter } from '@btc-vision/transaction';
import { CallResponse } from '../opnet/interfaces/CallResponse.js';

// Event interfaces
export interface ReservationCreatedEvent {
    readonly user: Address;
    readonly amount: bigint;
    readonly blockNumber: bigint;
    readonly feePaid: bigint;
}

export interface ReservationClaimedEvent {
    readonly user: Address;
    readonly amount: bigint;
    readonly startTokenId: bigint;
}

export interface ReservationExpiredEvent {
    readonly blockNumber: bigint;
    readonly totalExpired: bigint;
}

export interface MintStatusChangedEvent {
    readonly enabled: boolean;
}

export interface OP721ExtendedStatus {
    readonly minted: bigint;
    readonly reserved: bigint;
    readonly available: bigint;
    readonly maxSupply: bigint;
    readonly blocksWithReservations: number;
    readonly pricePerToken: bigint;
    readonly reservationFeePercent: bigint;
    readonly minReservationFee: bigint;
}

export interface ReservationResponse {
    readonly remainingPayment: bigint;
    readonly reservationBlock: bigint;
}

export interface ClaimResponse {
    readonly startTokenId: bigint;
    readonly amountClaimed: bigint;
}

export interface PurgeResponse {
    readonly totalPurged: bigint;
    readonly blocksProcessed: number;
}

export interface ExtendedOP721Configuration extends OP721Interface {
    readonly mintPrice?: bigint;
    readonly reservationFeePercent?: bigint;
    readonly minReservationFee?: bigint;
    readonly reservationBlocks?: bigint;
    readonly graceBlocks?: bigint;
    readonly maxReservationAmount?: number;
}

/**
 * OP721Extended - Extended NFT contract interface with reservation system
 * Supports minting with reservations, similar to the MyNFT contract
 */

export class OP721Extended extends OP721 {
    public readonly MINT_PRICE: bigint = 100000n; // 0.001 BTC per NFT
    public readonly RESERVATION_FEE_PERCENT: bigint = 15n; // 15% upfront
    public readonly MIN_RESERVATION_FEE: bigint = 1000n; // Minimum 1000 sats
    public readonly RESERVATION_BLOCKS: bigint = 5n; // 5 blocks to pay
    public readonly GRACE_BLOCKS: bigint = 1n; // 1 block grace period
    public readonly MAX_RESERVATION_AMOUNT: number = 20; // Max per reservation

    // Selector definitions for extended functionality
    protected readonly setMintEnabledSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('setMintEnabled(bool)')}`,
    );

    protected readonly isMintEnabledSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('isMintEnabled()')}`,
    );

    protected readonly reserveSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('reserve(uint256)')}`,
    );

    protected readonly claimSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('claim()')}`,
    );

    protected readonly purgeExpiredSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('purgeExpired()')}`,
    );

    protected readonly getStatusSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('getStatus()')}`,
    );

    protected readonly onOP721ReceivedSelector: number = Number(
        `0x${this.abiCoder.encodeSelector('onOP721Received(address,address,uint256,bytes)')}`,
    );

    constructor(details: ExtendedOP721Configuration) {
        super(details);

        // Override constants if provided
        if (details.mintPrice) this.MINT_PRICE = details.mintPrice;
        if (details.reservationFeePercent)
            this.RESERVATION_FEE_PERCENT = details.reservationFeePercent;
        if (details.minReservationFee) this.MIN_RESERVATION_FEE = details.minReservationFee;
        if (details.reservationBlocks) this.RESERVATION_BLOCKS = details.reservationBlocks;
        if (details.graceBlocks) this.GRACE_BLOCKS = details.graceBlocks;
        if (details.maxReservationAmount)
            this.MAX_RESERVATION_AMOUNT = details.maxReservationAmount;
    }

    /**
     * Decode reservation created event
     */
    public static decodeReservationCreatedEvent(
        data: Buffer | Uint8Array,
    ): ReservationCreatedEvent {
        const reader = new BinaryReader(data);
        const user = reader.readAddress();
        const amount = reader.readU256();
        const blockNumber = reader.readU256();
        const feePaid = reader.readU64();

        return { user, amount, blockNumber, feePaid };
    }

    /**
     * Decode reservation claimed event
     */
    public static decodeReservationClaimedEvent(
        data: Buffer | Uint8Array,
    ): ReservationClaimedEvent {
        const reader = new BinaryReader(data);
        const user = reader.readAddress();
        const amount = reader.readU256();
        const startTokenId = reader.readU256();

        return { user, amount, startTokenId };
    }

    /**
     * Decode reservation expired event
     */
    public static decodeReservationExpiredEvent(
        data: Buffer | Uint8Array,
    ): ReservationExpiredEvent {
        const reader = new BinaryReader(data);
        const blockNumber = reader.readU256();
        const totalExpired = reader.readU256();

        return { blockNumber, totalExpired };
    }

    /**
     * Decode mint status changed event
     */
    public static decodeMintStatusChangedEvent(data: Buffer | Uint8Array): MintStatusChangedEvent {
        const reader = new BinaryReader(data);
        const enabled = reader.readBoolean();

        return { enabled };
    }

    /**
     * Helper: Format price in BTC
     * @param sats Amount in satoshis
     * @returns Formatted BTC string
     */
    public static formatBTC(sats: bigint): string {
        const btc = Number(sats) / 100_000_000;
        return `${btc.toFixed(8)} BTC`;
    }

    /**
     * Enable or disable minting (deployer only)
     */
    public async setMintEnabled(enabled: boolean): Promise<CallResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.setMintEnabledSelector);
        calldata.writeBoolean(enabled);

        return await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
        });
    }

    /**
     * Check if minting is enabled
     */
    public async isMintEnabled(): Promise<boolean> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.isMintEnabledSelector);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            saveStates: false,
        });

        const reader = new BinaryReader(result.response);
        return reader.readBoolean();
    }

    /**
     * Reserve NFTs by paying upfront fee
     * @param quantity Number of NFTs to reserve (1-20)
     * @param sender Address making the reservation
     * @returns Remaining payment required and reservation block
     */
    public async reserve(quantity: bigint, sender: Address): Promise<ReservationResponse> {
        if (quantity <= 0n || quantity > this.MAX_RESERVATION_AMOUNT) {
            throw new Error('Invalid quantity: must be between 1 and 20');
        }

        const calldata = new BinaryWriter();
        calldata.writeSelector(this.reserveSelector);
        calldata.writeU256(quantity);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            sender: sender,
            txOrigin: sender,
        });

        const reader = new BinaryReader(result.response);
        const remainingPayment = reader.readU64();
        const reservationBlock = reader.readU256();

        return { remainingPayment, reservationBlock };
    }

    /**
     * Claim reserved NFTs by paying the remaining balance
     * Must be called within RESERVATION_BLOCKS + GRACE_BLOCKS (6 blocks total)
     * @param sender Address claiming the reservation
     * @returns Start token ID and amount claimed
     */
    public async claim(sender: Address): Promise<ClaimResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.claimSelector);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            sender: sender,
            txOrigin: sender,
        });

        const reader = new BinaryReader(result.response);
        const startTokenId = reader.readU256();
        const amountClaimed = reader.readU256();

        return { startTokenId, amountClaimed };
    }

    /**
     * Purge expired reservations to free up supply
     * @returns Total purged amount and blocks processed
     */
    public async purgeExpired(): Promise<PurgeResponse> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.purgeExpiredSelector);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            saveStates: true,
        });

        const reader = new BinaryReader(result.response);
        const totalPurged = reader.readU256();
        const blocksProcessed = reader.readU32();

        return { totalPurged, blocksProcessed };
    }

    /**
     * Get current minting status including supply and pricing info
     * @returns Complete status of the NFT contract
     */
    public async getStatus(): Promise<OP721ExtendedStatus> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.getStatusSelector);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            saveStates: false,
        });

        const reader = new BinaryReader(result.response);
        const minted = reader.readU256();
        const reserved = reader.readU256();
        const available = reader.readU256();
        const maxSupply = reader.readU256();
        const blocksWithReservations = reader.readU32();
        const pricePerToken = reader.readU64();
        const reservationFeePercent = reader.readU64();
        const minReservationFee = reader.readU64();

        return {
            minted,
            reserved,
            available,
            maxSupply,
            blocksWithReservations,
            pricePerToken,
            reservationFeePercent,
            minReservationFee,
        };
    }

    /**
     * Handle receiving NFTs from another contract
     * Implements the onOP721Received callback
     */
    public async onOP721Received(
        operator: Address,
        from: Address,
        tokenId: bigint,
        data: Uint8Array,
        receiver: Address,
    ): Promise<number> {
        const calldata = new BinaryWriter();
        calldata.writeSelector(this.onOP721ReceivedSelector);
        calldata.writeAddress(operator);
        calldata.writeAddress(from);
        calldata.writeU256(tokenId);
        calldata.writeBytesWithLength(data);

        const result = await this.executeThrowOnError({
            calldata: calldata.getBuffer(),
            sender: receiver,
            txOrigin: receiver,
        });

        const reader = new BinaryReader(result.response);
        return reader.readSelector();
    }

    /**
     * Helper: Calculate reservation fee for a given quantity
     * @param quantity Number of NFTs
     * @returns Required reservation fee in sats
     */
    public calculateReservationFee(quantity: bigint): bigint {
        const totalCost = this.MINT_PRICE * quantity;
        const calculatedFee = (totalCost * this.RESERVATION_FEE_PERCENT) / 100n;

        return calculatedFee < this.MIN_RESERVATION_FEE ? this.MIN_RESERVATION_FEE : calculatedFee;
    }

    /**
     * Helper: Calculate remaining payment after reservation
     * @param quantity Number of NFTs
     * @returns Remaining payment required to claim
     */
    public calculateRemainingPayment(quantity: bigint): bigint {
        const totalCost = this.MINT_PRICE * quantity;
        const reservationFee = this.calculateReservationFee(quantity);
        return totalCost - reservationFee;
    }

    /**
     * Helper: Check if a reservation is expired
     * @param reservationBlock Block when reservation was made
     * @param currentBlock Current block number
     * @returns True if the reservation has expired
     */
    public isReservationExpired(reservationBlock: bigint, currentBlock: bigint): boolean {
        const expiryBlock = reservationBlock + this.RESERVATION_BLOCKS + this.GRACE_BLOCKS;
        return currentBlock > expiryBlock;
    }

    /**
     * Helper: Get blocks remaining until reservation expires
     * @param reservationBlock Block when reservation was made
     * @param currentBlock Current block number
     * @returns Number of blocks remaining (0 if expired)
     */
    public getBlocksUntilExpiry(reservationBlock: bigint, currentBlock: bigint): bigint {
        const expiryBlock = reservationBlock + this.RESERVATION_BLOCKS + this.GRACE_BLOCKS;
        if (currentBlock >= expiryBlock) {
            return 0n;
        }
        return expiryBlock - currentBlock;
    }

    /**
     * Get complete reservation info for display
     * @returns Object with all reservation constants and current status
     */
    public async getReservationInfo(): Promise<{
        status: OP721ExtendedStatus;
        constants: {
            mintPrice: string;
            reservationFeePercent: string;
            minReservationFee: string;
            reservationBlocks: number;
            graceBlocks: number;
            maxReservationAmount: number;
            totalExpiryBlocks: number;
        };
    }> {
        const status = await this.getStatus();

        return {
            status,
            constants: {
                mintPrice: OP721Extended.formatBTC(this.MINT_PRICE),
                reservationFeePercent: `${this.RESERVATION_FEE_PERCENT}%`,
                minReservationFee: OP721Extended.formatBTC(this.MIN_RESERVATION_FEE),
                reservationBlocks: Number(this.RESERVATION_BLOCKS),
                graceBlocks: Number(this.GRACE_BLOCKS),
                maxReservationAmount: this.MAX_RESERVATION_AMOUNT,
                totalExpiryBlocks: Number(this.RESERVATION_BLOCKS + this.GRACE_BLOCKS),
            },
        };
    }
}

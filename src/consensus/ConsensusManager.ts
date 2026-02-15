import { Logger } from '@btc-vision/logger';
import { ConsensusRules } from './ConsensusRules.js';

class BaseConsensusManager extends Logger {
    private readonly consensusRules: ConsensusRules = new ConsensusRules();

    constructor() {
        super();

        this.default();
    }

    public getFlags(): bigint {
        return this.consensusRules.asBigInt();
    }

    public default(): void {
        this.consensusRules.reset();
        this.consensusRules.insertFlag(ConsensusRules.UNSAFE_QUANTUM_SIGNATURES_ALLOWED);
        this.consensusRules.insertFlag(ConsensusRules.UPDATE_CONTRACT_BY_ADDRESS);
    }
}

export const ConsensusManager = new BaseConsensusManager();

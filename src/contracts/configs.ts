import { Network, networks } from '@btc-vision/bitcoin';
import { IConsensusRules } from '../rules/IConsensusRules.js';
import { Consensus } from '@btc-vision/transaction';
import { ConsensusMetadata } from '../rules/versions/ConsensusMetadata.js';

// Network
export const NETWORK: Network = networks.regtest;

export const VERSION_NAME: Consensus = Consensus.Roswell;
if (!ConsensusMetadata[VERSION_NAME]) {
    throw new Error(`Consensus ${VERSION_NAME} not found in metadata`);
}

export const CONSENSUS: IConsensusRules<Consensus> = ConsensusMetadata[
    VERSION_NAME
] as IConsensusRules<Consensus>;

// Trace flags
export const TRACE_GAS: boolean = false;
export const TRACE_POINTERS: boolean = false;
export const TRACE_CALLS: boolean = false;
export const TRACE_DEPLOYMENTS: boolean = false;

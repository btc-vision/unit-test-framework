import { Network, networks } from '@btc-vision/bitcoin';
import { Consensus } from '@btc-vision/transaction';
import { ConsensusMetadata } from '../rules/versions/ConsensusMetadata.js';
import { IOPNetConsensus } from '../rules/IConsensusRules';

// Network
export const NETWORK: Network = networks.regtest;

export const VERSION_NAME: Consensus = Consensus.Roswell;
if (!ConsensusMetadata[VERSION_NAME]) {
    throw new Error(`Consensus ${VERSION_NAME} not found in metadata`);
}

export const CONSENSUS: IOPNetConsensus<Consensus> = ConsensusMetadata[
    VERSION_NAME
] as IOPNetConsensus<Consensus>;

// Trace flags
export const TRACE_GAS: boolean = false;
export const TRACE_POINTERS: boolean = false;
export const TRACE_CALLS: boolean = false;
export const TRACE_DEPLOYMENTS: boolean = false;

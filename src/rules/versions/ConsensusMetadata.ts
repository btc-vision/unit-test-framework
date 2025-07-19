import { IOPNetConsensus } from '../IConsensusRules.js';
import { RoswellConsensus } from './RoswellConsensus.js';
import { Consensus } from '@btc-vision/transaction';

export const ConsensusMetadata: { [key in Consensus]?: IOPNetConsensus<key> } = {
    [Consensus.Roswell]: RoswellConsensus,
};

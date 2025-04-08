import { IConsensusRules } from '../IConsensusRules.js';
import { RoswellConsensus } from './RosewellConsensus.js';
import { Consensus } from '@btc-vision/transaction';

export const ConsensusMetadata: { [key in Consensus]?: IConsensusRules<key> } = {
    [Consensus.Roswell]: RoswellConsensus,
};

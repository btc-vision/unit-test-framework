import { Network, networks } from '@btc-vision/bitcoin';

// Network
export const NETWORK: Network = networks.regtest;

// Max call stack depth
export const MAX_CALL_STACK_DEPTH: number = 20;

// Trace flags
export const TRACE_GAS: boolean = false;
export const TRACE_POINTERS: boolean = false;
export const TRACE_CALLS: boolean = false;
export const TRACE_DEPLOYMENTS: boolean = false;
export const DISABLE_REENTRANCY_GUARD: boolean = true;

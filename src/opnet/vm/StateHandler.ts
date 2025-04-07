import { Address, AddressMap } from '@btc-vision/transaction';
import { FastBigIntMap } from '../modules/FastMap.js';

class InternalStateHandler {
    protected states: AddressMap<FastBigIntMap> = new AddressMap();
    protected instancesTemporaryStates: AddressMap<FastBigIntMap> = new AddressMap();
    protected deployed: AddressMap<boolean> = new AddressMap();

    public isDeployed(contract: Address): boolean {
        const state = this.deployed.get(contract);
        if (state) {
            return state;
        }

        return false;
    }

    public setDeployed(contract: Address, deployed: boolean): void {
        const state = this.deployed.get(contract);
        if (state) {
            this.deployed.set(contract, deployed);
        } else {
            this.deployed.set(contract, deployed);
        }
    }

    public pushAllTempStatesToGlobal(): void {
        for (const [contract, tempState] of this.instancesTemporaryStates.entries()) {
            if (!tempState.size) {
                console.log(`Skipped because states were purged.`);

                continue;
            }

            const globalState = this.states.get(contract);
            console.log(`Pushing temp states to global for contract:`, contract);

            if (globalState) {
                globalState.addAll(tempState);
            } else {
                this.states.set(contract, new FastBigIntMap(tempState));
            }

            tempState.clear();
        }

        this.instancesTemporaryStates.clear();
    }

    public getTemporaryStates(contract: Address): FastBigIntMap {
        const state = this.instancesTemporaryStates.get(contract);
        if (state) {
            return state;
        }

        return new FastBigIntMap();
    }

    public setTemporaryStates(contract: Address, states: FastBigIntMap): void {
        const state = this.instancesTemporaryStates.get(contract);
        if (state) {
            state.setAll(states);
        } else {
            this.instancesTemporaryStates.set(contract, new FastBigIntMap(states));
        }
    }

    public clearTemporaryStates(contract: Address): void {
        console.log(`Clearing temp states for contract: ${contract.toString()}`);

        const state = this.instancesTemporaryStates.get(contract);
        if (state) {
            state.clear();
        }

        this.instancesTemporaryStates.delete(contract);

        console.log('instancesTemporaryStates', this.instancesTemporaryStates);
    }

    public globalLoad(contract: Address, pointer: bigint): bigint | undefined {
        const state = this.states.get(contract);
        if (state) {
            return state.get(pointer);
        }

        return undefined;
    }

    public globalHas(contract: Address, pointer: bigint): boolean {
        const state = this.states.get(contract);
        if (state) {
            return state.has(pointer);
        }
        return false;
    }

    public resetGlobalStates(contract: Address): void {
        const state = this.states.get(contract);
        if (state) {
            state.clear();
        } else {
            this.states.set(contract, new FastBigIntMap());
        }
    }

    public purgeAll(): void {
        for (const state of this.states.values()) {
            state.clear();
        }
    }
}

export const StateHandler = new InternalStateHandler();

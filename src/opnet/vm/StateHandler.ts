import { Address, AddressMap, FastMap } from '@btc-vision/transaction';

class InternalStateHandler {
    protected states: AddressMap<FastMap<bigint, bigint>> = new AddressMap();
    protected instancesTemporaryStates: AddressMap<FastMap<bigint, bigint>> = new AddressMap();
    protected deployed: AddressMap<boolean> = new AddressMap();
    protected pendingDeployments: AddressMap<boolean> = new AddressMap();

    public overrideStates(contract: Address, states: FastMap<bigint, bigint>): void {
        const state = this.states.get(contract);
        if (state) {
            state.setAll(states);
        } else {
            this.states.set(contract, new FastMap<bigint, bigint>(states));
        }
    }

    public overrideDeployment(contract: Address): void {
        this.deployed.set(contract, true);
    }

    public getStates(contract: Address): FastMap<bigint, bigint> {
        const state = this.states.get(contract);
        if (state) {
            return state;
        }

        // If no state exists, create a new one
        const newState = new FastMap<bigint, bigint>();
        this.states.set(contract, newState);

        return newState;
    }

    public isDeployed(contract: Address): boolean {
        const state = this.pendingDeployments.get(contract) || this.deployed.get(contract);
        if (state) {
            return state;
        }

        return false;
    }

    public resetPendingDeployments(): void {
        this.pendingDeployments.clear();
    }

    public setPendingDeployments(contract: Address): void {
        if (this.pendingDeployments.has(contract)) {
            throw new Error(`Contract ${contract.toString()} is already pending deployment.`);
        }

        this.pendingDeployments.set(contract, true);
    }

    public markAllPendingDeploymentsAsDone(): void {
        for (const contract of this.pendingDeployments.keys()) {
            this.deployed.set(contract, true);
        }

        this.pendingDeployments.clear();
    }

    public pushAllTempStatesToGlobal(): void {
        StateHandler.markAllPendingDeploymentsAsDone();

        for (const [contract, tempState] of this.instancesTemporaryStates.entries()) {
            if (!tempState.size) {
                continue;
            }

            const globalState = this.states.get(contract);
            if (globalState) {
                globalState.addAll(tempState);
            } else {
                this.states.set(contract, new FastMap<bigint, bigint>(tempState));
            }

            tempState.clear();
        }

        this.instancesTemporaryStates.clear();
    }

    public getTemporaryStates(contract: Address): FastMap<bigint, bigint> {
        const state = this.instancesTemporaryStates.get(contract);
        if (state) {
            return state;
        }

        // If no temporary state exists, create a new one
        const newState = new FastMap<bigint, bigint>();
        this.instancesTemporaryStates.set(contract, newState);

        return newState;
    }

    public setTemporaryStates(contract: Address, states: FastMap<bigint, bigint>): void {
        const state = this.instancesTemporaryStates.get(contract);
        if (state) {
            state.setAll(states);
        } else {
            this.instancesTemporaryStates.set(contract, new FastMap<bigint, bigint>(states));
        }
    }

    public clearTemporaryStates(contract: Address): void {
        const state = this.instancesTemporaryStates.get(contract);
        if (state) {
            state.clear();
        }

        this.instancesTemporaryStates.delete(contract);
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
        }

        this.states.delete(contract);
        this.deployed.delete(contract);
    }

    public purgeAll(): void {
        this.states.clear();
        this.instancesTemporaryStates.clear();
        this.deployed.clear();
        this.pendingDeployments.clear();
    }
}

export const StateHandler = new InternalStateHandler();

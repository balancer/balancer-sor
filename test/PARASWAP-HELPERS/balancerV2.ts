import { Interface } from '@ethersproject/abi';

type Address = string;

export class BalancerV2 {
    // We can just assume that the pools will not change frequently
    fetchingPoolQuery: { [pair: string]: Promise<void> } = {};
    poolInterfaces: { [type: string]: Interface };
    vaultInterface: Interface;

    protected constructor(
        network: number,
        protected vaultAddress: Address,
        protected subgraphURL: string
    ) {
        this.poolInterfaces = {
            Stable: new Interface(StablePoolABI),
            Weighted: new Interface(WeightedPoolABI),
            MetaStable: new Interface(MetaStablePoolABI),
        };
        this.vaultInterface = new Interface(VaultABI);
    }
}

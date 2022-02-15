import { Interface } from '@ethersproject/abi';
import { Provider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';
import { VirtualBoostedPool } from './VirtualBoostedPool';
import { StablePool } from './StablePool';
import { TokenState, PoolState, SubgraphPoolBase, Prices } from './types';
import { BZERO } from './basicOperations';
import { getPools } from './subgraph';

import StablePoolABI from '../../src/pools/stablePool/stablePoolAbi.json';
import WeightedPoolABI from '../../src/pools/weightedPool/weightedPoolAbi.json';
import MetaStablePoolABI from '../../src/pools/metaStablePool/metaStablePoolAbi.json';
import LinearPoolABI from '../../src/pools/linearPool/linearPoolAbi.json';
import VaultABI from '../../src/abi/Vault.json';

type Address = string;
type Token = string;

// Based off code shared by Paraswap. Altered to run locally.
export class BalancerV2 {
    // We can just assume that the pools will not change frequently
    fetchingPoolQuery: { [pair: string]: Promise<void> } = {};
    poolInterfaces: { [type: string]: Interface };
    vaultInterface: Interface;
    multi: Contract;
    poolMaths: { [type: string]: any };
    allPools: SubgraphPoolBase[];

    constructor(
        network: number,
        protected vaultAddress: Address,
        protected subgraphURL: string,
        protected multiAddress: string,
        protected provider: Provider
    ) {
        this.poolInterfaces = {
            Stable: new Interface(StablePoolABI),
            Weighted: new Interface(WeightedPoolABI),
            MetaStable: new Interface(MetaStablePoolABI),
            Linear: new Interface(LinearPoolABI),
        };
        this.vaultInterface = new Interface(VaultABI);
        this.multi = new Contract(
            multiAddress,
            [
                'function aggregate(tuple[](address target, bytes callData) memory calls) public view returns (uint256 blockNumber, bytes[] memory returnData)',
            ],
            this.provider
        );
        this.poolMaths = {
            Stable: new StablePool(),
            // Weighted: new WeightedPool(),
            VirtualBoosted: new VirtualBoostedPool(),
        };
    }

    async getOnChainState(
        subgraphPoolBase: SubgraphPoolBase[]
    ): Promise<{ [address: string]: PoolState }> {
        const multiCallData = subgraphPoolBase
            .map((pool) => {
                const poolCallData = [
                    {
                        target: this.vaultAddress,
                        callData: this.vaultInterface.encodeFunctionData(
                            'getPoolTokens',
                            [pool.id]
                        ),
                    },
                    {
                        target: pool.address,
                        callData: this.poolInterfaces[
                            'Weighted'
                        ].encodeFunctionData('getSwapFeePercentage'), // different function for element pool
                    },
                ];

                if (['MetaStable'].includes(pool.poolType)) {
                    poolCallData.push({
                        target: pool.address,
                        callData:
                            this.poolInterfaces[
                                'MetaStable'
                            ].encodeFunctionData('getScalingFactors'),
                    });
                }

                if (
                    [
                        'Weighted',
                        'LiquidityBootstrapping',
                        'Investment',
                    ].includes(pool.poolType)
                ) {
                    poolCallData.push({
                        target: pool.address,
                        callData: this.poolInterfaces[
                            'Weighted'
                        ].encodeFunctionData('getNormalizedWeights'),
                    });
                }
                if (['Stable', 'MetaStable'].includes(pool.poolType)) {
                    poolCallData.push({
                        target: pool.address,
                        callData: this.poolInterfaces[
                            'Stable'
                        ].encodeFunctionData('getAmplificationParameter'),
                    });
                }

                if (['VirtualBoosted'].includes(pool.poolType)) {
                    const virtualPool = new VirtualBoostedPool();
                    // Will create onchain call data for all phantomStable + linearPools associate with Virtual Pool
                    // Assumes getPoolTokens + getSwapFeePercentage call data is added separately (see above)
                    const virtualBoostedCalls = virtualPool.getOnChainCalls(
                        pool,
                        this.vaultAddress,
                        this.vaultInterface,
                        this.poolInterfaces
                    );
                    poolCallData.push(...virtualBoostedCalls);
                }
                return poolCallData;
            })
            .flat();

        const data = await this.multi.aggregate(multiCallData);

        let i = 0;
        const onChainStateMap = subgraphPoolBase.reduce(
            (acc: { [address: string]: PoolState }, pool) => {
                if (['VirtualBoosted'].includes(pool.poolType)) {
                    // This will decode multicall data for all pools associated with virtual pool
                    const virtualPool = new VirtualBoostedPool();
                    const [decoded, newIndex] = virtualPool.decodeOnChainCalls(
                        pool,
                        this.poolInterfaces,
                        this.vaultInterface,
                        data,
                        i
                    );
                    i = newIndex;
                    acc = { ...acc, ...decoded };
                    return acc;
                }

                const poolTokens = this.vaultInterface.decodeFunctionResult(
                    'getPoolTokens',
                    data.returnData[i++]
                );

                const swapFee = this.poolInterfaces[
                    'Weighted'
                ].decodeFunctionResult(
                    'getSwapFeePercentage',
                    data.returnData[i++]
                )[0];

                const scalingFactors = ['MetaStable'].includes(pool.poolType)
                    ? this.poolInterfaces['MetaStable'].decodeFunctionResult(
                          'getScalingFactors',
                          data.returnData[i++]
                      )[0]
                    : undefined;

                const normalisedWeights = [
                    'Weighted',
                    'LiquidityBootstrapping',
                    'Investment',
                ].includes(pool.poolType)
                    ? this.poolInterfaces['Weighted'].decodeFunctionResult(
                          'getNormalizedWeights',
                          data.returnData[i++]
                      )[0]
                    : undefined;

                const amp = ['Stable', 'MetaStable'].includes(pool.poolType)
                    ? this.poolInterfaces['Stable'].decodeFunctionResult(
                          'getAmplificationParameter',
                          data.returnData[i++]
                      )
                    : undefined;

                const poolState: PoolState = {
                    swapFee: BigInt(swapFee.toString()),
                    tokens: poolTokens.tokens.reduce(
                        (
                            ptAcc: { [address: string]: TokenState },
                            pt: string,
                            j: number
                        ) => {
                            const tokenState: TokenState = {
                                balance: BigInt(
                                    poolTokens.balances[j].toString()
                                ),
                            };

                            if (scalingFactors)
                                tokenState.scalingFactor = BigInt(
                                    scalingFactors[j].toString()
                                );

                            if (normalisedWeights)
                                tokenState.weight = BigInt(
                                    normalisedWeights[j].toString()
                                );

                            ptAcc[pt.toLowerCase()] = tokenState;
                            return ptAcc;
                        },
                        {}
                    ),
                };

                if (amp) {
                    poolState.amp = BigInt(amp.value.toString());
                }

                acc[pool.address.toLowerCase()] = poolState;
                return acc;
            },
            {}
        );

        return onChainStateMap;
    }

    getPricesPool(
        from: string,
        to: string,
        pool: SubgraphPoolBase,
        poolStates: { [address: string]: PoolState },
        amounts: bigint[]
        // unitVolume: bigint,
        // side: SwapSide
    ): { unit: bigint; prices: bigint[] } | null {
        switch (pool.poolType) {
            case 'VirtualBoosted': {
                const _prices = this.poolMaths[
                    'VirtualBoosted'
                ]._calcOutGivenIn(from, to, pool.address, poolStates, amounts);

                // TO DO - Add some helper method to return batchSwap for relevant path?

                return {
                    prices: _prices,
                    unit: BZERO,
                };
            }

            case 'Stable': {
                const poolState = poolStates[pool.address];
                const indexIn = pool.tokens.findIndex(
                    (t) => t.address.toLowerCase() === from.toLowerCase()
                );
                const indexOut = pool.tokens.findIndex(
                    (t) => t.address.toLowerCase() === to.toLowerCase()
                );
                const balances = pool.tokens.map(
                    (t) => poolState.tokens[t.address.toLowerCase()].balance
                );

                const scalingFactors = pool.tokens.map(
                    (t) =>
                        // BigInt(10 ** (18 - t.decimals))
                        BigInt(1e18) * BigInt(10) ** BigInt(18 - t.decimals)
                );

                const _prices = this.poolMaths['Stable'].onSell(
                    amounts,
                    balances,
                    indexIn,
                    indexOut,
                    scalingFactors,
                    poolState.swapFee,
                    poolState.amp
                );
                return {
                    unit: BZERO,
                    prices: _prices,
                };
            }
        }
        console.log('NO PRICES FOR POOL TYPE: ', pool.poolType);
        return null;
    }

    getPools(from: Token, to: Token): SubgraphPoolBase[] {
        return this.allPools
            .filter(
                (p) =>
                    p.tokens.some(
                        (token) =>
                            token.address.toLowerCase() === from.toLowerCase()
                    ) &&
                    p.tokens.some(
                        (token) =>
                            token.address.toLowerCase() === to.toLowerCase()
                    )
            )
            .slice(0, 10);
    }

    // Simplified version demonstrating possible use
    async getPricesVolume(
        from: Token,
        to: Token,
        amounts: bigint[]
        // side: SwapSide
        // routeID: number,
        // usedPools: { [poolIdentifier: string]: number } | null
    ): Promise<(Prices | null | undefined)[]> {
        // Retrieving Subgraph data here to make running locally easier
        const subgraphPools = await getPools(this.subgraphURL);
        const virtualPool = new VirtualBoostedPool();
        // getVirtualBoostedPools returns new VirtualBoostedPool types for all predefined pool, i.e. bb-a-USD
        // These pools have tokens list of main tokens, i.e. USDC/DAI,USDT
        const virtualPools = virtualPool.getVirtualBoostedPools(subgraphPools);
        const allPools = [...virtualPools, ...subgraphPools];
        this.allPools = allPools;

        // Retrieve only pools that have tokenIn and tokenOut
        const rawPools = this.getPools(from, to);

        // Here we need some additions to get onChain state for all pools associated with VirtualPool
        // Added VirtualBoostedPool helper getOnChainCalls that creates multicall data for all associated pools
        // And decodeOnChainCalls that decodes all these in correct order (without affecting other pools)
        // Added to getOnChainState in an easy way
        const poolStates = await this.getOnChainState(rawPools);

        const poolPrices = rawPools
            .map((pool: SubgraphPoolBase) => {
                if (!(pool.address.toLowerCase() in poolStates))
                    throw new Error('Unable to find the poolState');
                // TODO: re-chech what should be the current block time stamp
                try {
                    const res = this.getPricesPool(
                        from,
                        to,
                        pool,
                        poolStates,
                        amounts
                    );
                    if (!res) return;
                    return {
                        prices: res.prices,
                        data: {
                            poolId: pool.id,
                            // TO DO - Add flag indiciating this is a VirtualPool or SwapData for VirtualPool path?
                        },
                    };
                } catch (e) {
                    console.error(`Error_getPrices`);
                    return null;
                }
            })
            .filter((p) => !!p);
        return poolPrices;
    }
}

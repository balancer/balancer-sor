import { Connector } from '../connector';
import { PsWeb3Provider } from '../../web3-provider';
import { Token } from '../../../models/token';
import { SwapSide } from '../../../constants';
import { Utils } from '../../utils';
import { EXCHANGES } from '../../../models/exchange';
import { IExchange } from './../exchange';
import { Address, ExchangePrices } from '../../types';
import BigNumber from 'bignumber.js';
import { interpolate } from '../connector-utils';
import { StablePool, WeightedPool } from './balancer-v2-pool';
import RedisWrapper from '../../redis-wrapper';
import StablePoolABI from '../../abi/balancer-v2/stable-pool.abi.json';
import WeightedPoolABI from '../../abi/balancer-v2/weighted-pool.abi.json';
import MetaStablePoolABI from '../../abi/balancer-v2/meta-stable-pool.abi.json';
import VaultABI from '../../abi/balancer-v2/vault.abi.json';
import { Interface } from '@ethersproject/abi';

const logger = global.LOGGER();

const fetchAllPools = `query ($count: Int) {
  pools: pools(first: $count, orderBy: totalLiquidity, orderDirection: desc, where: {swapEnabled: true}) {
    id
    address
    poolType
    tokens {
      address
      decimals
    }
  }
}`;

type TokenState = {
    balance: bigint;
    scalingFactor?: bigint; // It includes the token priceRate
    weight?: bigint;
};

type PoolState = {
    tokens: {
        [address: string]: TokenState;
    };
    swapFee: bigint;
    amp?: bigint;
};

type SubgraphToken = {
    address: string;
    decimals: number;
};

interface SubgraphPoolBase {
    id: string;
    address: string;
    poolType: string;
    tokens: SubgraphToken[];
}

const subgraphTimeout = 1000 * 10;
const BALANCER_V2_CHUNKS = 10;
const SETUP_RETRY_TIMEOUT = 1000 * 10; //10s
const MAX_POOL_CNT = 1000; // Taken from SOR
const POOL_CACHE_TTL = 60 * 60; // 1hr

const SubgraphURL: { [network: number]: string } = {
    1: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
    137: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2',
};

type BalancerV2Data = {
    poolId: string;
};

export const VAULTADDR: { [chainId: number]: string } = {
    1: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    5: '0x65748E8287Ce4B9E6D83EE853431958851550311',
    42: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    137: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    42161: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
};

export class BalancerV2 extends Connector implements IExchange<BalancerV2Data> {
    // We can just assume that the pools will not change frequently
    allPools: SubgraphPoolBase[] = [];
    fetchingPoolQuery: { [pair: string]: Promise<void> } = {};
    // TODO: fix type
    poolMaths: { [type: string]: any };
    poolInterfaces: { [type: string]: Interface };
    vaultInterface: Interface;

    protected constructor(
        network: number,
        protected vaultAddress: Address,
        protected subgraphURL: string,
        protected exchangeKey: EXCHANGES
    ) {
        super(PsWeb3Provider.getProvider(network), 0, network);
        this.poolMaths = {
            Stable: new StablePool(),
            Weighted: new WeightedPool(),
        };
        this.poolInterfaces = {
            Stable: new Interface(StablePoolABI),
            Weighted: new Interface(WeightedPoolABI),
            MetaStable: new Interface(MetaStablePoolABI),
        };
        this.vaultInterface = new Interface(VaultABI);
    }

    protected static instance: { [nid: number]: BalancerV2 } = {};

    static getInstance(blockNumber: number, network: number): BalancerV2 {
        BalancerV2.instance[network] =
            BalancerV2.instance[network] ||
            new BalancerV2(
                network,
                VAULTADDR[network],
                SubgraphURL[network],
                EXCHANGES.BALANCERV2
            );
        BalancerV2.instance[network].blockNumber = blockNumber;
        return BalancerV2.instance[network];
    }

    async startListening() {
        try {
            const cacheKey = `${this.exchangeKey}_AllSubgraphPools_${this.network}`;

            const cachedPools = await RedisWrapper.get(cacheKey);
            if (cachedPools) {
                this.allPools = JSON.parse(cachedPools);
                logger.info(
                    `Got ${this.allPools.length} ${this.exchangeKey}_${this.network} pools from cache`
                );
                return;
            }

            logger.info(
                `Fetching ${this.exchangeKey}_${this.network} Pools from subgraph`
            );
            const variables = {
                count: MAX_POOL_CNT,
            };
            const {
                data: { data },
            } = await Utils._post(
                this.subgraphURL,
                { query: fetchAllPools, variables },
                subgraphTimeout
            );

            if (!(data && data.pools))
                throw new Error('Unable to fetch pools from the subgraph');

            RedisWrapper.setex(
                cacheKey,
                POOL_CACHE_TTL,
                JSON.stringify(data.pools)
            );
            this.allPools = data.pools;
            logger.info(
                `Got ${this.allPools.length} ${this.exchangeKey}_${this.network} pools from subgraph`
            );
        } catch (e) {
            logger.error('Error_startListening:', e);
            setTimeout(() => this.startListening(), SETUP_RETRY_TIMEOUT);
        }
    }

    getPools(from: Token, to: Token): SubgraphPoolBase[] {
        return this.allPools
            .filter(
                (p) =>
                    p.tokens.some(
                        (token) =>
                            token.address.toLowerCase() ===
                            from.address.toLowerCase()
                    ) &&
                    p.tokens.some(
                        (token) =>
                            token.address.toLowerCase() ===
                            to.address.toLowerCase()
                    )
            )
            .slice(0, 10);
    }

    allocPools(
        from: Token,
        to: Token,
        side: SwapSide,
        routeID: number,
        usedPools: { [poolIdentifier: string]: number },
        isFirstSwap: boolean
    ) {
        if (side === SwapSide.BUY) return;
        const _from = Utils.wrapETH(from, this.network);
        const _to = Utils.wrapETH(to, this.network);

        const pools = this.getPools(_from, _to);
        pools.map(({ address }) => {
            const poolIdentifier = `${
                this.exchangeKey
            }_${address.toLowerCase()}`;
            if (!(poolIdentifier in usedPools)) {
                usedPools[poolIdentifier] = routeID;
            }
        });
    }

    getPricesPool(
        from: Token,
        to: Token,
        pool: SubgraphPoolBase,
        poolState: PoolState,
        amounts: bigint[],
        unitVolume: bigint,
        side: SwapSide
    ): { unit: bigint; prices: bigint[] } | null {
        // _MAX_IN_RATIO and _MAX_OUT_RATIO is set to 30% of the pool liquidity
        const checkBalance = (balanceIn: bigint, balanceOut: bigint) =>
            ((side === SwapSide.SELL ? balanceIn : balanceOut) * BigInt(3)) /
                BigInt(10) >
            (amounts[amounts.length - 1] > unitVolume
                ? amounts[amounts.length - 1]
                : unitVolume);

        // const scaleBN = (val: string, d: number) =>
        //   BigInt(new BigNumber(val).times(10 ** d).toFixed(0));
        const _amounts = [unitVolume, ...amounts.slice(1)];

        switch (pool.poolType) {
            case 'MetaStable':
            case 'Stable': {
                const indexIn = pool.tokens.findIndex(
                    (t) =>
                        t.address.toLowerCase() === from.address.toLowerCase()
                );
                const indexOut = pool.tokens.findIndex(
                    (t) => t.address.toLowerCase() === to.address.toLowerCase()
                );
                const balances = pool.tokens.map(
                    (t) => poolState.tokens[t.address.toLowerCase()].balance
                );
                if (!checkBalance(balances[indexIn], balances[indexOut]))
                    return null;

                const scalingFactors =
                    pool.poolType === 'MetaStable'
                        ? pool.tokens.map(
                              (t) =>
                                  poolState.tokens[t.address.toLowerCase()]
                                      .scalingFactor
                          )
                        : pool.tokens.map((t) =>
                              BigInt(10 ** (18 - t.decimals))
                          );

                const _prices = this.poolMaths['Stable'].onSell(
                    _amounts,
                    balances,
                    indexIn,
                    indexOut,
                    scalingFactors,
                    poolState.swapFee,
                    poolState.amp
                );
                return {
                    unit: _prices[0],
                    prices: [BigInt(0), ..._prices.slice(1)],
                };
            }
            case 'Weighted':
            case 'LiquidityBootstrapping':
            case 'Investment': {
                const inAddress = from.address.toLowerCase();
                const outAddress = to.address.toLowerCase();

                const tokenIn = pool.tokens.find(
                    (t) => t.address.toLowerCase() === inAddress
                );
                const tokenOut = pool.tokens.find(
                    (t) => t.address.toLowerCase() === outAddress
                );

                if (!tokenIn || !tokenOut) return null;

                const tokenInBalance = poolState.tokens[inAddress].balance;
                const tokenOutBalance = poolState.tokens[outAddress].balance;
                if (!checkBalance(tokenInBalance, tokenOutBalance)) return null;

                const tokenInWeight = poolState.tokens[inAddress].weight;
                const tokenOutWeight = poolState.tokens[outAddress].weight;

                const tokenInScalingFactor = BigInt(
                    10 ** (18 - tokenIn.decimals)
                );
                const tokenOutScalingFactor = BigInt(
                    10 ** (18 - tokenOut.decimals)
                );

                const _prices = this.poolMaths['Weighted'].onSell(
                    _amounts,
                    tokenInBalance,
                    tokenOutBalance,
                    tokenInScalingFactor,
                    tokenOutScalingFactor,
                    tokenInWeight,
                    tokenOutWeight,
                    poolState.swapFee
                );
                return {
                    unit: _prices[0],
                    prices: [BigInt(0), ..._prices.slice(1)],
                };
            }
        }

        return null;
    }

    async getOnChainState(
        subgraphPoolBase: SubgraphPoolBase[]
    ): Promise<{ [address: string]: PoolState }> {
        const multiCallData = subgraphPoolBase
            .map((pool) => {
                let poolCallData = [
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
                return poolCallData;
            })
            .flat();

        const data = await this.multi.methods
            .aggregate(multiCallData)
            .call({}, this.blockNumber);

        let i = 0;
        const onChainStateMap = subgraphPoolBase.reduce(
            (acc: { [address: string]: PoolState }, pool) => {
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

                let poolState: PoolState = {
                    swapFee: BigInt(swapFee.toString()),
                    tokens: poolTokens.tokens.reduce(
                        (
                            ptAcc: { [address: string]: TokenState },
                            pt: string,
                            j: number
                        ) => {
                            let tokenState: TokenState = {
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

    async getPricesVolume(
        from: Token,
        to: Token,
        amounts: bigint[],
        side: SwapSide,
        routeID: number,
        usedPools: { [poolIdentifier: string]: number } | null
    ): Promise<null | ExchangePrices<BalancerV2Data>> {
        if (side === SwapSide.BUY) return null;
        try {
            const _from = Utils.wrapETH(from, this.network);
            const _to = Utils.wrapETH(to, this.network);

            const rawPools = this.getPools(_from, _to).filter(({ address }) => {
                const poolIdentifier = `${
                    this.exchangeKey
                }_${address.toLowerCase()}`;
                if (!usedPools || usedPools[poolIdentifier] === routeID)
                    return true;
            });
            if (!rawPools.length) return null;

            const unitVolume = BigInt(
                10 ** (side === SwapSide.SELL ? _from : _to).decimals
            );

            const quoteUnitVolume = BigInt(
                10 ** (side === SwapSide.SELL ? _to : _from).decimals
            );

            // Warning: the ethers version used is sor is not the same that we use here.
            const poolStates = await this.getOnChainState(rawPools);

            const poolPrices = rawPools
                .map((pool: SubgraphPoolBase) => {
                    if (!(pool.address.toLowerCase() in poolStates))
                        throw new Error('Unable to find the poolState');
                    // TODO: re-chech what should be the current block time stamp
                    try {
                        const res = this.getPricesPool(
                            _from,
                            _to,
                            pool,
                            poolStates[pool.address.toLowerCase()],
                            amounts,
                            unitVolume,
                            side
                        );
                        if (!res) return;
                        return {
                            unit: res.unit,
                            prices: res.prices,
                            data: {
                                poolId: pool.id,
                            },
                            poolAddresses: [pool.address.toLowerCase()],
                            exchange: this.exchangeKey,
                            gasCost: 150 * 1000,
                            poolIdentifier: `${this.exchangeKey}_${pool.address}`,
                        };
                    } catch (e) {
                        logger.error(
                            `Error_getPrices ${from.symbol || from.address}, ${
                                to.symbol || to.address
                            }, ${side}, ${pool.address}:`,
                            e
                        );
                        return null;
                    }
                })
                .filter((p) => !!p);
            return poolPrices as ExchangePrices<BalancerV2Data>;
        } catch (e) {
            logger.error(
                `Error_getPrices ${from.symbol || from.address}, ${
                    to.symbol || to.address
                }, ${side}:`,
                e
            );
            return null;
        }
    }
}

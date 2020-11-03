import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
import {
    SubGraphPool,
    SubGraphPools,
    Swap,
    PoolDictionary,
    Path,
    EffectivePrice,
    Pools,
} from './types';
import { bmul, bdiv, bnum, scale } from './bmath';
const sor = require('./index');

interface ProcessedData {
    pools: PoolDictionary;
    paths: Path[];
    epsOfInterest: EffectivePrice[];
}

interface ProcessedCache {
    [PairId: string]: ProcessedData;
}

export class SOR {
    provider: JsonRpcProvider;
    gasPrice: BigNumber;
    maxPools: number;
    chainId: number;
    // avg Balancer swap cost. Can be updated manually if required.
    swapCost: BigNumber = new BigNumber('100000');
    tokenCost = {};
    onChainCache: Pools = { pools: [] };
    poolsForPairsCache = {};
    processedDataCache = {};
    ipfs;
    isAllFetched: boolean = false;

    MULTIADDR: { [chainId: number]: string } = {
        1: '0x514053acec7177e277b947b1ebb5c08ab4c4580e',
        42: '0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210',
    };

    IPNS: { [chainId: number]: string } = {
        1: 'balancer-team-bucket.storage.fleek.co/balancer-exchange/pools',
        42: 'balancer-team-bucket.storage.fleek.co/balancer-exchange-kovan/pools',
    };

    constructor(
        Provider: JsonRpcProvider,
        GasPrice: BigNumber,
        MaxPools: number,
        ChainId: number
    ) {
        this.provider = Provider;
        this.gasPrice = GasPrice;
        this.maxPools = MaxPools;
        this.chainId = ChainId;
        this.ipfs = new sor.IPFS();
    }

    /*
    Find and cache cost of token.
    */
    async setCostOutputToken(TokenOut: string, Cost: BigNumber = null) {
        TokenOut = TokenOut.toLowerCase();

        if (Cost === null) {
            // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations
            const costOutputToken = await sor.getCostOutputToken(
                TokenOut,
                this.gasPrice,
                this.swapCost,
                this.provider,
                this.chainId
            );

            this.tokenCost[TokenOut] = costOutputToken;
        } else {
            this.tokenCost[TokenOut] = Cost;
        }
    }

    // Fetch allPools from IPFS then OnChain balances
    async fetchPools(): Promise<boolean> {
        try {
            let allPools = await this.ipfs.getAllPublicSwapPools(
                `${this.IPNS[this.chainId]}?cb=${Math.random() *
                    10000000000000000}`,
                'ipns'
            );

            let previousStringify = JSON.stringify(this.onChainCache); // Used for compare

            this.onChainCache = await this.fetchOnChainPools(allPools);

            // If new pools are different from previous then any previous processed data is out of date so clear
            if (previousStringify !== JSON.stringify(this.onChainCache)) {
                this.processedDataCache = {};
            }

            this.isAllFetched = true;

            return true;
        } catch (err) {
            this.isAllFetched = false;
            console.error(`fetchPools(): ${err.message}`);
            return false;
        }
    }

    /*
    Uses multicall contact to fetch all onchain balances for pools.
    */
    async fetchOnChainPools(SubgraphPools: SubGraphPools): Promise<Pools> {
        if (SubgraphPools.pools.length === 0) {
            console.error('ERROR: No Pools To Fetch.');
            return { pools: [] };
        }

        let onChainPools: Pools = await sor.getAllPoolDataOnChain(
            SubgraphPools,
            this.MULTIADDR[this.chainId],
            this.provider
        );

        // Error with multicall
        if (!onChainPools) return { pools: [] };

        return onChainPools;
    }

    /*
    Main function to retrieve swap information.
    */
    async getSwaps(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber
    ): Promise<[Swap[][], BigNumber]> {
        // The Subgraph returns tokens in lower case format so we must match this
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();
        let swaps, total;

        if (this.isAllFetched) {
            [swaps, total] = await this.getSwapsWithCache(
                TokenIn,
                TokenOut,
                SwapType,
                SwapAmt,
                this.onChainCache
            );
        } else {
            if (!this.poolsForPairsCache[this.createKey(TokenIn, TokenOut)])
                return [[], bnum(0)];

            [swaps, total] = await this.getSwapsWithCache(
                TokenIn,
                TokenOut,
                SwapType,
                SwapAmt,
                this.poolsForPairsCache[this.createKey(TokenIn, TokenOut)],
                false
            );
        }

        return [swaps, total];
    }

    async getSwapsWithCache(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        OnChainPools: Pools,
        UserProcessCache: boolean = true
    ): Promise<[Swap[][], BigNumber]> {
        if (OnChainPools.pools.length === 0) return [[], bnum(0)];

        let pools: PoolDictionary,
            paths: Path[],
            epsOfInterest: EffectivePrice[];
        // If token pair has been processed before use that info to speed up execution
        let cache = this.processedDataCache[`${TokenIn}${TokenOut}${SwapType}`];

        if (!UserProcessCache || !cache) {
            // If not previously cached we must process all paths/prices.

            // Always use onChain info
            // Some functions alter pools list directly but we want to keep original so make a copy to work from
            let poolsList = JSON.parse(JSON.stringify(OnChainPools));

            // Retrieves all pools that contain both tokenIn & tokenOut, i.e. pools that can be used for direct swaps
            // Retrieves intermediate pools along with tokens that are contained in these.
            // let directPools, hopTokens, poolsTokenIn, poolsTokenOut;
            let directPools: PoolDictionary,
                hopTokens: string[],
                poolsTokenIn: PoolDictionary,
                poolsTokenOut: PoolDictionary;
            [
                directPools,
                hopTokens,
                poolsTokenIn,
                poolsTokenOut,
            ] = sor.filterPools(poolsList.pools, TokenIn, TokenOut);

            let pathData: Path[];
            [pools, pathData] = this.processPairPools(
                TokenIn,
                TokenOut,
                poolsTokenIn,
                poolsTokenOut,
                directPools,
                hopTokens
            );

            // Finds sorted price & slippage information for paths for SwapType
            paths = sor.processPaths(pathData, pools, SwapType);
            epsOfInterest = sor.processEpsOfInterestMultiHop(
                paths,
                SwapType,
                this.maxPools
            );

            if (UserProcessCache)
                this.processedDataCache[`${TokenIn}${TokenOut}${SwapType}`] = {
                    pools: pools,
                    paths: paths,
                    epsOfInterest: epsOfInterest,
                };
        } else {
            // Using pre-processed data
            pools = cache.pools;
            paths = cache.paths;
            epsOfInterest = cache.epsOfInterest;
        }

        // Use previously stored value if exists else default to 0
        let costOutputToken = this.tokenCost[TokenOut];
        if (costOutputToken === undefined) {
            costOutputToken = new BigNumber(0);
        }

        // Returns list of swaps
        // swapExactIn - total = total amount swap will return of TokenOut
        // swapExactOut - total = total amount of TokenIn required for swap
        let swaps, total;
        [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            SwapType,
            SwapAmt,
            this.maxPools,
            costOutputToken,
            epsOfInterest
        );

        return [swaps, total];
    }

    async fetchFilteredPairPools(TokenIn: string, TokenOut: string) {
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();

        // Get all IPFS pools (with balance)
        let allPoolsNonBig = await this.ipfs.getAllPublicSwapPools(
            `${this.IPNS[this.chainId]}?cb=${Math.random() *
                10000000000000000}`,
            'ipns'
        );

        // Convert to BigNumber format
        let allPools = await this.ipfs.getAllPublicSwapPoolsBigNumber(
            allPoolsNonBig
        );

        let decimalsIn = 0;
        let decimalsOut = 0;

        // Find token decimals for scaling
        for (let i = 0; i < allPools.pools.length; i++) {
            for (let j = 0; j < allPools.pools[i].tokens.length; j++) {
                if (allPools.pools[i].tokens[j].address === TokenIn) {
                    decimalsIn = Number(allPools.pools[i].tokens[j].decimals);
                    if (decimalsIn > 0 && decimalsOut > 0) break;
                } else if (allPools.pools[i].tokens[j].address === TokenOut) {
                    decimalsOut = Number(allPools.pools[i].tokens[j].decimals);
                    if (decimalsIn > 0 && decimalsOut > 0) break;
                }
            }

            if (decimalsIn > 0 && decimalsOut > 0) break;
        }

        // Retrieves all pools that contain both tokenIn & tokenOut, i.e. pools that can be used for direct swaps
        // Retrieves intermediate pools along with tokens that are contained in these.
        // These are common for both swap types
        let directPools: PoolDictionary,
            hopTokens: string[],
            poolsTokenIn: PoolDictionary,
            poolsTokenOut: PoolDictionary;
        [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
            allPools.pools,
            TokenIn,
            TokenOut
        );

        // These can be shared for both swap Types
        let pools: PoolDictionary, pathData: Path[];
        [pools, pathData] = this.processPairPools(
            TokenIn,
            TokenOut,
            poolsTokenIn,
            poolsTokenOut,
            directPools,
            hopTokens
        );

        // Finds sorted price & slippage information for paths for SwapType
        const pathsExactIn: Path[] = sor.processPaths(
            JSON.parse(JSON.stringify(pathData)),
            pools,
            'swapExactIn'
        );
        const epsExactIn: EffectivePrice[] = sor.processEpsOfInterestMultiHop(
            pathsExactIn,
            'swapExactIn',
            this.maxPools
        );

        const pathsExactOut: Path[] = sor.processPaths(
            pathData,
            pools,
            'swapExactOut'
        );
        const epsExactOut: EffectivePrice[] = sor.processEpsOfInterestMultiHop(
            pathsExactOut,
            'swapExactOut',
            this.maxPools
        );

        // Use previously stored value if exists else default to 0
        let costOutputToken = this.tokenCost[TokenOut];
        if (costOutputToken === undefined) {
            costOutputToken = new BigNumber(0);
        }

        let allSwaps = [];

        let range = [
            bnum('0.01'),
            bnum('0.1'),
            bnum('1'),
            bnum('10'),
            bnum('100'),
            bnum('1000'),
        ];

        range.forEach(amt => {
            let amtIn = scale(amt, decimalsIn);
            let amtOut = amtIn;
            if (decimalsIn !== decimalsOut) amtOut = scale(amt, decimalsOut);

            let swaps, total;
            [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
                JSON.parse(JSON.stringify(pools)), // Need to keep original pools
                pathsExactIn,
                'swapExactIn',
                amtIn,
                this.maxPools,
                costOutputToken,
                epsExactIn
            );

            allSwaps.push(swaps);
            [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
                JSON.parse(JSON.stringify(pools)), // Need to keep original pools
                pathsExactOut,
                'swapExactOut',
                amtOut,
                this.maxPools,
                costOutputToken,
                epsExactOut
            );

            allSwaps.push(swaps);
        });

        // List of unique pool addresses
        let filteredPools: string[] = [];
        // get swap pools
        allSwaps.forEach(swap => {
            swap.forEach(seq => {
                seq.forEach(p => {
                    if (!filteredPools.includes(p.pool))
                        filteredPools.push(p.pool);
                });
            });
        });

        // Get list of pool infos for pools of interest
        let poolsOfInterest: SubGraphPool[] = [];
        for (let i = 0; i < allPoolsNonBig.pools.length; i++) {
            let index = filteredPools.indexOf(allPoolsNonBig.pools[i].id);
            if (index > -1) {
                filteredPools.splice(index, 1);
                poolsOfInterest.push(allPoolsNonBig.pools[i]);
                if (filteredPools.length === 0) break;
            }
        }

        let onChainPools: Pools = await sor.getAllPoolDataOnChain(
            { pools: poolsOfInterest },
            this.MULTIADDR[this.chainId],
            this.provider
        );

        this.poolsForPairsCache[
            this.createKey(TokenIn, TokenOut)
        ] = onChainPools;
    }

    processPairPools(
        TokenIn: string,
        TokenOut: string,
        PoolsTokenIn: PoolDictionary,
        PoolsTokenOut: PoolDictionary,
        DirectPools: PoolDictionary,
        HopTokens: string[]
    ): [PoolDictionary, Path[]] {
        // Sort intermediate pools by order of liquidity
        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
        ] = sor.sortPoolsMostLiquid(
            TokenIn,
            TokenOut,
            HopTokens,
            PoolsTokenIn,
            PoolsTokenOut
        );

        // Finds the possible paths to make the swap
        let pathData: Path[];
        let pools: PoolDictionary;
        [pools, pathData] = sor.parsePoolData(
            DirectPools,
            TokenIn,
            TokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            HopTokens
        );

        return [pools, pathData];
    }

    private createKey(Token1: string, Token2: string): string {
        return Token1 < Token2 ? `${Token1}${Token2}` : `${Token2}${Token1}`;
    }

    hasDataForPair(TokenIn: string, TokenOut: string): boolean {
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();

        if (
            this.isAllFetched ||
            this.poolsForPairsCache[this.createKey(TokenIn, TokenOut)]
        )
            return true;
        else return false;
    }
}

import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
import {
    SubGraphPools,
    SubGraphPool,
    Swap,
    PoolDictionary,
    Path,
    EffectivePrice,
    Pools,
} from './types';
const sor = require('./index');

interface ProcessedData {
    pools: PoolDictionary;
    paths: Path[];
    epsOfInterest: EffectivePrice[];
}

interface ProcessedCache {
    [PairId: string]: ProcessedData;
}

interface FetchedTokens {
    [Token: string]: boolean;
}

export class SOR {
    provider: JsonRpcProvider;
    gasPrice: BigNumber;
    maxPools: number;
    chainId: number;
    // Default multi address for mainnet
    multicallAddress: string = '0x514053acec7177e277b947b1ebb5c08ab4c4580e';
    // avg Balancer swap cost. Can be updated manually if required.
    swapCost: BigNumber = new BigNumber('100000');
    tokenCost = {};
    fetchedTokens: FetchedTokens = {};
    subgraphCache: SubGraphPools = { pools: [] };
    onChainCache: Pools = { pools: [] };
    processedCache = {};

    MULTIADDR: { [chainId: number]: string } = {
        1: '0xF700478148B84E572A447d63b29fD937Fd511147',
        42: '0x9907109e5Ca97aE76f684407318D1B8ea119c83B',
    };
    // 0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210 - Balances only

    SUBGRAPH_URL: { [chainId: number]: string } = {
        1: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer',
        42: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan',
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
    }

    /*
    Uses multicall contact to fetch all onchain balances for cached Subgraph pools.
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

    async fetchPairPools(
        TokenIn: string,
        TokenOut: string,
        purgeCache: boolean = true
    ): Promise<boolean> {
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();

        if (purgeCache) {
            this.purgeCaches();
            return await this.fetchNewPools(TokenIn, TokenOut);
        } else if (
            this.fetchedTokens[TokenIn] &&
            this.fetchedTokens[TokenOut]
        ) {
            return true;
        } else if (
            !this.fetchedTokens[TokenIn] &&
            !this.fetchedTokens[TokenOut]
        ) {
            return await this.fetchNewPools(TokenIn, TokenOut);
        } else if (!this.fetchedTokens[TokenIn]) {
            return await this.updatePools(TokenIn);
        } else if (!this.fetchedTokens[TokenOut]) {
            return await this.updatePools(TokenOut);
        }

        return false;
    }

    hasPairPools(TokenIn, TokenOut): boolean {
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();

        if (this.fetchedTokens[TokenIn] && this.fetchedTokens[TokenOut])
            return true;
        else return false;
    }

    // Updates onChain balances for all pools in existing cache
    async updateOnChainBalances(): Promise<boolean> {
        try {
            this.onChainCache = await this.fetchOnChainPools(
                this.subgraphCache
            );
            return true;
        } catch (err) {
            console.error(`updateOnChainBalances(): ${err.message}`);
            return false;
        }
    }

    // Fetches pools that contain TokenIn, TokenOut or both (Subgraph & Onchain)
    private async fetchNewPools(
        TokenIn: string,
        TokenOut: string
    ): Promise<boolean> {
        try {
            this.subgraphCache = await sor.getFilteredPools(
                TokenIn,
                TokenOut,
                this.SUBGRAPH_URL[this.chainId]
            );
            this.onChainCache = await this.fetchOnChainPools(
                this.subgraphCache
            );
            this.fetchedTokens[TokenIn] = true;
            this.fetchedTokens[TokenOut] = true;
            return true;
        } catch (err) {
            this.fetchedTokens[TokenIn] = false;
            this.fetchedTokens[TokenOut] = false;
            console.error(`Issue Fetching New Pools: ${TokenIn} ${TokenOut}`);
            console.error(err.message);
            return false;
        }
    }

    // Adds any pools that contain token and don't already exist to cache (Subgraph & Onchain)
    private async updatePools(Token: string): Promise<boolean> {
        try {
            console.time('SG');
            let poolsWithToken: SubGraphPools = await sor.getPoolsWithToken(
                Token
            );
            console.timeEnd('SG');

            console.time('FILTER');
            let newPools: SubGraphPool[] = poolsWithToken.pools.filter(pool => {
                return !this.subgraphCache.pools.some(
                    existingPool => existingPool.id === pool.id
                );
            });
            console.timeEnd('FILTER');
            console.log(`New Pool Length: ${newPools.length}`);

            console.time('OC');
            if (newPools.length > 0) {
                let newOnChain = await this.fetchOnChainPools({
                    pools: newPools,
                });
                this.subgraphCache.pools = this.subgraphCache.pools.concat(
                    newPools
                );
                this.onChainCache.pools = this.onChainCache.pools.concat(
                    newOnChain.pools
                );
            }
            console.timeEnd('OC');
            this.fetchedTokens[Token] = true;
            return true;
        } catch (err) {
            this.fetchedTokens[Token] = false;
            console.error(`Issue Updating Pools: ${Token}`);
            console.error(err.message);
            return false;
        }
    }

    purgeCaches() {
        this.fetchedTokens = {};
        this.subgraphCache = { pools: [] };
        this.onChainCache = { pools: [] };
    }
}

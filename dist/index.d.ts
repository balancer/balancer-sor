import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { Provider } from '@ethersproject/providers';
import { BigNumber as BigNumber$1 } from 'bignumber.js';
import { Contract } from '@ethersproject/contracts';

declare type NoNullableField<T> = {
    [P in keyof T]: NonNullable<T[P]>;
};
declare enum SwapTypes {
    SwapExactIn = 0,
    SwapExactOut = 1,
}
declare enum PoolTypes {
    Weighted = 0,
    Stable = 1,
    Element = 2,
    MetaStable = 3,
    Linear = 4,
}
declare enum SwapPairType {
    Direct = 0,
    HopIn = 1,
    HopOut = 2,
}
interface SwapOptions {
    gasPrice: BigNumber;
    swapGas: BigNumber;
    timestamp: number;
    maxPools: number;
    poolTypeFilter: PoolFilter;
    forceRefresh: boolean;
}
declare type PoolPairBase = {
    id: string;
    address: string;
    poolType: PoolTypes;
    swapFee: BigNumber;
    tokenIn: string;
    tokenOut: string;
    decimalsIn: number;
    decimalsOut: number;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
};
interface Swap {
    pool: string;
    tokenIn: string;
    tokenOut: string;
    swapAmount?: string;
    limitReturnAmount?: string;
    maxPrice?: string;
    tokenInDecimals: number;
    tokenOutDecimals: number;
}
interface SubgraphPoolBase {
    id: string;
    address: string;
    poolType: string;
    swapFee: string;
    swapEnabled: boolean;
    totalShares: string;
    tokens: SubgraphToken[];
    tokensList: string[];
    priceRateProviders?: [
        {
            address: string;
            token: {
                address: string;
            };
        }
    ];
    totalWeight?: string;
    amp?: string;
    expiryTime?: number;
    unitSeconds?: number;
    principalToken?: string;
    baseToken?: string;
    mainIndex?: number;
    wrappedIndex?: number;
    lowerTarget?: string;
    upperTarget?: string;
}
declare type SubgraphToken = {
    address: string;
    balance: string;
    decimals: number;
    priceRate: string;
    weight: string | null;
};
interface SwapV2 {
    poolId: string;
    assetInIndex: number;
    assetOutIndex: number;
    amount: string;
    userData: string;
}
interface SwapInfo {
    tokenAddresses: string[];
    swaps: SwapV2[];
    swapAmount: BigNumber;
    swapAmountForSwaps?: BigNumber;
    returnAmount: BigNumber;
    returnAmountFromSwaps?: BigNumber;
    returnAmountConsideringFees: BigNumber;
    tokenIn: string;
    tokenOut: string;
    marketSp: string;
}
interface PoolDictionary {
    [poolId: string]: PoolBase;
}
interface PoolPairDictionary {
    [tokenInOut: string]: PoolPairBase;
}
interface NewPath {
    id: string;
    swaps: Swap[];
    poolPairData: PoolPairBase[];
    limitAmount: BigNumber;
    pools: PoolBase[];
    filterEffectivePrice?: BigNumber$1;
}
declare enum PoolFilter {
    All = 'All',
    Weighted = 'Weighted',
    Stable = 'Stable',
    MetaStable = 'MetaStable',
    LBP = 'LiquidityBootstrapping',
}
interface PoolBase {
    poolType: PoolTypes;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    tokensList: string[];
    mainIndex?: number;
    setTypeForSwap: (type: SwapPairType) => void;
    parsePoolPairData: (tokenIn: string, tokenOut: string) => PoolPairBase;
    getNormalizedLiquidity: (poolPairData: PoolPairBase) => BigNumber$1;
    getLimitAmountSwap: (
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ) => BigNumber$1;
    updateTokenBalanceForPool: (token: string, newBalance: BigNumber) => void;
    _exactTokenInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber$1,
        exact: boolean
    ) => BigNumber$1;
    _tokenInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber$1,
        exact: boolean
    ) => BigNumber$1;
    _spotPriceAfterSwapExactTokenInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber$1
    ) => BigNumber$1;
    _spotPriceAfterSwapTokenInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber$1
    ) => BigNumber$1;
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber$1
    ) => BigNumber$1;
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber$1
    ) => BigNumber$1;
}
interface WeightedPool extends PoolBase {
    totalWeight: string;
}

declare class PoolCacher {
    private provider;
    private chainId;
    private poolsUrl;
    private pools;
    finishedFetchingOnChain: boolean;
    constructor(
        provider: Provider,
        chainId: number,
        poolsUrl?: string | null,
        initialPools?: SubgraphPoolBase[]
    );
    getPools(): SubgraphPoolBase[];
    isConnectedToSubgraph(): boolean;
    fetchPools(
        poolsData?: SubgraphPoolBase[],
        isOnChain?: boolean
    ): Promise<boolean>;
    private fetchOnChainBalances;
}

declare class SwapCostCalculator {
    private chainId;
    private tokenPriceCache;
    private initializeCache;
    constructor(chainId: number);
    /**
     * Sets the chain ID to be used when querying asset prices
     * @param chainId - the chain ID of the chain to switch to
     */
    setChainId(chainId: number): void;
    /**
     * @param tokenAddress - the address of the token for which to express the native asset in terms of
     */
    getNativeAssetPriceInToken(tokenAddress: string): Promise<string>;
    /**
     * @param tokenAddress - the address of the token for which to express the native asset in terms of
     * @param tokenPrice - the price of the native asset in terms of the provided token
     */
    setNativeAssetPriceInToken(tokenAddress: string, tokenPrice: string): void;
    /**
     * Calculate the cost of spending a certain amount of gas in terms of a token.
     * This allows us to determine whether an increased amount of tokens gained
     * is worth spending this extra gas (e.g. by including an extra pool in a swap)
     */
    convertGasCostToToken(
        tokenAddress: string,
        tokenDecimals: number,
        gasPriceWei: BigNumber,
        swapGas?: BigNumber
    ): Promise<BigNumber>;
}

declare class SOR {
    provider: Provider;
    chainId: number;
    poolCacher: PoolCacher;
    private routeProposer;
    swapCostCalculator: SwapCostCalculator;
    private readonly defaultSwapOptions;
    constructor(
        provider: Provider,
        chainId: number,
        poolsSource: string | null,
        initialPools?: SubgraphPoolBase[]
    );
    getPools(): SubgraphPoolBase[];
    fetchPools(
        poolsData?: SubgraphPoolBase[],
        isOnChain?: boolean
    ): Promise<boolean>;
    getSwaps(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        swapAmount: BigNumberish,
        swapOptions?: Partial<SwapOptions>
    ): Promise<SwapInfo>;
    getCostOfSwapInToken(
        outputToken: string,
        outputTokenDecimals: number,
        gasPrice: BigNumber,
        swapGas?: BigNumber
    ): Promise<BigNumber>;
    private processSwaps;
    /**
     * Find optimal routes for trade from given candidate paths
     */
    private getBestPaths;
}

declare function BPTForTokensZeroPriceImpact$2(
    balances: BigNumberish[],
    decimals: number[],
    normalizedWeights: BigNumberish[],
    amounts: BigNumberish[],
    bptTotalSupply: BigNumberish
): BigNumber;

declare function BPTForTokensZeroPriceImpact$1(
    allBalances: BigNumberish[],
    decimals: number[],
    amounts: BigNumberish[], // This has to have the same lenght as allBalances
    bptTotalSupply: BigNumberish,
    amp: BigNumberish
): BigNumber;

declare function BPTForTokensZeroPriceImpact(
    allBalances: BigNumberish[], // assuming that BPT balance was removed
    decimals: number[], // This should be [18, 18, 18]
    amounts: BigNumberish[], // This has to have the same length as allBalances
    virtualBptSupply: BigNumberish,
    amp: BigNumberish,
    fee: BigNumberish,
    rates: BigNumberish[]
): BigNumber;

declare function queryBatchSwapTokensIn(
    sor: SOR,
    vaultContract: Contract,
    tokensIn: string[],
    amountsIn: BigNumberish[],
    tokenOut: string
): Promise<{
    amountTokenOut: string;
    swaps: SwapV2[];
    assets: string[];
}>;
declare function queryBatchSwapTokensOut(
    sor: SOR,
    vaultContract: Contract,
    tokenIn: string,
    amountsIn: BigNumberish[],
    tokensOut: string[]
): Promise<{
    amountTokensOut: string[];
    swaps: SwapV2[];
    assets: string[];
}>;

declare function parseToPoolsDict(
    pools: SubgraphPoolBase[],
    timestamp: number
): PoolDictionary;

export {
    NewPath,
    NoNullableField,
    PoolBase,
    PoolDictionary,
    PoolFilter,
    PoolPairBase,
    PoolPairDictionary,
    PoolTypes,
    SOR,
    SubgraphPoolBase,
    SubgraphToken,
    Swap,
    SwapInfo,
    SwapOptions,
    SwapPairType,
    SwapTypes,
    SwapV2,
    WeightedPool,
    parseToPoolsDict,
    BPTForTokensZeroPriceImpact as phantomStableBPTForTokensZeroPriceImpact,
    queryBatchSwapTokensIn,
    queryBatchSwapTokensOut,
    BPTForTokensZeroPriceImpact$1 as stableBPTForTokensZeroPriceImpact,
    BPTForTokensZeroPriceImpact$2 as weightedBPTForTokensZeroPriceImpact,
};

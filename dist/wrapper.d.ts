import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
export declare class SOR {
    isSubgraphFetched: boolean;
    isOnChainFetched: boolean;
    subgraphPools: any;
    subgraphPoolsFormatted: any;
    onChainPools: any;
    provider: JsonRpcProvider;
    multicallAddress: String;
    gasPrice: BigNumber;
    swapCost: BigNumber;
    tokenCost: any;
    constructor(Provider: JsonRpcProvider, GasPrice: BigNumber);
    fetchSubgraphPools(): Promise<void>;
    fetchOnChainPools(): Promise<void>;
    setCostOutputToken(TokenOut: string, Cost?: BigNumber): Promise<void>;
    getSwaps(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        NoPools: Number,
        CheckOnChain?: boolean
    ): Promise<any[]>;
}

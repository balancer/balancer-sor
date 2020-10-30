import { ethers } from 'ethers';
import { BigNumber } from './utils/bignumber';
export declare function getAddress(tokenA: string, tokenB: string): string;
export declare function getOnChainReserves(
    PairAddr: string,
    provider: ethers.providers.Web3Provider
): Promise<any[]>;
export declare function getTokenWeiPrice(
    TokenAddr: string,
    provider: ethers.providers.Web3Provider
): Promise<BigNumber>;
export declare function calculateTotalSwapCost(
    TokenPrice: BigNumber,
    SwapCost: BigNumber,
    GasPriceWei: BigNumber
): BigNumber;
export declare function getCostOutputToken(
    TokenAddr: string,
    GasPriceWei: BigNumber,
    SwapGasCost: BigNumber,
    Provider: ethers.providers.Web3Provider,
    ChainId?: number
): Promise<BigNumber>;

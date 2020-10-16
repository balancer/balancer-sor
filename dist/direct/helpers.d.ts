import { BigNumber } from '../utils/bignumber';
import { Pool } from './types';
export declare function getLimitAmountSwap(
    balancer: Pool,
    swapType: string
): BigNumber;
export declare function getSpotPrice(balancer: Pool): BigNumber;
export declare function getSlippageLinearizedSpotPriceAfterSwap(
    balancer: Pool,
    swapType: string
): BigNumber;
export declare function getSlippageLinearizedEffectivePriceSwap(
    balancer: Pool,
    swapType: string
): BigNumber;
export declare function getLinearizedOutputAmountSwap(
    balancer: Pool,
    swapType: string,
    amount: BigNumber
): BigNumber;

import { BigNumber } from '../../utils/bignumber';
export declare function _exactTokenInForTokenOut(
    amount: any,
    poolPairData: any
): any;
export declare function _tokenInForExactTokenOut(
    amount: any,
    poolPairData: any
): any;
export declare function _spotPriceAfterSwapExactTokenInForTokenOut(
    amount: any,
    poolPairData: any
): BigNumber;
export declare function _spotPriceAfterSwapTokenInForExactTokenOut(
    amount: any,
    poolPairData: any
): BigNumber;
export declare function _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
    amount: any,
    poolPairData: any
): BigNumber;
export declare function _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
    amount: any,
    poolPairData: any
): BigNumber;

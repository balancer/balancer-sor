import { BigNumber } from '../../utils/bignumber';
import { ElementPoolPairData } from './elementPool';
export declare function _exactTokenInForTokenOut(amount: BigNumber, poolPairData: ElementPoolPairData): BigNumber;
export declare function _tokenInForExactTokenOut(amount: BigNumber, poolPairData: ElementPoolPairData): BigNumber;
export declare function _spotPriceAfterSwapExactTokenInForTokenOut(amount: BigNumber, poolPairData: ElementPoolPairData): BigNumber;
export declare function _spotPriceAfterSwapTokenInForExactTokenOut(amount: BigNumber, poolPairData: ElementPoolPairData): BigNumber;
export declare function _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(amount: BigNumber, poolPairData: ElementPoolPairData): BigNumber;
export declare function _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(amount: BigNumber, poolPairData: ElementPoolPairData): BigNumber;
export declare function getTimeTillExpiry(expiryTime: number, currentBlockTimestamp: number, unitSeconds: number): number;

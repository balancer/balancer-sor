import { BigNumber as OldBigNumber, bnum } from '../../utils/bignumber';
import { FxPoolPairData } from './fxPool';
import { BigNumber } from '@ethersproject/bignumber';
import { ONE as ONE_ETH } from '../../utils/basicOperations';
import { safeParseFixed } from '../../utils';

// Constants
export const CURVEMATH_MAX_DIFF = bnum('-0.000001000000000000024');
export const ONE_TO_THE_THIRTEEN_NUM = bnum('10000000000000');
const CURVEMATH_MAX = bnum('0.25'); //CURVEMATH MAX from contract

export enum CurveMathRevert {
    LowerHalt = 'CurveMath/lower-halt',
    UpperHalt = 'CurveMath/upper-halt',
    SwapInvariantViolation = 'CurveMath/swap-invariant-violation',
    SwapConvergenceFailed = 'CurveMath/swap-convergence-failed',
    CannotSwap = 'CannotSwap',
}

interface ParsedFxPoolData {
    alpha: OldBigNumber;
    beta: OldBigNumber;
    delta: OldBigNumber;
    epsilon: OldBigNumber;
    lambda: OldBigNumber;
    baseTokenRate: OldBigNumber;
    _oGLiq: OldBigNumber;
    _nGLiq: OldBigNumber;
    _oBals: OldBigNumber[];
    _nBals: OldBigNumber[];
    givenAmountInNumeraire: OldBigNumber;
}

interface ReservesInNumeraire {
    tokenInReservesInNumeraire: OldBigNumber;
    tokenOutReservesInNumeraire: OldBigNumber;
    _oGLiq: OldBigNumber;
}

const isUSDC = (address: string) => {
    if (
        address == '0x2791bca1f2de4661ed88a30c99a7a9449aa84174' ||
        address == '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    ) {
        return true;
    } else {
        return false;
    }
};

const calculateGivenAmountInNumeraire = (
    isOriginSwap: boolean,
    poolPairData: FxPoolPairData,
    amount: OldBigNumber
) => {
    let calculatedNumeraireAmount;

    if (isOriginSwap) {
        // tokenIn is given
        calculatedNumeraireAmount = viewNumeraireAmount(
            amount.times(bnum(10).pow(poolPairData.decimalsIn)),
            poolPairData.decimalsIn,
            poolPairData.tokenInLatestFXPrice,
            poolPairData.tokenInfxOracleDecimals
        );
    } else {
        // tokenOut is given
        calculatedNumeraireAmount = viewNumeraireAmount(
            amount.times(bnum(10).pow(poolPairData.decimalsOut)),
            poolPairData.decimalsOut,
            poolPairData.tokenOutLatestFXPrice,
            poolPairData.tokenOutfxOracleDecimals
        );
    }

    return calculatedNumeraireAmount;
};

/**
 * Convert from an Ethersjs BigNumber to a bignumber.js BigNumber
 * @param amount BigNumber
 * @returns OldBigNumber
 */
const EthersBNToOldBn = (amount: BigNumber): OldBigNumber => {
    return bnum(amount.toString());
};

export const poolBalancesToNumeraire = (
    poolPairData: FxPoolPairData
): ReservesInNumeraire => {
    let tokenInNumeraire, tokenOutNumeraire;

    if (isUSDC(poolPairData.tokenIn)) {
        // amount * rate / 10^poolPairData.decimalsIn -> rate: (_rate / 10^fxOracleDecimals)
        // _amount.mul(_rate).div(basefxOracleDecimals).divu(baseDecimals);
        tokenInNumeraire = viewNumeraireAmount(
            EthersBNToOldBn(poolPairData.balanceIn),
            poolPairData.decimalsIn,
            poolPairData.tokenInLatestFXPrice,
            poolPairData.tokenInfxOracleDecimals
        );
        tokenOutNumeraire = viewNumeraireAmount(
            EthersBNToOldBn(poolPairData.balanceOut),
            poolPairData.decimalsOut,
            poolPairData.tokenOutLatestFXPrice,
            poolPairData.tokenOutfxOracleDecimals
        );
    } else {
        tokenInNumeraire = viewNumeraireAmount(
            EthersBNToOldBn(poolPairData.balanceOut),
            poolPairData.decimalsOut,
            poolPairData.tokenOutLatestFXPrice,
            poolPairData.tokenOutfxOracleDecimals
        );

        tokenOutNumeraire = viewNumeraireAmount(
            EthersBNToOldBn(poolPairData.balanceIn),
            poolPairData.decimalsIn,
            poolPairData.tokenInLatestFXPrice,
            poolPairData.tokenInfxOracleDecimals
        );
    }

    return {
        tokenInReservesInNumeraire: tokenInNumeraire,
        tokenOutReservesInNumeraire: tokenOutNumeraire,
        _oGLiq: tokenInNumeraire.plus(tokenOutNumeraire),
    };
};
// everything is in order of USDC, base token
const getParsedFxPoolData = (
    amount: OldBigNumber,
    poolPairData: FxPoolPairData,
    isOriginSwap: boolean
): ParsedFxPoolData => {
    // reserves are in raw amount, they converted to numeraire
    const baseReserves = isUSDC(poolPairData.tokenIn)
        ? viewNumeraireAmount(
              EthersBNToOldBn(poolPairData.balanceOut),
              poolPairData.decimalsOut,
              poolPairData.tokenOutLatestFXPrice,
              poolPairData.tokenOutfxOracleDecimals
          )
        : viewNumeraireAmount(
              EthersBNToOldBn(poolPairData.balanceIn),
              poolPairData.decimalsIn,
              poolPairData.tokenInLatestFXPrice,
              poolPairData.tokenInfxOracleDecimals
          );

    // reserves are not in wei
    const usdcReserves = isUSDC(poolPairData.tokenIn)
        ? viewNumeraireAmount(
              EthersBNToOldBn(poolPairData.balanceIn),
              poolPairData.decimalsIn,
              poolPairData.tokenInLatestFXPrice,
              poolPairData.tokenInfxOracleDecimals
          )
        : viewNumeraireAmount(
              EthersBNToOldBn(poolPairData.balanceOut),
              poolPairData.decimalsOut,
              poolPairData.tokenOutLatestFXPrice,
              poolPairData.tokenOutfxOracleDecimals
          );

    // rate is converted from chainlink to the actual rate in decimals
    const baseTokenRate = isUSDC(poolPairData.tokenIn)
        ? poolPairData.tokenOutLatestFXPrice.div(
              bnum(10).pow(poolPairData.tokenOutfxOracleDecimals)
          )
        : poolPairData.tokenInLatestFXPrice.div(
              bnum(10).pow(poolPairData.tokenInfxOracleDecimals)
          );

    // given amount in or out converted to numeraire
    const givenAmountInNumeraire = calculateGivenAmountInNumeraire(
        isOriginSwap,
        poolPairData,
        amount
    );

    return {
        alpha: poolPairData.alpha.div(bnum(10).pow(18)),
        beta: poolPairData.beta.div(bnum(10).pow(18)),
        delta: poolPairData.delta.div(bnum(10).pow(18)),
        epsilon: poolPairData.epsilon.div(bnum(10).pow(18)),
        lambda: poolPairData.lambda.div(bnum(10).pow(18)),
        baseTokenRate: baseTokenRate,
        _oGLiq: baseReserves.plus(usdcReserves),
        _nGLiq: baseReserves.plus(usdcReserves),
        _oBals: [usdcReserves, baseReserves],
        _nBals: isUSDC(poolPairData.tokenIn)
            ? [
                  usdcReserves.plus(givenAmountInNumeraire),
                  baseReserves.minus(givenAmountInNumeraire),
              ]
            : [
                  usdcReserves.minus(givenAmountInNumeraire),
                  baseReserves.plus(givenAmountInNumeraire),
              ],

        givenAmountInNumeraire: givenAmountInNumeraire,
    };
};

// Base Assimilator Functions
// calculations are from the BaseToUsdAssimilator

/**
 *
 * @param _amount in numeraire
 * @param tokenDecimals
 * @param rate in wei
 * @param fxOracleDecimals
 * @returns amount in wei
 */
export const viewRawAmount = (
    _amount: OldBigNumber, // numeraire
    tokenDecimals: number,
    rate: OldBigNumber, // wei
    fxOracleDecimals: number
): OldBigNumber => {
    // solidity code `_amount.mulu(baseDecimals).mul(baseOracleDecimals).div(_rate);

    const inAmount = BigInt(
        safeParseFixed(_amount.toString(), tokenDecimals).toString()
    );

    const val =
        (inAmount * BigInt(10 ** fxOracleDecimals) * ONE_ETH) /
        BigInt(rate.toString()) /
        ONE_ETH;

    return bnum(val.toString());
};

/**
 * @param _amount in wei
 * @param tokenDecimals
 * @param rate in wei
 * @param fxOracleDecimals
 * @returns amount in numeraire (ie. user friendly decimals)
 */
export const viewNumeraireAmount = (
    _amount: OldBigNumber, // wei
    tokenDecimals: number,
    rate: OldBigNumber, // wei
    fxOracleDecimals: number
): OldBigNumber => {
    // Solidity: _amount.mul(_rate).div(basefxOracleDecimals).divu(baseDecimals);

    const val =
        (BigInt(_amount.toString()) * BigInt(rate.toString())) /
        BigInt(10 ** fxOracleDecimals);

    return bnum(val.toString()).div(bnum(10).pow(tokenDecimals));
};

// Curve Math
// calculations are from CurveMath.sol
const calculateMicroFee = (
    _bal: OldBigNumber,
    _ideal: OldBigNumber,
    _beta: OldBigNumber,
    _delta: OldBigNumber
): OldBigNumber => {
    let _threshold, _feeMargin;
    let fee_ = bnum(0);

    if (_bal.lt(_ideal)) {
        _threshold = _ideal.times(bnum(1).minus(_beta)); // CURVEMATH ONE

        if (_bal.lt(_threshold)) {
            _feeMargin = _threshold.minus(_bal);
            fee_ = _feeMargin.div(_ideal);
            fee_ = fee_.times(_delta);

            if (fee_.gt(CURVEMATH_MAX)) {
                fee_ = CURVEMATH_MAX;
            }

            fee_ = fee_.times(_feeMargin);
        } else {
            fee_ = bnum(0);
        }
    } else {
        _threshold = _ideal.times(_beta.plus(1)); // CURVEMATH_ONE

        if (_bal.gt(_threshold)) {
            _feeMargin = _bal.minus(_threshold);

            fee_ = _feeMargin.div(_ideal);
            fee_ = fee_.times(_delta);

            if (fee_.gt(CURVEMATH_MAX)) fee_ = CURVEMATH_MAX;

            fee_ = fee_.times(_feeMargin);
        } else {
            fee_ = bnum(0);
        }
    }

    return fee_;
};

const calculateFee = (
    _gLiq: OldBigNumber,
    _bals: OldBigNumber[],
    _beta: OldBigNumber,
    _delta: OldBigNumber,
    _weights: OldBigNumber[]
): OldBigNumber => {
    const _length = _bals.length;
    let psi_ = bnum(0);

    for (let i = 0; i < _length; i++) {
        const _ideal = _gLiq.times(_weights[i]);

        // keep away from wei values like how the contract do it
        psi_ = psi_.plus(calculateMicroFee(_bals[i], _ideal, _beta, _delta));
    }

    return psi_;
};

// return outputAmount and ngliq
const calculateTrade = (
    _oGLiq: OldBigNumber,
    _nGLiq: OldBigNumber,
    _oBals: OldBigNumber[],
    _nBals: OldBigNumber[],
    _inputAmt: OldBigNumber,
    _outputIndex: number,
    poolPairData: ParsedFxPoolData
): [OldBigNumber, OldBigNumber] => {
    let outputAmt_;
    const _weights: OldBigNumber[] = [bnum('0.5'), bnum('0.5')]; // const for now since all weights are 0.5

    const alpha = poolPairData.alpha;
    const beta = poolPairData.beta;
    const delta = poolPairData.delta;
    const lambda = poolPairData.lambda;

    outputAmt_ = _inputAmt.times(-1);

    const _omega = calculateFee(_oGLiq, _oBals, beta, delta, _weights);

    let _psi: OldBigNumber;

    for (let i = 0; i < 32; i++) {
        _psi = calculateFee(_nGLiq, _nBals, beta, delta, _weights);

        const prevAmount = outputAmt_;

        outputAmt_ = _omega.lt(_psi)
            ? _inputAmt.plus(_omega.minus(_psi)).times(-1)
            : _inputAmt.plus(lambda.times(_omega.minus(_psi))).times(-1);

        if (
            outputAmt_
                .div(ONE_TO_THE_THIRTEEN_NUM)
                .eq(prevAmount.div(ONE_TO_THE_THIRTEEN_NUM))
        ) {
            _nGLiq = _oGLiq.plus(_inputAmt).plus(outputAmt_);

            _nBals[_outputIndex] = _oBals[_outputIndex].plus(outputAmt_);
            // throws error already, removed if statement
            enforceHalts(_oGLiq, _nGLiq, _oBals, _nBals, _weights, alpha);
            enforceSwapInvariant(_oGLiq, _omega, _nGLiq, _psi);
            return [outputAmt_, _nGLiq];
        } else {
            _nGLiq = _oGLiq.plus(_inputAmt).plus(outputAmt_);
            _nBals[_outputIndex] = _oBals[_outputIndex].plus(outputAmt_);
        }
    }

    throw new Error(CurveMathRevert.SwapConvergenceFailed);
};

// invariant enforcement
const enforceHalts = (
    _oGLiq: OldBigNumber,
    _nGLiq: OldBigNumber,
    _oBals: OldBigNumber[],
    _nBals: OldBigNumber[],
    _weights: OldBigNumber[],
    alpha: OldBigNumber
): boolean => {
    const _length = _nBals.length;
    const _alpha = alpha;

    for (let i = 0; i < _length; i++) {
        const _nIdeal = _nGLiq.times(_weights[i]);

        if (_nBals[i].gt(_nIdeal)) {
            const _upperAlpha = _alpha.plus(1);

            const _nHalt = _nIdeal.times(_upperAlpha);

            if (_nBals[i].gt(_nHalt)) {
                const _oHalt = _oGLiq.times(_weights[i]).times(_upperAlpha);

                if (_oBals[i].lt(_oHalt)) {
                    throw new Error(CurveMathRevert.UpperHalt);
                }
                if (_nBals[i].minus(_nHalt).gt(_oBals[i].minus(_oHalt))) {
                    throw new Error(CurveMathRevert.UpperHalt);
                }
            }
        } else {
            const _lowerAlpha = bnum(1).minus(_alpha);

            const _nHalt = _nIdeal.times(_lowerAlpha);

            if (_nBals[i].lt(_nHalt)) {
                let _oHalt = _oGLiq.times(_weights[i]);
                _oHalt = _oHalt.times(_lowerAlpha);

                if (_oBals[i].gt(_oHalt)) {
                    throw new Error(CurveMathRevert.LowerHalt);
                }
                if (_nHalt.minus(_nBals[i]).gt(_oHalt.minus(_oBals[i]))) {
                    throw new Error(CurveMathRevert.LowerHalt);
                }
            }
        }
    }
    return true;
};

const enforceSwapInvariant = (
    _oGLiq: OldBigNumber,
    _omega: OldBigNumber,
    _nGLiq: OldBigNumber,
    _psi: OldBigNumber
): boolean => {
    const _nextUtil = _nGLiq.minus(_psi);

    const _prevUtil = _oGLiq.minus(_omega);

    const _diff = _nextUtil.minus(_prevUtil);

    // from int128 private constant MAX_DIFF = -0x10C6F7A0B5EE converted to plain decimals
    if (_diff.gt(0) || _diff.gte(CURVEMATH_MAX_DIFF)) {
        return true;
    } else {
        throw new Error(CurveMathRevert.SwapInvariantViolation);
    }
};

// Exported functions

// origin swap
export function _exactTokenInForTokenOut(
    amount: OldBigNumber,
    poolPairData: FxPoolPairData
): OldBigNumber {
    const parsedFxPoolData = getParsedFxPoolData(amount, poolPairData, true);

    const targetAmountInNumeraire = parsedFxPoolData.givenAmountInNumeraire;

    if (poolPairData.tokenIn === poolPairData.tokenOut) {
        return viewRawAmount(
            targetAmountInNumeraire,
            poolPairData.decimalsIn,
            poolPairData.tokenInLatestFXPrice,
            poolPairData.tokenInfxOracleDecimals
        ).div(bnum(10).pow(poolPairData.decimalsIn)); // must be the token out
    }

    const _oGLiq = parsedFxPoolData._oGLiq;
    const _nGLiq = parsedFxPoolData._nGLiq;
    const _oBals = parsedFxPoolData._oBals;
    const _nBals = parsedFxPoolData._nBals;

    const _amt = calculateTrade(
        _oGLiq, // _oGLiq
        _nGLiq, // _nGLiq
        _oBals, // _oBals
        _nBals, // _nBals
        targetAmountInNumeraire, // input amount
        isUSDC(poolPairData.tokenIn) ? 1 : 0, // if USDC return base token (index 1), else return 0 for USDC out
        parsedFxPoolData
    );

    if (_amt === undefined) {
        throw new Error(CurveMathRevert.CannotSwap);
    } else {
        const epsilon = parsedFxPoolData.epsilon;
        const _amtWithFee = _amt[0].times(bnum(1).minus(epsilon));

        return viewRawAmount(
            _amtWithFee.abs(),
            poolPairData.decimalsOut,
            poolPairData.tokenOutLatestFXPrice,
            poolPairData.tokenOutfxOracleDecimals
        ).div(bnum(10).pow(poolPairData.decimalsOut));
    }
}

// target swap
export function _tokenInForExactTokenOut(
    amount: OldBigNumber,
    poolPairData: FxPoolPairData
): OldBigNumber {
    const parsedFxPoolData = getParsedFxPoolData(amount, poolPairData, false);
    const targetAmountInNumeraire =
        parsedFxPoolData.givenAmountInNumeraire.times(-1);

    if (poolPairData.tokenIn === poolPairData.tokenOut) {
        viewRawAmount(
            // poolPairData.tokenOut as TokenSymbol,
            targetAmountInNumeraire,
            poolPairData.decimalsOut,
            poolPairData.tokenOutLatestFXPrice,
            poolPairData.tokenOutfxOracleDecimals
        ).div(bnum(10).pow(poolPairData.decimalsOut)); // must be the token out
    }

    const _oGLiq = parsedFxPoolData._oGLiq;
    const _nGLiq = parsedFxPoolData._nGLiq;
    const _oBals = parsedFxPoolData._oBals;
    const _nBals = parsedFxPoolData._nBals;

    const _amt = calculateTrade(
        _oGLiq, // _oGLiq
        _nGLiq, // _nGLiq
        _oBals, // _oBals
        _nBals, // _nBals
        targetAmountInNumeraire,
        isUSDC(poolPairData.tokenIn) ? 0 : 1, // if USDC return 0 else return 1 for base token
        parsedFxPoolData
    );

    if (_amt === undefined) {
        throw new Error(CurveMathRevert.CannotSwap);
    } else {
        const epsilon = poolPairData.epsilon.div(bnum(10).pow(18));

        const _amtWithFee = _amt[0].times(epsilon.plus(1)); // fee retained by the pool

        return viewRawAmount(
            _amtWithFee.abs(),
            poolPairData.decimalsIn,
            poolPairData.tokenInLatestFXPrice,
            poolPairData.tokenInfxOracleDecimals
        ).div(bnum(10).pow(poolPairData.decimalsIn)); // must be the token out
    }
}

export const spotPriceBeforeSwap = (
    amount: OldBigNumber,
    poolPairData: FxPoolPairData
): OldBigNumber => {
    // input amount 1 XSGD to get the output in USDC
    const inputAmountInNumeraire = bnum(1);
    const parsedFxPoolData = getParsedFxPoolData(amount, poolPairData, true);

    const _oGLiq = parsedFxPoolData._oGLiq;
    const _nGLiq = parsedFxPoolData._nGLiq;
    const _oBals = parsedFxPoolData._oBals;
    const _nBals = parsedFxPoolData._nBals;

    const outputAmountInNumeraire = calculateTrade(
        _oGLiq, // _oGLiq
        _nGLiq, // _nGLiq
        _oBals, // _oBals
        _nBals, // _nBals
        bnum(1), // input amount
        0, // always output in USDC
        parsedFxPoolData
    );

    const val = outputAmountInNumeraire[0]
        .abs()
        .times(bnum(1).minus(parsedFxPoolData.epsilon))
        .div(inputAmountInNumeraire.abs())
        .times(parsedFxPoolData.baseTokenRate)
        .decimalPlaces(
            poolPairData.tokenOutfxOracleDecimals,
            OldBigNumber.ROUND_DOWN
        );
    return val;
};

// spot price after origin swap
export const _spotPriceAfterSwapExactTokenInForTokenOut = (
    poolPairData: FxPoolPairData,
    amount: OldBigNumber
): OldBigNumber => {
    const parsedFxPoolData = getParsedFxPoolData(amount, poolPairData, true);

    const targetAmountInNumeraire = parsedFxPoolData.givenAmountInNumeraire;

    const _oGLiq = parsedFxPoolData._oGLiq;
    const _nBals = parsedFxPoolData._nBals;
    const currentRate = parsedFxPoolData.baseTokenRate;
    const beta = parsedFxPoolData.beta;
    const epsilon = parsedFxPoolData.epsilon;
    const _nGLiq = parsedFxPoolData._nGLiq;
    const _oBals = parsedFxPoolData._oBals;

    const outputAfterTrade = calculateTrade(
        _oGLiq, // _oGLiq
        _nGLiq, // _nGLiq
        _oBals, // _oBals
        _nBals, // _nBals
        targetAmountInNumeraire, // input amount
        isUSDC(poolPairData.tokenIn) ? 1 : 0, // if USDC return base token (index 1), else return 0 for USDC out
        parsedFxPoolData
    );

    const outputAmount = outputAfterTrade[0];

    const maxBetaLimit = beta.plus(1).times('0.5').times(_oGLiq);

    const minBetaLimit = bnum(1).minus(beta).times('0.5').times(_oGLiq);

    if (isUSDC(poolPairData.tokenIn)) {
        // token[0] to token [1] in originswap
        const oBals0after = _nBals[0];

        const oBals1after = _nBals[1];

        if (oBals1after.lt(minBetaLimit) && oBals0after.gt(maxBetaLimit)) {
            // returns 0 because  Math.abs(targetAmountInNumeraire)) * currentRate
            // used that function with a 0 amount to get a market spot price for the pool
            // which is used in front end display.

            return amount.isZero()
                ? spotPriceBeforeSwap(amount, poolPairData)
                : outputAmount
                      .times(bnum(1).minus(epsilon))
                      .abs()
                      .div(targetAmountInNumeraire.abs())
                      .times(currentRate)
                      .decimalPlaces(
                          poolPairData.tokenInfxOracleDecimals,
                          OldBigNumber.ROUND_DOWN
                      );
        } else {
            return currentRate
                .times(bnum(1).minus(epsilon))
                .decimalPlaces(
                    poolPairData.tokenInfxOracleDecimals,
                    OldBigNumber.ROUND_DOWN
                );
        }
    } else {
        // if usdc is tokenOut
        //  token[1] to token [0] in originswap
        const oBals0after = _nBals[1];

        const oBals1after = _nBals[0];

        if (oBals1after.lt(minBetaLimit) && oBals0after.gt(maxBetaLimit)) {
            if (amount.isZero())
                return spotPriceBeforeSwap(amount, poolPairData);

            const ratioOfOutputAndInput = outputAmount
                .times(bnum(1).minus(epsilon))
                .abs()
                .div(targetAmountInNumeraire.abs());
            return ratioOfOutputAndInput
                .times(currentRate)
                .decimalPlaces(
                    poolPairData.tokenInfxOracleDecimals,
                    OldBigNumber.ROUND_DOWN
                );
        } else {
            return currentRate
                .times(bnum(1).minus(epsilon))
                .decimalPlaces(
                    poolPairData.tokenInfxOracleDecimals,
                    OldBigNumber.ROUND_DOWN
                );
        }
    }
};

// spot price after target swap
// the less the normalized liquidity
// we must have a absolute of the derivative price
export const _spotPriceAfterSwapTokenInForExactTokenOut = (
    poolPairData: FxPoolPairData,
    amount: OldBigNumber
): OldBigNumber => {
    const parsedFxPoolData = getParsedFxPoolData(amount, poolPairData, false);

    const targetAmountInNumeraire =
        parsedFxPoolData.givenAmountInNumeraire.times(-1);

    const _oGLiq = parsedFxPoolData._oGLiq;
    const _nBals = parsedFxPoolData._nBals;
    const currentRate = parsedFxPoolData.baseTokenRate;

    const beta = parsedFxPoolData.beta;
    const epsilon = parsedFxPoolData.epsilon;

    const _nGLiq = parsedFxPoolData._nGLiq;
    const _oBals = parsedFxPoolData._oBals;

    const outputAfterTrade = calculateTrade(
        _oGLiq, // _oGLiq
        _nGLiq, // _nGLiq
        _oBals, // _oBals
        _nBals, // _nBals
        targetAmountInNumeraire, // input amount
        isUSDC(poolPairData.tokenIn) ? 0 : 1, // if USDC return 0 else return 1 for base token
        parsedFxPoolData
    );

    const outputAmount = outputAfterTrade[0];

    const maxBetaLimit = beta.plus(1).times('0.5').times(_oGLiq);

    const minBetaLimit = bnum(1).minus(beta).times('0.5').times(_oGLiq);

    if (isUSDC(poolPairData.tokenIn)) {
        // token[0] to token [1] in originswap
        const oBals0after = _nBals[0];
        const oBals1after = _nBals[1];

        if (oBals1after.lt(minBetaLimit) && oBals0after.gt(maxBetaLimit)) {
            return targetAmountInNumeraire
                .abs()
                .div(outputAmount.times(epsilon.plus(1)).abs())
                .times(currentRate)
                .decimalPlaces(
                    poolPairData.tokenOutfxOracleDecimals,
                    OldBigNumber.ROUND_DOWN
                );
        } else {
            // rate * (1-epsilon)
            return currentRate
                .times(bnum(1).minus(epsilon))
                .decimalPlaces(
                    poolPairData.tokenOutfxOracleDecimals,
                    OldBigNumber.ROUND_DOWN
                );
        }
    } else {
        //  token[1] to token [0] in originswap
        const oBals0after = _nBals[0];
        const oBals1after = _nBals[1];

        const isBeyondMinBeta = oBals0after.lt(minBetaLimit);
        const isBeyondMaxBeta = oBals1after.gt(maxBetaLimit);

        if (isBeyondMinBeta && isBeyondMaxBeta) {
            return targetAmountInNumeraire
                .abs()
                .div(outputAmount.times(epsilon.plus(1)).abs())
                .times(currentRate)
                .decimalPlaces(
                    poolPairData.tokenOutfxOracleDecimals,
                    OldBigNumber.ROUND_DOWN
                );
        } else {
            return currentRate
                .times(bnum(1).minus(epsilon))
                .decimalPlaces(
                    poolPairData.tokenOutfxOracleDecimals,
                    OldBigNumber.ROUND_DOWN
                );
        }
    }
};

// origin swap
export const _derivativeSpotPriceAfterSwapExactTokenInForTokenOut = (
    amount: OldBigNumber,
    poolPairData: FxPoolPairData
): OldBigNumber => {
    const x = spotPriceBeforeSwap(bnum('1'), poolPairData);
    const y = _spotPriceAfterSwapExactTokenInForTokenOut(poolPairData, amount);
    const yMinusX = y.minus(x);
    const ans = yMinusX.div(x);
    // if we're outside the Beta region the derivative will be negative
    // but `UniversalNormalizedLiquidity` returns ZERO for negative values
    // therefore we want to make sure this reflects the fact that we're
    // moving outside of Beta region
    return ans.abs();
};

// target swap
export const _derivativeSpotPriceAfterSwapTokenInForExactTokenOut = (
    amount: OldBigNumber,
    poolPairData: FxPoolPairData
): OldBigNumber => {
    const x = spotPriceBeforeSwap(bnum('1'), poolPairData);
    const y = _spotPriceAfterSwapTokenInForExactTokenOut(poolPairData, amount);
    const yMinusX = y.minus(x);
    const ans = yMinusX.div(x);
    // if we're outside the Beta region the derivative will be negative
    // but `UniversalNormalizedLiquidity` returns ZERO for negative values
    // therefore we want to make sure this reflects the fact that we're
    // moving outside of Beta region
    return ans.abs();
};

import { BigNumber as OldBigNumber, bnum } from '../../utils/bignumber';
import { FxPoolPairData } from './fxPool';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { safeParseFixed } from '../../utils';

// Constants
export const ONE_36 = parseFixed('1', 36);
export const CURVEMATH_MAX_DIFF_36 = parseFixed('-0.000001000000000000024', 36);
export const ONE_TO_THE_THIRTEEN_NUM_36 = parseFixed('10000000000000', 36);
const CURVEMATH_MAX_36 = parseFixed('0.25', 36); //CURVEMATH MAX from contract

export enum CurveMathRevert {
    LowerHalt = 'CurveMath/lower-halt',
    UpperHalt = 'CurveMath/upper-halt',
    SwapInvariantViolation = 'CurveMath/swap-invariant-violation',
    SwapConvergenceFailed = 'CurveMath/swap-convergence-failed',
    CannotSwap = 'CannotSwap',
}

interface ParsedFxPoolData {
    alpha: BigNumber;
    beta: BigNumber;
    delta: BigNumber;
    epsilon: BigNumber;
    lambda: BigNumber;
    baseTokenRate: BigNumber;
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
    amount_36: BigNumber
) => {
    let calculatedNumeraireAmount;

    if (isOriginSwap) {
        // tokenIn is given
        calculatedNumeraireAmount = viewNumeraireAmount(
            safeParseFixed(amount_36.toString(), poolPairData.decimalsIn),
            poolPairData.decimalsIn,
            poolPairData.tokenInLatestFXPrice,
            poolPairData.tokenInfxOracleDecimals
        );
    } else {
        // tokenOut is given
        calculatedNumeraireAmount = viewNumeraireAmount(
            safeParseFixed(amount_36.toString(), poolPairData.decimalsOut),
            poolPairData.decimalsOut,
            poolPairData.tokenOutLatestFXPrice,
            poolPairData.tokenOutfxOracleDecimals
        );
    }

    return calculatedNumeraireAmount;
};

export const poolBalancesToNumeraire = (
    poolPairData: FxPoolPairData
): ReservesInNumeraire => {
    let tokenInNumeraire, tokenOutNumeraire;

    if (isUSDC(poolPairData.tokenIn)) {
        // amount * rate / 10^poolPairData.decimalsIn -> rate: (_rate / 10^fxOracleDecimals)
        // _amount.mul(_rate).div(basefxOracleDecimals).divu(baseDecimals);
        tokenInNumeraire = viewNumeraireAmount(
            safeParseFixed(poolPairData.balanceIn.toString(), 36),
            poolPairData.decimalsIn,
            poolPairData.tokenInLatestFXPrice,
            poolPairData.tokenInfxOracleDecimals
        );
        tokenOutNumeraire = viewNumeraireAmount(
            safeParseFixed(poolPairData.balanceOut.toString(), 36),
            poolPairData.decimalsOut,
            poolPairData.tokenOutLatestFXPrice,
            poolPairData.tokenOutfxOracleDecimals
        );
    } else {
        tokenInNumeraire = viewNumeraireAmount(
            safeParseFixed(poolPairData.balanceOut.toString(), 36),
            poolPairData.decimalsOut,
            poolPairData.tokenOutLatestFXPrice,
            poolPairData.tokenOutfxOracleDecimals
        );

        tokenOutNumeraire = viewNumeraireAmount(
            safeParseFixed(poolPairData.balanceIn.toString(), 36),
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
    amount_36: BigNumber,
    poolPairData: FxPoolPairData,
    isOriginSwap: boolean
): ParsedFxPoolData => {
    // reserves are in raw amount, they converted to numeraire
    const baseReserves = isUSDC(poolPairData.tokenIn)
        ? viewNumeraireAmount(
              safeParseFixed(poolPairData.balanceOut.toString(), 36),
              poolPairData.decimalsOut,
              poolPairData.tokenOutLatestFXPrice,
              poolPairData.tokenOutfxOracleDecimals
          )
        : viewNumeraireAmount(
              safeParseFixed(poolPairData.balanceIn.toString(), 36),
              poolPairData.decimalsIn,
              poolPairData.tokenInLatestFXPrice,
              poolPairData.tokenInfxOracleDecimals
          );

    // reserves are not in wei
    const usdcReserves = isUSDC(poolPairData.tokenIn)
        ? viewNumeraireAmount(
              safeParseFixed(poolPairData.balanceIn.toString(), 36),
              poolPairData.decimalsIn,
              poolPairData.tokenInLatestFXPrice,
              poolPairData.tokenInfxOracleDecimals
          )
        : viewNumeraireAmount(
              safeParseFixed(poolPairData.balanceOut.toString(), 36),
              poolPairData.decimalsOut,
              poolPairData.tokenOutLatestFXPrice,
              poolPairData.tokenOutfxOracleDecimals
          );

    // rate is converted from chainlink to the actual rate in decimals
    const baseTokenRate = isUSDC(poolPairData.tokenIn)
        ? poolPairData.tokenOutLatestFXPrice
              .mul(ONE_36)
              .div(
                  BigNumber.from(10).pow(poolPairData.tokenOutfxOracleDecimals)
              )
        : poolPairData.tokenInLatestFXPrice
              .mul(ONE_36)
              .div(
                  BigNumber.from(10).pow(poolPairData.tokenInfxOracleDecimals)
              );

    // given amount in or out converted to numeraire
    const givenAmountInNumeraire = calculateGivenAmountInNumeraire(
        isOriginSwap,
        poolPairData,
        amount_36
    );

    return {
        alpha: parseFixed(poolPairData.alpha.toString(), 18),
        beta: parseFixed(poolPairData.beta.toString(), 18),
        delta: parseFixed(poolPairData.delta.toString(), 18),
        epsilon: parseFixed(poolPairData.epsilon.toString(), 18),
        lambda: parseFixed(poolPairData.lambda.toString(), 18),
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
    rate: BigNumber, // wei
    fxOracleDecimals: number
): OldBigNumber => {
    // solidity code `_amount.mulu(baseDecimals).mul(baseOracleDecimals).div(_rate);

    const val = safeParseFixed(_amount.toString(), tokenDecimals)
        .mul(safeParseFixed('1', fxOracleDecimals))
        .mul(ONE_36)
        .div(safeParseFixed(rate.toString(), 36));
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
    amount_36: BigNumber, // wei
    tokenDecimals: number,
    rate: BigNumber, // wei
    fxOracleDecimals: number
): OldBigNumber => {
    // Solidity: _amount.mul(_rate).div(basefxOracleDecimals).divu(baseDecimals);

    const val = amount_36
        .mul(safeParseFixed(rate.toString(), 36))
        .div(ONE_36)
        .div(ONE_36)
        .div(safeParseFixed('1', fxOracleDecimals));

    return bnum(val.toString()).div(bnum(10).pow(tokenDecimals));
};

// Curve Math
// calculations are from CurveMath.sol
const calculateMicroFee = (
    _bal: BigNumber,
    _ideal: BigNumber,
    _beta: BigNumber,
    _delta: BigNumber
): BigNumber => {
    let _threshold, _feeMargin;
    let fee_ = BigNumber.from(0);

    if (_bal.lt(_ideal)) {
        _threshold = _ideal.mul(ONE_36.sub(_beta)).div(ONE_36);

        if (_bal.lt(_threshold)) {
            _feeMargin = _threshold.sub(_bal);
            fee_ = _feeMargin.mul(ONE_36).div(_ideal);
            fee_ = fee_.mul(_delta).div(ONE_36);

            if (fee_.gt(CURVEMATH_MAX_36)) {
                fee_ = CURVEMATH_MAX_36;
            }

            fee_ = fee_.mul(_feeMargin).div(ONE_36);
        } else {
            fee_ = BigNumber.from(0);
        }
    } else {
        _threshold = _ideal.mul(_beta.add(ONE_36)).div(ONE_36);

        if (_bal.gt(_threshold)) {
            _feeMargin = _bal.sub(_threshold);

            fee_ = _feeMargin.mul(ONE_36).div(_ideal);
            fee_ = fee_.mul(_delta).div(ONE_36);

            if (fee_.gt(CURVEMATH_MAX_36)) fee_ = CURVEMATH_MAX_36;

            fee_ = fee_.mul(_feeMargin).div(ONE_36);
        } else {
            fee_ = BigNumber.from(0);
        }
    }

    return fee_;
};

const calculateFee = (
    _gLiq: BigNumber,
    _bals: BigNumber[],
    _beta: BigNumber,
    _delta: BigNumber,
    _weights: BigNumber[]
): BigNumber => {
    const _length = _bals.length;
    let psi_ = BigNumber.from(0);

    for (let i = 0; i < _length; i++) {
        const _ideal = _gLiq.mul(_weights[i]).div(ONE_36);

        // keep away from wei values like how the contract do it
        psi_ = psi_.add(calculateMicroFee(_bals[i], _ideal, _beta, _delta));
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
    const weights_: BigNumber[] = [
        safeParseFixed('0.5', 36),
        safeParseFixed('0.5', 36),
    ]; // const for now since all weights are 0.5

    const inputAmt_ = safeParseFixed(_inputAmt.toString(), 36);
    const oGLiq_ = safeParseFixed(_oGLiq.toString(), 36);
    let nGLiq_ = safeParseFixed(_nGLiq.toString(), 36);
    const oBals_ = _oBals.map((d) => safeParseFixed(d.toString(), 36));
    const nBals_ = _nBals.map((d) => safeParseFixed(d.toString(), 36));

    const alpha = poolPairData.alpha;
    const beta = poolPairData.beta;
    const delta = poolPairData.delta;
    const lambda = poolPairData.lambda;

    let outputAmt_ = inputAmt_.mul(-1);

    const omega_ = calculateFee(oGLiq_, oBals_, beta, delta, weights_);

    let psi_: BigNumber;

    for (let i = 0; i < 32; i++) {
        psi_ = calculateFee(nGLiq_, nBals_, beta, delta, weights_);

        const prevAmount = outputAmt_;

        outputAmt_ = omega_.lt(psi_)
            ? inputAmt_.add(omega_.sub(psi_)).mul(-1)
            : inputAmt_.add(lambda.mul(omega_.sub(psi_)).div(ONE_36)).mul(-1);

        if (
            outputAmt_
                .mul(ONE_36)
                .div(ONE_TO_THE_THIRTEEN_NUM_36)
                .eq(prevAmount.mul(ONE_36).div(ONE_TO_THE_THIRTEEN_NUM_36))
        ) {
            nGLiq_ = oGLiq_.add(inputAmt_).add(outputAmt_);

            nBals_[_outputIndex] = oBals_[_outputIndex].add(outputAmt_);
            // throws error already, removed if statement
            enforceHalts(oGLiq_, nGLiq_, oBals_, nBals_, weights_, alpha);
            enforceSwapInvariant(oGLiq_, omega_, nGLiq_, psi_);
            return [
                bnum(outputAmt_.toString()).div(bnum(10).pow(36)),
                bnum(nGLiq_.toString()).div(bnum(10).pow(36)),
            ];
        } else {
            nGLiq_ = oGLiq_.add(inputAmt_).add(outputAmt_);
            nBals_[_outputIndex] = oBals_[_outputIndex].add(outputAmt_);
        }
    }

    throw new Error(CurveMathRevert.SwapConvergenceFailed);
};

// invariant enforcement
const enforceHalts = (
    _oGLiq: BigNumber,
    _nGLiq: BigNumber,
    _oBals: BigNumber[],
    _nBals: BigNumber[],
    _weights: BigNumber[],
    alpha: BigNumber
): boolean => {
    const _length = _nBals.length;
    const _alpha = alpha;

    for (let i = 0; i < _length; i++) {
        const _nIdeal = _nGLiq.mul(_weights[i]).div(ONE_36);

        if (_nBals[i].gt(_nIdeal)) {
            const _upperAlpha = _alpha.add(ONE_36);

            const _nHalt = _nIdeal.mul(_upperAlpha).div(ONE_36);

            if (_nBals[i].gt(_nHalt)) {
                const _oHalt = _oGLiq
                    .mul(_weights[i])
                    .div(ONE_36)
                    .mul(_upperAlpha)
                    .div(ONE_36);

                if (_oBals[i].lt(_oHalt)) {
                    throw new Error(CurveMathRevert.UpperHalt);
                }
                if (_nBals[i].sub(_nHalt).gt(_oBals[i].sub(_oHalt))) {
                    throw new Error(CurveMathRevert.UpperHalt);
                }
            }
        } else {
            const _lowerAlpha = ONE_36.sub(_alpha);

            const _nHalt = _nIdeal.mul(_lowerAlpha).div(ONE_36);

            if (_nBals[i].lt(_nHalt)) {
                let _oHalt = _oGLiq.mul(_weights[i]).div(ONE_36);
                _oHalt = _oHalt.mul(_lowerAlpha).div(ONE_36);

                if (_oBals[i].gt(_oHalt)) {
                    throw new Error(CurveMathRevert.LowerHalt);
                }
                if (_nHalt.sub(_nBals[i]).gt(_oHalt.sub(_oBals[i]))) {
                    throw new Error(CurveMathRevert.LowerHalt);
                }
            }
        }
    }
    return true;
};

const enforceSwapInvariant = (
    _oGLiq: BigNumber,
    _omega: BigNumber,
    _nGLiq: BigNumber,
    _psi: BigNumber
): boolean => {
    const _nextUtil = _nGLiq.sub(_psi);

    const _prevUtil = _oGLiq.sub(_omega);

    const _diff = _nextUtil.sub(_prevUtil);

    // from int128 private constant MAX_DIFF = -0x10C6F7A0B5EE converted to plain decimals
    if (_diff.gt(0) || _diff.gte(CURVEMATH_MAX_DIFF_36)) {
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
    const parsedFxPoolData = getParsedFxPoolData(
        safeParseFixed(amount.toString(), 36),
        poolPairData,
        true
    );

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
        const _amtWithFee = _amt[0].times(
            bnum(1).minus(bnum(epsilon.toString()).div(bnum(10).pow(36)))
        );

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
    const parsedFxPoolData = getParsedFxPoolData(
        safeParseFixed(amount.toString(), 36),
        poolPairData,
        false
    );
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
    const parsedFxPoolData = getParsedFxPoolData(
        safeParseFixed(amount.toString(), 36),
        poolPairData,
        true
    );

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
        .times(
            bnum(1).minus(
                bnum(parsedFxPoolData.epsilon.toString()).div(bnum(10).pow(36))
            )
        )
        .div(inputAmountInNumeraire.abs())
        .times(parsedFxPoolData.baseTokenRate.toString())
        .div(ONE_36.toString())
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
    const parsedFxPoolData = getParsedFxPoolData(
        safeParseFixed(amount.toString(), 36),
        poolPairData,
        true
    );

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

    const maxBetaLimit = bnum(beta.toString())
        .div(bnum(10).pow(36))
        .plus(1)
        .times('0.5')
        .times(_oGLiq);

    const minBetaLimit = bnum(1)
        .minus(bnum(beta.toString()).div(bnum(10).pow(36)))
        .times('0.5')
        .times(_oGLiq);

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
                      .times(
                          bnum(1).minus(
                              bnum(epsilon.toString()).div(bnum(10).pow(36))
                          )
                      )
                      .abs()
                      .div(targetAmountInNumeraire.abs())
                      .times(currentRate.toString())
                      .div(ONE_36.toString())
                      .decimalPlaces(
                          poolPairData.tokenInfxOracleDecimals,
                          OldBigNumber.ROUND_DOWN
                      );
        } else {
            return bnum(currentRate.toString())
                .div(ONE_36.toString())
                .times(
                    bnum(1).minus(
                        bnum(epsilon.toString()).div(bnum(10).pow(36))
                    )
                )
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
                .times(
                    bnum(1).minus(
                        bnum(epsilon.toString()).div(bnum(10).pow(36))
                    )
                )
                .abs()
                .div(targetAmountInNumeraire.abs());
            return ratioOfOutputAndInput
                .times(currentRate.toString())
                .div(ONE_36.toString())
                .decimalPlaces(
                    poolPairData.tokenInfxOracleDecimals,
                    OldBigNumber.ROUND_DOWN
                );
        } else {
            return bnum(currentRate.toString())
                .div(ONE_36.toString())
                .times(
                    bnum(1).minus(
                        bnum(epsilon.toString()).div(bnum(10).pow(36))
                    )
                )
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
    const parsedFxPoolData = getParsedFxPoolData(
        safeParseFixed(amount.toString(), 36),
        poolPairData,
        false
    );

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

    const maxBetaLimit = bnum(beta.toString())
        .div(bnum(10).pow(36))
        .plus(1)
        .times('0.5')
        .times(_oGLiq);

    const minBetaLimit = bnum(1)
        .minus(bnum(beta.toString()).div(bnum(10).pow(36)))
        .times('0.5')
        .times(_oGLiq);

    if (isUSDC(poolPairData.tokenIn)) {
        // token[0] to token [1] in originswap
        const oBals0after = _nBals[0];
        const oBals1after = _nBals[1];

        if (oBals1after.lt(minBetaLimit) && oBals0after.gt(maxBetaLimit)) {
            return targetAmountInNumeraire
                .abs()
                .div(
                    outputAmount
                        .times(
                            bnum(epsilon.toString())
                                .div(bnum(10).pow(36))
                                .plus(1)
                        )
                        .abs()
                )
                .times(currentRate.toString())
                .div(ONE_36.toString())
                .decimalPlaces(
                    poolPairData.tokenOutfxOracleDecimals,
                    OldBigNumber.ROUND_DOWN
                );
        } else {
            // rate * (1-epsilon)
            return bnum(currentRate.toString())
                .div(ONE_36.toString())
                .times(
                    bnum(1).minus(
                        bnum(epsilon.toString()).div(bnum(10).pow(36))
                    )
                )
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
                .div(
                    outputAmount
                        .times(
                            bnum(epsilon.toString())
                                .div(bnum(10).pow(36))
                                .plus(1)
                        )
                        .abs()
                )
                .times(currentRate.toString())
                .div(ONE_36.toString())
                .decimalPlaces(
                    poolPairData.tokenOutfxOracleDecimals,
                    OldBigNumber.ROUND_DOWN
                );
        } else {
            return bnum(currentRate.toString())
                .div(ONE_36.toString())
                .times(
                    bnum(1).minus(
                        bnum(epsilon.toString()).div(bnum(10).pow(36))
                    )
                )
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

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
    alpha_36: BigNumber;
    beta_36: BigNumber;
    delta_36: BigNumber;
    epsilon_36: BigNumber;
    lambda_36: BigNumber;
    baseTokenRate_36: BigNumber;
    _oGLiq_36: BigNumber;
    _nGLiq_36: BigNumber;
    _oBals_36: BigNumber[];
    _nBals_36: BigNumber[];
    givenAmountInNumeraire_36: BigNumber;
}

interface ReservesInNumeraire {
    tokenInReservesInNumeraire_36: BigNumber;
    tokenOutReservesInNumeraire_36: BigNumber;
    _oGLiq_36: BigNumber;
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
): BigNumber => {
    let calculatedNumeraireAmount_36: BigNumber;

    if (isOriginSwap) {
        // tokenIn is given
        calculatedNumeraireAmount_36 = viewNumeraireAmount(
            safeParseFixed(amount_36.toString(), poolPairData.decimalsIn),
            poolPairData.decimalsIn,
            poolPairData.tokenInLatestFXPrice,
            poolPairData.tokenInfxOracleDecimals
        );
    } else {
        // tokenOut is given
        calculatedNumeraireAmount_36 = viewNumeraireAmount(
            safeParseFixed(amount_36.toString(), poolPairData.decimalsOut),
            poolPairData.decimalsOut,
            poolPairData.tokenOutLatestFXPrice,
            poolPairData.tokenOutfxOracleDecimals
        );
    }

    return calculatedNumeraireAmount_36;
};

export const poolBalancesToNumeraire = (
    poolPairData: FxPoolPairData
): ReservesInNumeraire => {
    let tokenInNumeraire: BigNumber, tokenOutNumeraire: BigNumber;

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
        tokenInReservesInNumeraire_36: tokenInNumeraire,
        tokenOutReservesInNumeraire_36: tokenOutNumeraire,
        _oGLiq_36: tokenInNumeraire.add(tokenOutNumeraire),
    };
};
// everything is in order of USDC, base token
const getParsedFxPoolData = (
    amount_36: BigNumber,
    poolPairData: FxPoolPairData,
    isOriginSwap: boolean
): ParsedFxPoolData => {
    // reserves are in raw amount, they converted to numeraire
    const baseReserves_36 = isUSDC(poolPairData.tokenIn)
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
    const usdcReserves_36 = isUSDC(poolPairData.tokenIn)
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
    const baseTokenRate_36 = isUSDC(poolPairData.tokenIn)
        ? poolPairData.tokenOutLatestFXPrice
              .mul(ONE_36)
              .div(safeParseFixed('1', poolPairData.tokenOutfxOracleDecimals))
        : poolPairData.tokenInLatestFXPrice
              .mul(ONE_36)
              .div(safeParseFixed('1', poolPairData.tokenInfxOracleDecimals));

    // given amount in or out converted to numeraire
    const givenAmountInNumeraire_36 = calculateGivenAmountInNumeraire(
        isOriginSwap,
        poolPairData,
        amount_36
    );

    return {
        // poolPairData already has the parameters with 18 decimals
        // therefore we only need to add 18 decimals more
        alpha_36: safeParseFixed(poolPairData.alpha.toString(), 18),
        beta_36: parseFixed(poolPairData.beta.toString(), 18),
        delta_36: parseFixed(poolPairData.delta.toString(), 18),
        epsilon_36: parseFixed(poolPairData.epsilon.toString(), 18),
        lambda_36: parseFixed(poolPairData.lambda.toString(), 18),
        baseTokenRate_36: baseTokenRate_36,
        _oGLiq_36: baseReserves_36.add(usdcReserves_36),
        _nGLiq_36: baseReserves_36.add(usdcReserves_36),
        _oBals_36: [usdcReserves_36, baseReserves_36],
        _nBals_36: isUSDC(poolPairData.tokenIn)
            ? [
                  usdcReserves_36.add(givenAmountInNumeraire_36),
                  baseReserves_36.sub(givenAmountInNumeraire_36),
              ]
            : [
                  usdcReserves_36.sub(givenAmountInNumeraire_36),
                  baseReserves_36.add(givenAmountInNumeraire_36),
              ],

        givenAmountInNumeraire_36: givenAmountInNumeraire_36,
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
    amount_36: BigNumber,
    tokenDecimals: number,
    rate: BigNumber, // wei
    fxOracleDecimals: number
): OldBigNumber => {
    // solidity code `amount.mulu(baseDecimals).mul(baseOracleDecimals).div(_rate);

    const val = safeParseFixed(amount_36.toString(), tokenDecimals)
        .div(ONE_36)
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
 * @returns amount in numeraire in 36 decimals
 */
export const viewNumeraireAmount = (
    amount_36: BigNumber, // wei
    tokenDecimals: number,
    rate: BigNumber, // wei
    fxOracleDecimals: number
): BigNumber => {
    // Solidity: _amount.mul(_rate).div(basefxOracleDecimals).divu(baseDecimals);

    const val = amount_36
        .mul(safeParseFixed(rate.toString(), 36))
        .div(ONE_36)
        .div(ONE_36)
        .div(safeParseFixed('1', fxOracleDecimals))
        .mul(ONE_36)
        .div(safeParseFixed('1', tokenDecimals));

    return val;
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
    let psi_36 = BigNumber.from(0);

    for (let i = 0; i < _length; i++) {
        const _ideal = _gLiq.mul(_weights[i]).div(ONE_36);

        // keep away from wei values like how the contract do it
        psi_36 = psi_36.add(calculateMicroFee(_bals[i], _ideal, _beta, _delta));
    }

    return psi_36;
};

// return outputAmount and ngliq
const calculateTrade = (
    _oGLiq_36: BigNumber,
    _nGLiq_36: BigNumber,
    _oBals_36: BigNumber[],
    _nBals_36: BigNumber[],
    _inputAmt_36: BigNumber,
    _outputIndex: number,
    poolPairData: ParsedFxPoolData
): [OldBigNumber, OldBigNumber] => {
    const weights_: BigNumber[] = [
        safeParseFixed('0.5', 36),
        safeParseFixed('0.5', 36),
    ]; // const for now since all weights are 0.5

    const alpha_36 = poolPairData.alpha_36;
    const beta_36 = poolPairData.beta_36;
    const delta_36 = poolPairData.delta_36;
    const lambda_36 = poolPairData.lambda_36;

    let outputAmt_ = _inputAmt_36.mul(-1);

    const omega_36 = calculateFee(
        _oGLiq_36,
        _oBals_36,
        beta_36,
        delta_36,
        weights_
    );

    let psi_36: BigNumber;

    for (let i = 0; i < 32; i++) {
        psi_36 = calculateFee(_nGLiq_36, _nBals_36, beta_36, delta_36, weights_);

        const prevAmount = outputAmt_;

        outputAmt_ = omega_36.lt(psi_36)
            ? _inputAmt_36.add(omega_36.sub(psi_36)).mul(-1)
            : _inputAmt_36
                  .add(lambda_36.mul(omega_36.sub(psi_36)).div(ONE_36))
                  .mul(-1);

        if (
            outputAmt_
                .mul(ONE_36)
                .div(ONE_TO_THE_THIRTEEN_NUM_36)
                .eq(prevAmount.mul(ONE_36).div(ONE_TO_THE_THIRTEEN_NUM_36))
        ) {
            _nGLiq_36 = _oGLiq_36.add(_inputAmt_36).add(outputAmt_);

            _nBals_36[_outputIndex] = _oBals_36[_outputIndex].add(outputAmt_);
            // throws error already, removed if statement
            enforceHalts(
                _oGLiq_36,
                _nGLiq_36,
                _oBals_36,
                _nBals_36,
                weights_,
                alpha_36
            );
            enforceSwapInvariant(_oGLiq_36, omega_36, _nGLiq_36, psi_36);
            return [
                bnum(outputAmt_.toString()).div(bnum(10).pow(36)),
                bnum(_nGLiq_36.toString()).div(bnum(10).pow(36)),
            ];
        } else {
            _nGLiq_36 = _oGLiq_36.add(_inputAmt_36).add(outputAmt_);
            _nBals_36[_outputIndex] = _oBals_36[_outputIndex].add(outputAmt_);
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
    alpha_36: BigNumber
): boolean => {
    const _length = _nBals.length;

    for (let i = 0; i < _length; i++) {
        const _nIdeal = _nGLiq.mul(_weights[i]).div(ONE_36);

        if (_nBals[i].gt(_nIdeal)) {
            const _upperAlpha = alpha_36.add(ONE_36);

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
            const _lowerAlpha = ONE_36.sub(alpha_36);

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

    const targetAmountInNumeraire_36 =
        parsedFxPoolData.givenAmountInNumeraire_36;

    if (poolPairData.tokenIn === poolPairData.tokenOut) {
        return viewRawAmount(
            targetAmountInNumeraire_36,
            poolPairData.decimalsIn,
            poolPairData.tokenInLatestFXPrice,
            poolPairData.tokenInfxOracleDecimals
        ).div(bnum(10).pow(poolPairData.decimalsIn)); // must be the token out
    }

    const _oGLiq_36 = parsedFxPoolData._oGLiq_36;
    const _nGLiq_36 = parsedFxPoolData._nGLiq_36;
    const _oBals_36 = parsedFxPoolData._oBals_36;
    const _nBals_36 = parsedFxPoolData._nBals_36;

    const _amt = calculateTrade(
        _oGLiq_36, // _oGLiq
        _nGLiq_36, // _nGLiq
        _oBals_36, // _oBals
        _nBals_36, // _nBals
        targetAmountInNumeraire_36, // input amount
        isUSDC(poolPairData.tokenIn) ? 1 : 0, // if USDC return base token (index 1), else return 0 for USDC out
        parsedFxPoolData
    );

    if (_amt === undefined) {
        throw new Error(CurveMathRevert.CannotSwap);
    } else {
        const epsilon = parsedFxPoolData.epsilon_36;
        const _amtWithFee = _amt[0].times(
            bnum(1).minus(bnum(epsilon.toString()).div(bnum(10).pow(36)))
        );

        return viewRawAmount(
            safeParseFixed(_amtWithFee.abs().toString(), 36),
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
    const targetAmountInNumeraire_36 =
        parsedFxPoolData.givenAmountInNumeraire_36.mul(-1);

    if (poolPairData.tokenIn === poolPairData.tokenOut) {
        viewRawAmount(
            // poolPairData.tokenOut as TokenSymbol,
            targetAmountInNumeraire_36,
            poolPairData.decimalsOut,
            poolPairData.tokenOutLatestFXPrice,
            poolPairData.tokenOutfxOracleDecimals
        ).div(bnum(10).pow(poolPairData.decimalsOut)); // must be the token out
    }

    const _amt = calculateTrade(
        parsedFxPoolData._oGLiq_36,
        parsedFxPoolData._nGLiq_36,
        parsedFxPoolData._oBals_36,
        parsedFxPoolData._nBals_36,
        targetAmountInNumeraire_36,
        isUSDC(poolPairData.tokenIn) ? 0 : 1, // if USDC return 0 else return 1 for base token
        parsedFxPoolData
    );

    if (_amt === undefined) {
        throw new Error(CurveMathRevert.CannotSwap);
    } else {
        const epsilon = poolPairData.epsilon.div(bnum(10).pow(18));

        const _amtWithFee = _amt[0].times(epsilon.plus(1)); // fee retained by the pool

        return viewRawAmount(
            safeParseFixed(_amtWithFee.abs().toString(), 36),
            poolPairData.decimalsIn,
            poolPairData.tokenInLatestFXPrice,
            poolPairData.tokenInfxOracleDecimals
        ).div(bnum(10).pow(poolPairData.decimalsIn)); // must be the token out
    }
}

export const spotPriceBeforeSwap = (
    amount_36: BigNumber,
    poolPairData: FxPoolPairData
): OldBigNumber => {
    // input amount 1 XSGD to get the output in USDC
    const inputAmountInNumeraire = bnum(1);
    const parsedFxPoolData = getParsedFxPoolData(amount_36, poolPairData, true);

    const outputAmountInNumeraire = calculateTrade(
        parsedFxPoolData._oGLiq_36, // _oGLiq
        parsedFxPoolData._nGLiq_36, // _nGLiq
        parsedFxPoolData._oBals_36, // _oBals
        parsedFxPoolData._nBals_36, // _nBals
        parseFixed('1', 36), // input amount
        0, // always output in USDC
        parsedFxPoolData
    );

    const val = outputAmountInNumeraire[0]
        .abs()
        .times(
            bnum(1).minus(
                bnum(parsedFxPoolData.epsilon_36.toString()).div(
                    bnum(10).pow(36)
                )
            )
        )
        .div(inputAmountInNumeraire.abs())
        .times(parsedFxPoolData.baseTokenRate_36.toString())
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
    const amount_36 = safeParseFixed(amount.toString(), 36);
    const parsedFxPoolData = getParsedFxPoolData(amount_36, poolPairData, true);

    const targetAmountInNumeraire_36 =
        parsedFxPoolData.givenAmountInNumeraire_36;

    const _oGLiq_36 = parsedFxPoolData._oGLiq_36;
    const _nBals_36 = parsedFxPoolData._nBals_36;
    const currentRate_36 = parsedFxPoolData.baseTokenRate_36;
    const beta_36 = parsedFxPoolData.beta_36;
    const epsilon_36 = parsedFxPoolData.epsilon_36;
    const _nGLiq_36 = parsedFxPoolData._nGLiq_36;
    const _oBals_36 = parsedFxPoolData._oBals_36;

    const outputAfterTrade = calculateTrade(
        _oGLiq_36,
        _nGLiq_36,
        _oBals_36,
        _nBals_36,
        targetAmountInNumeraire_36, // input amount
        isUSDC(poolPairData.tokenIn) ? 1 : 0, // if USDC return base token (index 1), else return 0 for USDC out
        parsedFxPoolData
    );

    const outputAmount = outputAfterTrade[0];

    const maxBetaLimit = bnum(beta_36.toString())
        .div(bnum(10).pow(36))
        .plus(1)
        .times('0.5')
        .times(_oGLiq_36.toString())
        .div(bnum(10).pow(36));

    const minBetaLimit = bnum(1)
        .minus(bnum(beta_36.toString()).div(bnum(10).pow(36)))
        .times('0.5')
        .times(_oGLiq_36.toString())
        .div(bnum(10).pow(36));

    if (isUSDC(poolPairData.tokenIn)) {
        // token[0] to token [1] in originswap
        const oBals0after = bnum(_nBals_36[0].toString()).div(bnum(10).pow(36));

        const oBals1after = bnum(_nBals_36[1].toString()).div(bnum(10).pow(36));

        if (oBals1after.lt(minBetaLimit) && oBals0after.gt(maxBetaLimit)) {
            // returns 0 because  Math.abs(targetAmountInNumeraire)) * currentRate
            // used that function with a 0 amount to get a market spot price for the pool
            // which is used in front end display.

            return amount.isZero()
                ? spotPriceBeforeSwap(amount_36, poolPairData)
                : outputAmount
                      .times(
                          bnum(1).minus(
                              bnum(epsilon_36.toString()).div(bnum(10).pow(36))
                          )
                      )
                      .abs()
                      .times(bnum(10).pow(36))
                      .div(bnum(targetAmountInNumeraire_36.toString()).abs())
                      .times(currentRate_36.toString())
                      .div(ONE_36.toString())
                      .decimalPlaces(
                          poolPairData.tokenInfxOracleDecimals,
                          OldBigNumber.ROUND_DOWN
                      );
        } else {
            return bnum(currentRate_36.toString())
                .div(ONE_36.toString())
                .times(
                    bnum(1).minus(
                        bnum(epsilon_36.toString()).div(bnum(10).pow(36))
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
        const oBals0after = bnum(_nBals_36[1].toString()).div(bnum(10).pow(36));
        const oBals1after = bnum(_nBals_36[0].toString()).div(bnum(10).pow(36));

        if (oBals1after.lt(minBetaLimit) && oBals0after.gt(maxBetaLimit)) {
            if (amount.isZero())
                return spotPriceBeforeSwap(amount_36, poolPairData);

            const ratioOfOutputAndInput = outputAmount
                .times(
                    bnum(1).minus(
                        bnum(epsilon_36.toString()).div(bnum(10).pow(36))
                    )
                )
                .abs()
                .times(bnum(10).pow(36))
                .div(bnum(targetAmountInNumeraire_36.toString()).abs());
            return ratioOfOutputAndInput
                .times(currentRate_36.toString())
                .div(ONE_36.toString())
                .decimalPlaces(
                    poolPairData.tokenInfxOracleDecimals,
                    OldBigNumber.ROUND_DOWN
                );
        } else {
            return bnum(currentRate_36.toString())
                .div(ONE_36.toString())
                .times(
                    bnum(1).minus(
                        bnum(epsilon_36.toString()).div(bnum(10).pow(36))
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
    const amount_36 = safeParseFixed(amount.toString(), 36);
    const parsedFxPoolData = getParsedFxPoolData(
        amount_36,
        poolPairData,
        false
    );

    const targetAmountInNumeraire_36 =
        parsedFxPoolData.givenAmountInNumeraire_36.mul(-1);

    const _oGLiq_36 = parsedFxPoolData._oGLiq_36;
    const _nBals_36 = parsedFxPoolData._nBals_36;
    const currentRate = parsedFxPoolData.baseTokenRate_36;
    const beta_36 = parsedFxPoolData.beta_36;
    const epsilon_36 = parsedFxPoolData.epsilon_36;
    const _nGLiq_36 = parsedFxPoolData._nGLiq_36;
    const _oBals_36 = parsedFxPoolData._oBals_36;

    const outputAfterTrade = calculateTrade(
        _oGLiq_36,
        _nGLiq_36,
        _oBals_36,
        _nBals_36,
        targetAmountInNumeraire_36, // input amount
        isUSDC(poolPairData.tokenIn) ? 0 : 1, // if USDC return 0 else return 1 for base token
        parsedFxPoolData
    );

    const outputAmount = outputAfterTrade[0];

    const maxBetaLimit = bnum(beta_36.toString())
        .div(bnum(10).pow(36))
        .plus(1)
        .times('0.5')
        .times(_oGLiq_36.toString())
        .div(bnum(10).pow(36));
    const minBetaLimit = bnum(1)
        .minus(bnum(beta_36.toString()).div(bnum(10).pow(36)))
        .times('0.5')
        .times(_oGLiq_36.toString())
        .div(bnum(10).pow(36));
    if (isUSDC(poolPairData.tokenIn)) {
        // token[0] to token [1] in originswap
        const oBals0after = bnum(_nBals_36[0].toString()).div(bnum(10).pow(36));
        const oBals1after = bnum(_nBals_36[1].toString()).div(bnum(19).pow(36));

        if (oBals1after.lt(minBetaLimit) && oBals0after.gt(maxBetaLimit)) {
            return bnum(targetAmountInNumeraire_36.toString())
                .div(bnum(10).pow(36))
                .abs()
                .div(
                    outputAmount
                        .times(
                            bnum(epsilon_36.toString())
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
                        bnum(epsilon_36.toString()).div(bnum(10).pow(36))
                    )
                )
                .decimalPlaces(
                    poolPairData.tokenOutfxOracleDecimals,
                    OldBigNumber.ROUND_DOWN
                );
        }
    } else {
        //  token[1] to token [0] in originswap
        const oBals0after = bnum(_nBals_36[0].toString()).div(bnum(10).pow(36));
        const oBals1after = bnum(_nBals_36[1].toString()).div(bnum(10).pow(36));

        const isBeyondMinBeta = oBals0after.lt(minBetaLimit);
        const isBeyondMaxBeta = oBals1after.gt(maxBetaLimit);

        if (isBeyondMinBeta && isBeyondMaxBeta) {
            return bnum(targetAmountInNumeraire_36.toString())
                .div(bnum(10).pow(36))
                .abs()
                .div(
                    outputAmount
                        .times(
                            bnum(epsilon_36.toString())
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
                        bnum(epsilon_36.toString()).div(bnum(10).pow(36))
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
    const x = spotPriceBeforeSwap(parseFixed('1', 36), poolPairData);
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
    const x = spotPriceBeforeSwap(parseFixed('1', 36), poolPairData);
    const y = _spotPriceAfterSwapTokenInForExactTokenOut(poolPairData, amount);
    const yMinusX = y.minus(x);
    const ans = yMinusX.div(x);
    // if we're outside the Beta region the derivative will be negative
    // but `UniversalNormalizedLiquidity` returns ZERO for negative values
    // therefore we want to make sure this reflects the fact that we're
    // moving outside of Beta region
    return ans.abs();
};

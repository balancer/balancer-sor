import { bnum, OldBigNumber } from 'index';
import { scale } from 'utils/bignumber';
import { FxPoolPairData } from './fxPool';
import { MathSol } from '../../utils/basicOperations';
import { formatFixed } from '@ethersproject/bignumber';

export const CURVEMATH_MAX_DIFF = -0.000001000000000000024;
export const NEGATIVE_ONE = bnum('-1');
export const ONE = bnum('1');
export const ONE_TO_THE_SECOND_NUM = 100;
export const ONE_TO_THE_SECOND = BigInt(`${ONE_TO_THE_SECOND_NUM}`);
export const ONE_TO_THE_EIGHT_NUM = 100000000;
export const ONE_TO_THE_EIGHT = BigInt(`${ONE_TO_THE_EIGHT_NUM}`);
export const ONE_TO_THE_SIX_NUM = 1000000;
export const ONE_TO_THE_SIX = BigInt(`${ONE_TO_THE_SIX_NUM}`);
export const ONE_TO_THE_THIRTEEN_NUM = 10000000000000;
export const ONE_TO_THE_THIRTEEN = BigInt(`${ONE_TO_THE_THIRTEEN_NUM}`);
export const ONE_ETHER = scale(bnum('1'), 18);

export enum CurveMathRevert {
    LowerHalt = 'CurveMath/lower-halt',
    UpperHalt = 'CurveMath/upper-halt',
    SwapInvariantViolation = 'CurveMath/swap-invariant-violation',
    SwapConvergenceFailed = 'CurveMath/swap-convergence-failed',
    CannotSwap = 'CannotSwap',
}

// Curve parameters, make an object with the curve parameters per pool?
// const EPSILON = 0.0005; // fixed for now
const CURVEMATH_MAX = 0.25; //CURVEMATH MAX from contract
// const alpha = 0.8;
// let beta: number = 0.48; // @todo : make an object with the curve parameters per pool?
// const MAX = 0.175; // @todo :  make an object with the curve parameters per pool?
// const lambda = 0.48; // @todo :  make an object with the curve parameters per pool?

// @todo sub
export enum TokenSymbol {
    USDC = 'USDC',
    XSGD = 'XSGD',
    EURS = 'EURS',
    fxPHP = 'fxPHP',
    XIDR = 'XIDR',
}

// call from chainlink? off chain source? subgraph assimilators?
export const getRate = (token: TokenSymbol) => {
    switch (token) {
        case TokenSymbol.USDC: {
            return '100000000';
        }

        case TokenSymbol.XSGD: {
            return '74376600';
        }

        case TokenSymbol.EURS: {
            return '101696500';
        }

        case TokenSymbol.fxPHP: {
            return '1775177';
        }

        case TokenSymbol.XIDR: {
            return '6800';
        }

        default: {
            return '0';
        }
    }
};

// get base decimals for
export const getBaseDecimals = (token: TokenSymbol) => {
    switch (token) {
        case TokenSymbol.USDC: {
            return ONE_TO_THE_SIX;
        }

        case TokenSymbol.XSGD: {
            return ONE_TO_THE_SIX;
        }

        case TokenSymbol.EURS: {
            return ONE_TO_THE_SECOND;
        }

        case TokenSymbol.fxPHP: {
            return ONE_ETHER;
        }

        case TokenSymbol.XIDR: {
            return ONE_TO_THE_SIX;
        }

        default: {
            return ONE_ETHER;
        }
    }
};
// Base Assimilator Functions
// calculations are from the BaseToUsdAssiilato
export const viewRawAmount = (
    token: TokenSymbol,
    _amount: number
): OldBigNumber => {
    const rate = bnum(getRate(token));
    const baseDecimals = getBaseDecimals(token);

    const amountToBN = `${Math.round(
        _amount * Number(baseDecimals.toString())
    )}`;

    const amount_ = MathSol.mul(
        BigInt(amountToBN),
        BigInt(ONE_TO_THE_EIGHT.toString())
    );

    return bnum(MathSol.divDown(amount_, BigInt(rate.toString())).toString()); // @todo check accuracy
};

export const viewNumeraireAmount = (token: TokenSymbol, _amount: bigint) => {
    const rate = getRate(token);

    const baseDecimals = getBaseDecimals(token);

    const amount_ = MathSol.mul(_amount, BigInt(rate));

    const amountDivChainlinkDecimal = MathSol.divDown(
        amount_,
        ONE_TO_THE_EIGHT
    );

    return MathSol.divDown(amountDivChainlinkDecimal, baseDecimals as bigint);
};

// Curve Math
// calculations are from CurveMath.sol
export const calculateMicroFee = (
    _bal: number,
    _ideal: number,
    _beta: number,
    _delta: number
): number => {
    let _threshold, _feeMargin;
    let fee_ = 0;

    if (_bal < _ideal) {
        _threshold = _ideal * (1 - _beta); // CURVEMATH ONE

        if (_bal < _threshold) {
            _feeMargin = _threshold - _bal;
            fee_ = _feeMargin / _ideal;
            fee_ = fee_ * _delta;

            if (fee_ > CURVEMATH_MAX) {
                fee_ = CURVEMATH_MAX;
            }

            fee_ = fee_ * _feeMargin;
        } else {
            fee_ = 0;
        }
    } else {
        _threshold = _ideal * (1 + _beta); // CURVEMATH_ONE

        if (_bal > _threshold) {
            _feeMargin = _bal - _threshold;

            fee_ = _feeMargin / _ideal;
            fee_ = fee_ * _delta;

            if (fee_ > CURVEMATH_MAX) fee_ = CURVEMATH_MAX;

            fee_ = fee_ * _feeMargin;
        } else {
            fee_ = 0;
        }
    }

    return fee_;
};

// export const calculateDelta = (
//     max: number,
//     alpha: number,
//     beta: number
// ): number => {
//     // removed + ONE_WEI to be consistent with other curve parameters
//     return MAX / (2 * (alpha - beta));
// };

export const calculateFee = (
    _gLiq: number,
    _bals: number[],
    _beta: number,
    _delta: number,
    _weights: number[]
): number => {
    const _length = _bals.length;
    let psi_ = 0;

    for (let i = 0; i < _length; i++) {
        const _ideal = _gLiq * _weights[i];

        // keep away from wei values like how the contract do it
        psi_ = psi_ + calculateMicroFee(_bals[i], _ideal, _beta, _delta);
    }

    return psi_;
};

export const calculateTrade = (
    _oGLiq: number,
    _nGLiq: number,
    _oBals: number[],
    _nBals: number[],
    _inputAmt: number,
    _outputIndex: number,
    poolPairData: FxPoolPairData
): [number, number] => {
    let outputAmt_;
    const _weights: number[] = [0.5, 0.5]; // const for now since all weights are 0.5

    // @todo test
    const alpha = Number(formatFixed(poolPairData.alpha, 18));
    const beta = Number(formatFixed(poolPairData.beta, 18));
    const delta = Number(formatFixed(poolPairData.delta, 18));
    const lambda = Number(formatFixed(poolPairData.lambda, 18));
    // const delta = calculateDelta(MAX, alpha, beta);

    outputAmt_ = -_inputAmt;

    const _omega = calculateFee(_oGLiq, _oBals, beta, delta, _weights);

    let _psi: number;

    for (let i = 0; i < 32; i++) {
        _psi = calculateFee(_nGLiq, _nBals, beta, delta, _weights);

        const prevAmount = outputAmt_;

        outputAmt_ =
            _omega < _psi
                ? -(_inputAmt + (_omega - _psi))
                : -(_inputAmt + lambda * (_omega - _psi));

        // @todo check
        if (
            outputAmt_ / ONE_TO_THE_THIRTEEN_NUM ==
            prevAmount / ONE_TO_THE_THIRTEEN_NUM
        ) {
            console.log(
                `_nGLiq before: ${_nGLiq}, _nBals[0]: ${_nBals[0]}, _nBals[1]: ${_nBals[1]} `
            );

            _nGLiq = _oGLiq + _inputAmt + outputAmt_;

            _nBals[_outputIndex] = _oBals[_outputIndex] + outputAmt_;

            console.log(
                `_nGLiq after: ${_nGLiq}, _nBals[0]: ${_nBals[0]}, _nBals[1]: ${_nBals[1]} `
            );

            // @todo change in main sor code
            // throws error already, removed if statement
            enforceSwapInvariant(_oGLiq, _omega, _nGLiq, _psi);
            enforceHalts(_oGLiq, _nGLiq, _oBals, _nBals, _weights, alpha);

            return [outputAmt_, _nGLiq];
        } else {
            _nGLiq = _oGLiq + _inputAmt + outputAmt_;

            _nBals[_outputIndex] = _oBals[_outputIndex] + outputAmt_;
        }
    }

    throw new Error(CurveMathRevert.SwapConvergenceFailed);
};

// invariant enforcement
export const enforceHalts = (
    _oGLiq: number,
    _nGLiq: number,
    _oBals: number[],
    _nBals: number[],
    _weights: number[],
    alpha: number
): boolean => {
    const _length = _nBals.length;
    const _alpha = alpha; // @todo Make dynamic, from subgraph

    for (let i = 0; i < _length; i++) {
        const _nIdeal = _nGLiq * _weights[i];

        if (_nBals[i] > _nIdeal) {
            const _upperAlpha = 1 + _alpha;

            const _nHalt = _nIdeal * _upperAlpha;

            if (_nBals[i] > _nHalt) {
                const _oHalt = _oGLiq * _weights[i] * _upperAlpha;

                if (_oBals[i] < _oHalt) {
                    throw new Error(CurveMathRevert.UpperHalt);
                }
                if (_nBals[i] - _nHalt > _oBals[i] - _oHalt) {
                    throw new Error(CurveMathRevert.UpperHalt);
                }
            }
        } else {
            const _lowerAlpha = 1 - _alpha;

            const _nHalt = _nIdeal * _lowerAlpha;

            if (_nBals[i] < _nHalt) {
                let _oHalt = _oGLiq * _weights[i];
                _oHalt = _oHalt * _lowerAlpha;

                if (_oBals[i] > _oHalt) {
                    throw new Error(CurveMathRevert.LowerHalt);
                }
                if (_nHalt - _nBals[i] > _oHalt - _oBals[i]) {
                    throw new Error(CurveMathRevert.LowerHalt);
                }
            }
        }
    }
    return true;
};

export const enforceSwapInvariant = (
    _oGLiq: number,
    _omega: number,
    _nGLiq: number,
    _psi: number
): boolean => {
    const _nextUtil = _nGLiq - _psi;

    const _prevUtil = _oGLiq - _omega;

    const _diff = _nextUtil - _prevUtil;

    // from int128 private constant MAX_DIFF = -0x10C6F7A0B5EE converted to plain decimals
    if (0 < _diff || _diff >= CURVEMATH_MAX_DIFF) {
        return true;
    } else {
        throw new Error(CurveMathRevert.SwapInvariantViolation);
    }
};

// origin swap
export function _exactTokenInForTokenOut(
    amount: OldBigNumber,
    poolPairData: FxPoolPairData
): OldBigNumber {
    // const baseToken =
    //     poolPairData.tokenIn === TokenSymbol.USDC
    //         ? poolPairData.tokenIn
    //         : poolPairData.tokenOut;

    const amountIn = scale(amount, poolPairData.decimalsIn);
    const targetAmountInNumeraire = Number(
        viewNumeraireAmount(
            poolPairData.tokenIn as TokenSymbol, // @todo check, origin
            BigInt(amountIn.toString())
        ).toString()
    );

    if (poolPairData.tokenIn === poolPairData.tokenOut) {
        viewRawAmount(
            poolPairData.tokenIn as TokenSymbol,
            targetAmountInNumeraire
        ); // must be the token out
    }

    const baseReserves =
        poolPairData.tokenIn === TokenSymbol.USDC
            ? poolPairData.balanceIn
            : poolPairData.balanceOut;

    const usdcReserves =
        poolPairData.tokenIn === TokenSymbol.USDC
            ? poolPairData.balanceOut
            : poolPairData.balanceIn;

    const _oGLiq = baseReserves.toNumber() + usdcReserves.toNumber();
    const _nGLiq = baseReserves.toNumber() + usdcReserves.toNumber();
    const _oBals = [baseReserves.toNumber(), usdcReserves.toNumber()];
    const _nBals =
        poolPairData.tokenIn === TokenSymbol.USDC
            ? [
                  baseReserves.toNumber() - targetAmountInNumeraire,
                  usdcReserves.toNumber() + targetAmountInNumeraire,
              ]
            : [
                  baseReserves.toNumber() + targetAmountInNumeraire,
                  usdcReserves.toNumber() - targetAmountInNumeraire,
              ];

    //   const x = spotPriceBeforeSwap(baseToken, _oBals, _oGLiq)
    const _amt = calculateTrade(
        _oGLiq, // _oGLiq
        _nGLiq, // _nGLiq
        _oBals, // _oBals
        _nBals, // _nBals
        targetAmountInNumeraire, // input amount
        1, // output index,
        poolPairData
    );

    // _nGLiq = _amt[1];

    console.log('Origin swap output amount: ', _amt);

    // const y = spotPriceAfterOriginSwap(
    //     targetAmountInNumeraire,
    //     Math.abs(_amt[0]),
    //     baseToken,
    //     origin,
    //     _nBals,
    //     _oGLiq
    // ); // this will be the next before spot price

    // console.log(`getSpotPriceAfterSwap: ${y}`);

    // const derivative = y / x - 1;

    // console.log('originSwap: ', derivative);

    if (_amt === undefined) {
        throw new Error(CurveMathRevert.CannotSwap);
    } else {
        const epsilon = Number(formatFixed(poolPairData.epsilon, 18));
        const _amtWithFee = _amt[0] * (1 - epsilon); // fee retained by the pool

        // return [viewRawAmount(target, Math.abs(_amtWithFee)), _nGLiq, _nBals]; // must be the token out
        return viewRawAmount(
            poolPairData.tokenOut as TokenSymbol,
            Math.abs(_amtWithFee)
        ); // must be the token out, @todo change token symbol type
    }
}

export function _tokenInForExactTokenOut(
    amount: OldBigNumber,
    poolPairData: FxPoolPairData
): OldBigNumber {
    const amountIn = scale(amount, poolPairData.decimalsOut);
    const targetAmountInNumeraire = Number(
        viewNumeraireAmount(
            poolPairData.tokenOut as TokenSymbol, // @todo check, origin
            BigInt(amountIn.toString())
        ).toString()
    );

    if (poolPairData.tokenIn === poolPairData.tokenOut) {
        viewRawAmount(
            poolPairData.tokenOut as TokenSymbol, // @todo
            targetAmountInNumeraire
        ); // must be the token out
    }

    const baseReserves =
        poolPairData.tokenIn === TokenSymbol.USDC
            ? poolPairData.balanceIn
            : poolPairData.balanceOut;

    const usdcReserves =
        poolPairData.tokenIn === TokenSymbol.USDC
            ? poolPairData.balanceOut
            : poolPairData.balanceIn;

    const _oGLiq = baseReserves.toNumber() + usdcReserves.toNumber();
    const _nGLiq = baseReserves.toNumber() + usdcReserves.toNumber();
    const _oBals = [baseReserves.toNumber(), usdcReserves.toNumber()];
    const _nBals =
        poolPairData.tokenIn === TokenSymbol.USDC
            ? [
                  baseReserves.toNumber() + targetAmountInNumeraire,
                  usdcReserves.toNumber() - targetAmountInNumeraire,
              ]
            : [
                  baseReserves.toNumber() - targetAmountInNumeraire,
                  usdcReserves.toNumber() + targetAmountInNumeraire,
              ];

    const _amt = calculateTrade(
        _oGLiq, // _oGLiq
        _nGLiq, // _nGLiq
        _oBals, // _oBals
        _nBals, // _nBals
        targetAmountInNumeraire, // input amount
        1, // output index , @todo check this if switched
        poolPairData
    );

    // _nGLiq = _amt[1]

    // console.log('Target swap amount: ', _amt)

    // // Step 3

    // const y = spotPriceAfterTargetSwap(targetAmountInNumeraire, Math.abs(_amt[0]), baseToken, target, _nBals, _oGLiq) // this will be the next before spot price ==>

    // console.log(`getSpotPriceAfterSwap: ${y}`)

    // // Step 4
    // const derivative = y / x - 1

    // console.log('targetSwap: ', derivative)

    if (_amt === undefined) {
        throw new Error(CurveMathRevert.CannotSwap);
    } else {
        const epsilon = Number(formatFixed(poolPairData.epsilon, 18));
        const _amtWithFee = _amt[0] * (1 + epsilon); // fee retained by the pool

        // return [viewRawAmount(target, Math.abs(_amtWithFee)), _nGLiq, _nBals]; // must be the token out
        return viewRawAmount(
            poolPairData.tokenIn as TokenSymbol,
            Math.abs(_amtWithFee)
        ); // must be the token out, @todo change token symbol type
    }
}

// @todo test accuracy of decimals
export const _spotPriceAfterSwapExactTokenInForTokenOut = (
    poolPairData: FxPoolPairData,
    amount: OldBigNumber
): OldBigNumber => {
    const baseReserves =
        poolPairData.tokenIn === TokenSymbol.USDC
            ? poolPairData.balanceIn
            : poolPairData.balanceOut;

    const usdcReserves =
        poolPairData.tokenIn === TokenSymbol.USDC
            ? poolPairData.balanceOut
            : poolPairData.balanceIn;

    const targetAmountInNumeraire = Number(
        viewNumeraireAmount(
            poolPairData.tokenOut as TokenSymbol, // @todo check, origin
            BigInt(amount.toString())
        ).toString()
    );

    const inputAmount = Number(amount.toString());
    const outputAmount = amount.toNumber();
    const oGLiq = baseReserves.toNumber() + usdcReserves.toNumber();

    const nBals =
        poolPairData.tokenIn === TokenSymbol.USDC
            ? [
                  baseReserves.toNumber() - targetAmountInNumeraire,
                  usdcReserves.toNumber() + targetAmountInNumeraire,
              ]
            : [
                  baseReserves.toNumber() + targetAmountInNumeraire,
                  usdcReserves.toNumber() - targetAmountInNumeraire,
              ];

    // @todo change
    const currentRate =
        Number(
            getRate(
                (poolPairData.tokenIn as TokenSymbol) === TokenSymbol.USDC
                    ? (poolPairData.tokenIn as TokenSymbol)
                    : (poolPairData.tokenOut as TokenSymbol)
            )
        ) / ONE_TO_THE_EIGHT_NUM;

    // @todo test
    const beta = Number(formatFixed(poolPairData.beta, 18));
    const epsilon = Number(formatFixed(poolPairData.epsilon, 18));

    const maxBetaLimit: number = (1 + beta) * 0.5 * oGLiq;
    console.log(`maxBetaLimit: ${maxBetaLimit}`);

    const minBetaLimit: number = (1 - beta) * 0.5 * oGLiq;
    console.log(`minBetaLimit: ${minBetaLimit}`);

    if (poolPairData.tokenIn === TokenSymbol.USDC) {
        // token[0] to token [1] in originswap
        const oBals0after = nBals[0];
        console.log('oBals0after: ', oBals0after);
        const oBals1after = nBals[1];
        console.log('oBal1after: ', oBals1after);

        console.log(
            `oBals1after < minBetaLimit: ${
                oBals1after < minBetaLimit
            }, oBals0after > maxBetaLimit : ${oBals0after > maxBetaLimit}`
        );

        if (oBals1after < minBetaLimit && oBals0after > maxBetaLimit) {
            console.log(
                'spotPriceAfterOriginSwap token0 -> token1 : outside beta'
            );
            return bnum((inputAmount / Math.abs(outputAmount)) * currentRate);
        } else {
            console.log(
                'spotPriceAfterOriginSwap token0 -> token1 : within beta'
            );
            return bnum(currentRate * (1 - epsilon));
        }
    } else {
        //  token[1] to token [0] in originswap
        const oBals0after = nBals[1];
        console.log('oBals0after: ', oBals0after);
        const oBals1after = nBals[0];
        console.log('oBal1after: ', oBals1after);

        const isBeyondMinBeta = oBals0after < minBetaLimit;
        const isBeyondMaxBeta = oBals1after > maxBetaLimit;

        if (isBeyondMinBeta && isBeyondMaxBeta) {
            console.log(
                'spotPriceAfterOriginSwap token1 -> token0 : outside beta'
            );
            const ratioOfOutputAndInput = Math.abs(outputAmount) / inputAmount;

            return bnum(ratioOfOutputAndInput * currentRate);
        } else {
            console.log(
                'spotPriceAfterOriginSwap token1 -> token0 : within beta'
            );

            return bnum(currentRate * (1 - epsilon));
        }
    }
};

// @todo test accuracy of decimals
export const _spotPriceAfterSwapTokenInForExactTokenOut = (
    amount: OldBigNumber,
    poolPairData: FxPoolPairData
): OldBigNumber => {
    const baseReserves =
        poolPairData.tokenIn === TokenSymbol.USDC
            ? poolPairData.balanceIn
            : poolPairData.balanceOut;

    const usdcReserves =
        poolPairData.tokenIn === TokenSymbol.USDC
            ? poolPairData.balanceOut
            : poolPairData.balanceIn;

    const targetAmountInNumeraire = Number(
        viewNumeraireAmount(
            poolPairData.tokenOut as TokenSymbol, // @todo check, origin
            BigInt(amount.toString())
        ).toString()
    );

    const inputAmount = Number(amount.toString());
    const outputAmount = amount.toNumber();
    const oGLiq = baseReserves.toNumber() + usdcReserves.toNumber();

    const nBals =
        poolPairData.tokenIn === TokenSymbol.USDC
            ? [
                  baseReserves.toNumber() - targetAmountInNumeraire,
                  usdcReserves.toNumber() + targetAmountInNumeraire,
              ]
            : [
                  baseReserves.toNumber() + targetAmountInNumeraire,
                  usdcReserves.toNumber() - targetAmountInNumeraire,
              ];

    // @todo change
    const currentRate =
        Number(
            getRate(
                (poolPairData.tokenIn as TokenSymbol) === TokenSymbol.USDC
                    ? (poolPairData.tokenIn as TokenSymbol)
                    : (poolPairData.tokenOut as TokenSymbol)
            )
        ) / ONE_TO_THE_EIGHT_NUM;

    // @todo test
    const beta = Number(formatFixed(poolPairData.beta, 18));
    const epsilon = Number(formatFixed(poolPairData.epsilon, 18));

    const maxBetaLimit: number = (1 + beta) * 0.5 * oGLiq;
    console.log(`maxBetaLimit: ${maxBetaLimit}`);

    const minBetaLimit: number = (1 - beta) * 0.5 * oGLiq;
    console.log(`minBetaLimit: ${minBetaLimit}`);

    if (poolPairData.tokenIn === TokenSymbol.USDC) {
        // token[0] to token [1] in originswap
        const oBals0after = nBals[0];
        console.log('oBals0after: ', oBals0after);
        const oBals1after = nBals[1];
        console.log('oBal1after: ', oBals1after);

        console.log(
            `oBals1after < minBetaLimit: ${
                oBals1after < minBetaLimit
            }, oBals0after > maxBetaLimit : ${oBals0after > maxBetaLimit}`
        );

        if (oBals1after < minBetaLimit && oBals0after > maxBetaLimit) {
            console.log(
                'spotPriceAfterOriginSwap token0 -> token1 : outside beta'
            );
            return bnum((inputAmount / Math.abs(outputAmount)) * currentRate);
        } else {
            console.log(
                'spotPriceAfterOriginSwap token0 -> token1 : within beta'
            );
            return bnum(currentRate * (1 - epsilon));
        }
    } else {
        //  token[1] to token [0] in originswap
        const oBals0after = nBals[0];
        console.log('oBals0after: ', oBals0after);
        const oBals1after = nBals[1];
        console.log('oBal1after: ', oBals1after);

        const isBeyondMinBeta = oBals0after < minBetaLimit;
        const isBeyondMaxBeta = oBals1after > maxBetaLimit;

        if (isBeyondMinBeta && isBeyondMaxBeta) {
            console.log(
                'spotPriceAfterOriginSwap token1 -> token0 : outside beta'
            );
            const ratioOfOutputAndInput = Math.abs(outputAmount) / inputAmount;

            return bnum(ratioOfOutputAndInput * currentRate);
        } else {
            console.log(
                'spotPriceAfterOriginSwap token1 -> token0 : within beta'
            );

            return bnum(currentRate * (1 - epsilon));
        }
    }
};

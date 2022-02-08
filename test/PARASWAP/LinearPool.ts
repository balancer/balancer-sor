import { BigNumber } from '@ethersproject/bignumber';
import { isSameAddress } from './utils';
import * as LinearMath from './LinearMath';
import { BZERO } from './basicOperations';
import { BasePool } from './BasePool';

export enum PairTypes {
    BptToMainToken,
    MainTokenToBpt,
    MainTokenToWrappedToken,
    WrappedTokenToMainToken,
    BptToWrappedToken,
    WrappedTokenToBpt,
}

export class LinearPool extends BasePool {
    // This is the maximum token amount the Vault can hold. In regular operation, the total BPT supply remains constant
    // and equal to _INITIAL_BPT_SUPPLY, but most of it remains in the Pool, waiting to be exchanged for tokens. The
    // actual amount of BPT in circulation is the total supply minus the amount held by the Pool, and is known as the
    // 'virtual supply'.
    static MAX_TOKEN_BALANCE = BigNumber.from('2').pow('112').sub('1');

    /*
    scaling factors should include rate:
    The wrapped token's scaling factor is not constant, but increases over time as the wrapped token increases in value.
    i.e. 
    scalingFactors: pool.tokens.map(({ decimals, priceRate }) =>
        MathSol.mulDownFixed(getTokenScalingFactor(decimals), priceRate)
    )
    */
    onSell(
        amounts: bigint[],
        tokens: string[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        bptIndex: number,
        wrappedIndex: number,
        mainIndex: number,
        scalingFactors: bigint[],
        swapFeePercentage: bigint,
        lowerTarget: bigint,
        upperTarget: bigint
    ): bigint[] {
        return this._swapGivenIn(
            amounts,
            tokens,
            balances,
            indexIn,
            indexOut,
            bptIndex,
            wrappedIndex,
            mainIndex,
            scalingFactors,
            swapFeePercentage,
            lowerTarget,
            upperTarget
        );
    }

    _swapGivenIn(
        tokenAmountsIn: bigint[],
        tokens: string[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        bptIndex: number,
        wrappedIndex: number,
        mainIndex: number,
        scalingFactors: bigint[],
        swapFeePercentage: bigint,
        lowerTarget: bigint,
        upperTarget: bigint
    ): bigint[] {
        /* 
        Linear pools allow trading between:
        wrappedToken <> mainToken
        wrappedToken <> BPT
        mainToken <> BPT
        */
        let pairType: PairTypes;
        if (isSameAddress(tokens[indexIn], tokens[bptIndex])) {
            if (isSameAddress(tokens[indexOut], tokens[wrappedIndex]))
                pairType = PairTypes.BptToWrappedToken;
            else pairType = PairTypes.BptToMainToken;
        } else if (isSameAddress(tokens[indexOut], tokens[bptIndex])) {
            if (isSameAddress(tokens[indexIn], tokens[wrappedIndex]))
                pairType = PairTypes.WrappedTokenToBpt;
            else pairType = PairTypes.MainTokenToBpt;
        } else {
            if (isSameAddress(tokens[indexIn], tokens[wrappedIndex]))
                pairType = PairTypes.WrappedTokenToMainToken;
            else pairType = PairTypes.MainTokenToWrappedToken;
        }

        const balancesUpscaled = this._upscaleArray(balances, scalingFactors);
        const tokenAmountsInScaled = tokenAmountsIn.map((a) =>
            this._upscale(a, scalingFactors[indexIn])
        );

        // VirtualBPTSupply must be used for the maths
        const virtualBptSupply = LinearPool.MAX_TOKEN_BALANCE.sub(
            balances[bptIndex]
        ).toBigInt();

        const amountsOut = this._onSwapGivenIn(
            tokenAmountsInScaled,
            balancesUpscaled[mainIndex],
            balancesUpscaled[wrappedIndex],
            swapFeePercentage,
            lowerTarget,
            upperTarget,
            virtualBptSupply,
            pairType
        );

        // amountOut tokens are exiting the Pool, so we round down.
        return amountsOut.map((a) =>
            this._downscaleDown(a, scalingFactors[indexOut])
        );
    }

    /*
     Called when a swap with the Pool occurs, where the amount of tokens entering the Pool is known.
     All amounts are upscaled.
     Swap fee is NOT already deducted.
     The return value is also considered upscaled, and should be downscaled (rounding down)
     */
    _onSwapGivenIn(
        tokenAmountsIn: bigint[],
        mainBalance: bigint,
        wrappedBalance: bigint,
        fee: bigint,
        lowerTarget: bigint,
        upperTarget: bigint,
        virtualBptSupply: bigint,
        pairType: PairTypes
    ): bigint[] {
        const amountsOut: bigint[] = [];

        if (pairType === PairTypes.MainTokenToBpt) {
            tokenAmountsIn.forEach((amountIn) => {
                let amt: bigint;
                try {
                    amt = LinearMath._calcBptOutPerMainIn(
                        amountIn,
                        mainBalance,
                        wrappedBalance,
                        virtualBptSupply,
                        {
                            fee: fee,
                            lowerTarget: lowerTarget,
                            upperTarget: upperTarget,
                        }
                    );
                } catch (err) {
                    amt = BZERO;
                }
                amountsOut.push(amt);
            });
        } else if (pairType === PairTypes.BptToMainToken) {
            tokenAmountsIn.forEach((amountIn) => {
                let amt: bigint;
                try {
                    amt = LinearMath._calcMainOutPerBptIn(
                        amountIn,
                        mainBalance,
                        wrappedBalance,
                        virtualBptSupply,
                        {
                            fee: fee,
                            lowerTarget: lowerTarget,
                            upperTarget: upperTarget,
                        }
                    );
                } catch (err) {
                    amt = BZERO;
                }
                amountsOut.push(amt);
            });
        } else amountsOut.push(BZERO);
        return amountsOut;
    }
}

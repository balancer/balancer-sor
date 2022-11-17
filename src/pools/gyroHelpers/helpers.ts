import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';

////////
/// Normalize balances
////////
export function _normalizeBalances(
    balances: BigNumber[],
    decimals: number[]
): BigNumber[] {
    const scalingFactors = decimals.map((d) => parseFixed('1', d));

    return balances.map((bal, index) =>
        bal.mul(ONE).div(scalingFactors[index])
    );
}

/////////
/// Fee calculations
/////////

export function _reduceFee(amountIn: BigNumber, swapFee: BigNumber): BigNumber {
    const feeAmount = amountIn.mul(swapFee).div(ONE);
    return amountIn.sub(feeAmount);
}

export function _addFee(amountIn: BigNumber, swapFee: BigNumber): BigNumber {
    return amountIn.mul(ONE).div(ONE.sub(swapFee));
}

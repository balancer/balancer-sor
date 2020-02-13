import { BigNumber } from './utils/bignumber';
import { Pool } from './types';

export function getSpotPrice(balancer: Pool): BigNumber {
    let inRatio = balancer.balanceIn.div(balancer.weightIn);
    let outRatio = balancer.balanceOut.div(balancer.weightOut);
    let spotPrice = inRatio
        .div(outRatio)
        .div(new BigNumber(1).minus(balancer.swapFee));
    return spotPrice;
}

export function getSlippageLinearizedSpotPriceAfterSwap(
    balancer: Pool,
    swapType: string
): BigNumber {
    let weightIn = balancer.weightIn;
    let weightOut = balancer.weightOut;
    let balanceIn = balancer.balanceIn;
    let balanceOut = balancer.balanceOut;
    let swapFee = balancer.swapFee;
    if (swapType === 'swapExactIn') {
        return new BigNumber(1)
            .minus(swapFee)
            .times(weightIn.div(weightOut))
            .decimalPlaces(18)
            .plus(new BigNumber(1))
            .div(balanceIn);
    } else {
        return weightOut
            .div(
                new BigNumber(1)
                    .minus(swapFee)
                    .times(weightIn)
                    .decimalPlaces(18)
            )
            .plus(new BigNumber(1))
            .div(balanceOut);
    }
}

export function getSlippageLinearizedEffectivePriceSwap(
    balancer: Pool,
    swapType: string
): BigNumber {
    let weightIn = balancer.weightIn;
    let weightOut = balancer.weightOut;
    let balanceIn = balancer.balanceIn;
    let balanceOut = balancer.balanceOut;
    let swapFee = balancer.swapFee;
    if (swapType == 'swapExactIn') {
        return new BigNumber(1)
            .minus(swapFee)
            .times(weightIn.div(weightOut).plus(new BigNumber(1)))
            .decimalPlaces(18)
            .div(new BigNumber(2).times(balanceIn).decimalPlaces(18));
    } else {
        return weightOut
            .div(weightIn)
            .plus(new BigNumber(1))
            .div(new BigNumber(2).times(balanceOut).decimalPlaces(18));
    }
}

export function getLinearizedOutputAmountSwap(
    balancer: Pool,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let spotPrice: BigNumber = balancer.spotPrice;
    let slippageLinearizedEp = getSlippageLinearizedEffectivePriceSwap(
        balancer,
        swapType
    );

    if (swapType == 'swapExactIn') {
        return amount.div(
            spotPrice
                .times(
                    new BigNumber(1).plus(
                        slippageLinearizedEp.times(amount).decimalPlaces(18)
                    )
                )
                .decimalPlaces(18)
        );
    } else {
        return amount
            .times(
                spotPrice
                    .times(
                        new BigNumber(1).plus(
                            slippageLinearizedEp.times(amount).decimalPlaces(18)
                        )
                    )
                    .decimalPlaces(18)
            )
            .decimalPlaces(18);
    }
}

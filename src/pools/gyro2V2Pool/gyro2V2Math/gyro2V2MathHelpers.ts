// Same file as for gyroEV2Pool. (could just refer to that but I think this way it's cleaner)

import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { mulDown } from '../../gyroHelpers/gyroSignedFixedPoint';

export function normalizeBalances(
    balances: BigNumber[],
    decimals: number[],
    tokenRates: BigNumber[]
): BigNumber[] {
    const scalingFactors = decimals.map((d) => parseFixed('1', d));

    return balances.map((bal, index) =>
        mulDown(bal.mul(ONE).div(scalingFactors[index]), tokenRates[index])
    );
}

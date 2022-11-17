import { BigNumber } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { _SAFE_LARGE_POW3_THRESHOLD, MIDDECIMAL } from './constants';

// Helpers
export function _safeLargePow3ADown(
    l: BigNumber,
    root3Alpha: BigNumber,
    d: BigNumber
) {
    let ret = BigNumber.from(0);
    if (l.lte(_SAFE_LARGE_POW3_THRESHOLD)) {
        // Simple case where there is no overflow
        ret = l.mul(l).div(ONE).mul(l).div(ONE);
        ret = ret.sub(
            ret
                .mul(root3Alpha)
                .div(ONE)
                .mul(root3Alpha)
                .div(ONE)
                .mul(root3Alpha)
                .div(ONE)
        );
        ret = ret.mul(ONE).div(d);
    } else {
        ret = l.mul(l).div(ONE);

        // Compute l^2 * l * (1 - root3Alpha^3)
        // The following products split up the factors into different groups of decimal places to reduce temorary
        // blowup and prevent overflow.
        // No precision is lost.
        ret = ret.mul(l.div(ONE)).add(ret.mul(l.mod(ONE)).div(ONE));

        let x = ret;

        for (let i = 0; i < 3; i++) {
            x = x
                .mul(root3Alpha.div(MIDDECIMAL))
                .div(MIDDECIMAL)
                .add(x.mul(root3Alpha.mod(MIDDECIMAL)));
        }
        ret = ret.sub(x);

        // We perform half-precision division to reduce blowup.
        // In contrast to the above multiplications, this loses precision if d is small. However, tests show that,
        // for the l and d values considered here, the precision lost would be below the precision of the fixed
        // point type itself, so nothing is actually lost.
        ret = ret.mul(MIDDECIMAL).div(d.div(MIDDECIMAL));
    }
    return ret;
}

import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';

// Swap limits: amounts swapped may not be larger than this percentage of total balance.

export const _MAX_IN_RATIO: BigNumber = parseFixed('0.3', 18);
export const _MAX_OUT_RATIO: BigNumber = parseFixed('0.3', 18);
export const MAX_POW_RELATIVE_ERROR = BigNumber.from(10000);
export const LN_36_LOWER_BOUND: BigNumber = ONE.sub(ONE.div(10));
export const LN_36_UPPER_BOUND: BigNumber = ONE.add(ONE.div(10));
export const MILD_EXPONENT_BOUND = BigNumber.from(2).pow(254).div(ONE.mul(100));

// 18 decimal constants
export const x0 = BigNumber.from('128000000000000000000'); // 2ˆ7
export const a0 = BigNumber.from(
    '38877084059945950922200000000000000000000000000000000000'
); // eˆ(x0) (no decimals)
export const x1 = BigNumber.from('64000000000000000000'); // 2ˆ6
export const a1 = BigNumber.from('6235149080811616882910000000'); // eˆ(x1) (no decimals)

// 20 decimal constants
export const x2 = BigNumber.from('3200000000000000000000'); // 2ˆ5
export const a2 = BigNumber.from('7896296018268069516100000000000000'); // eˆ(x2)
export const x3 = BigNumber.from('1600000000000000000000'); // 2ˆ4
export const a3 = BigNumber.from('888611052050787263676000000'); // eˆ(x3)
export const x4 = BigNumber.from('800000000000000000000'); // 2ˆ3
export const a4 = BigNumber.from('298095798704172827474000'); // eˆ(x4)
export const x5 = BigNumber.from('400000000000000000000'); // 2ˆ2
export const a5 = BigNumber.from('5459815003314423907810'); // eˆ(x5)
export const x6 = BigNumber.from('200000000000000000000'); // 2ˆ1
export const a6 = BigNumber.from('738905609893065022723'); // eˆ(x6)
export const x7 = BigNumber.from('100000000000000000000'); // 2ˆ0
export const a7 = BigNumber.from('271828182845904523536'); // eˆ(x7)
export const x8 = BigNumber.from('50000000000000000000'); // 2ˆ-1
export const a8 = BigNumber.from('164872127070012814685'); // eˆ(x8)
export const x9 = BigNumber.from('25000000000000000000'); // 2ˆ-2
export const a9 = BigNumber.from('128402541668774148407'); // eˆ(x9)
export const x10 = BigNumber.from('12500000000000000000'); // 2ˆ-3
export const a10 = BigNumber.from('113314845306682631683'); // eˆ(x10)
export const x11 = BigNumber.from('6250000000000000000'); // 2ˆ-4
export const a11 = BigNumber.from('106449445891785942956'); // eˆ(x11)

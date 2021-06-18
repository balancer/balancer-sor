import { BigNumber } from '../utils/bignumber';
export declare function BPTForTokensZeroPriceImpact(
    allBalances: BigNumber[],
    decimals: number[],
    amounts: BigNumber[], // This has to have the same lenght as allBalances
    bptTotalSupply: BigNumber,
    amp: BigNumber
): BigNumber;

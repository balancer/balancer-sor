import { getAddress } from '@ethersproject/address';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import {
    BigNumber as OldBigNumber,
    bnum,
    scale,
    ZERO,
} from '../../utils/bignumber';
import { isSameAddress } from '../../utils';
import {
    PoolBase,
    PoolTypes,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
} from '../../types';

export enum PairTypes {
    CashTokenToSecurityToken,
    SecurityTokenToCashToken,
}

type PrimaryIssuePoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

export type PrimaryIssuePoolPairData = PoolPairBase & {
    // pairType: PairTypes;
    allBalances: OldBigNumber[];
    allBalancesScaled: BigNumber[]; // EVM Maths uses everything in 1e18 upscaled format and this avoids repeated scaling
    tokenIndexIn: number;
    tokenIndexOut: number;
    security: string;
    currency: string;
    openingPrice: string;
    maxPrice: string;
    securityOffered: string;
    cutoffTime: string;
};

export class PrimaryIssuePool implements PoolBase {
    poolType: PoolTypes = PoolTypes.PrimaryIssuePool;
    id: string;
    address: string;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: PrimaryIssuePoolToken[];
    tokensList: string[];

    security: string;
    currency: string;
    openingPrice: string;
    maxPrice: string;
    securityOffered: string;
    cutoffTime: string;

    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);

    static fromPool(pool: SubgraphPoolBase): PrimaryIssuePool {
        if (!pool.security)
            throw new Error('PrimaryIssuePool missing "security"');
        if (!pool.currency)
            throw new Error('PrimaryIssuePool missing "currency"');
        if (!pool.openingPrice)
            throw new Error('PrimaryIssuePool missing "openingPrice"');
        if (!pool.maxPrice)
            throw new Error('PrimaryIssuePool missing "maxPrice"');
        if (!pool.securityOffered)
            throw new Error('PrimaryIssuePool missing "securityOffered"');
        if (!pool.cutoffTime)
            throw new Error('PrimaryIssuePool missing "cutoffTime"');

        return new PrimaryIssuePool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList,
            pool.security,
            pool.currency,
            pool.openingPrice,
            pool.maxPrice,
            pool.securityOffered,
            pool.cutoffTime
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: PrimaryIssuePoolToken[],
        tokensList: string[],
        security: string,
        currency: string,
        openingPrice: string,
        maxPrice: string,
        securityOffered: string,
        cutoffTime: string
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.security = security;
        this.currency = currency;
        this.openingPrice = openingPrice;
        this.maxPrice = maxPrice;
        this.securityOffered = securityOffered;
        this.cutoffTime = cutoffTime;
    }

    parsePoolPairData(
        tokenIn: string,
        tokenOut: string
    ): PrimaryIssuePoolPairData {
        const tokenIndexIn = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenIndexIn];
        const balanceIn = tI.balance;
        const decimalsIn = tI.decimals;

        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];
        const balanceOut = tO.balance;
        const decimalsOut = tO.decimals;

        // Get all token balances
        const allBalances = this.tokens.map(({ balance }) => bnum(balance));
        const allBalancesScaled = this.tokens.map(({ balance }) =>
            parseFixed(balance, 18)
        );

        // let pairType: PairTypes;

        // if () { // TODO: Figure out pair type by comparing token addresses? (similar to linearPool.ts, Line 150)
        //     pairType = PairTypes.CashTokenToSecurityToken
        // } else {
        //     pairType = PairTypes.SecurityTokenToCashToken
        // }

        const poolPairData: PrimaryIssuePoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            // pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            balanceIn: parseFixed(balanceIn, decimalsIn),
            balanceOut: parseFixed(balanceOut, decimalsOut),
            swapFee: this.swapFee,
            allBalances,
            allBalancesScaled, // TO DO - Change to BigInt??
            tokenIndexIn: tokenIndexIn,
            tokenIndexOut: tokenIndexOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            security: this.security,
            currency: this.currency,
            openingPrice: this.openingPrice,
            maxPrice: this.maxPrice,
            securityOffered: this.securityOffered,
            cutoffTime: this.cutoffTime,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(
        poolPairData: PrimaryIssuePoolPairData
    ): OldBigNumber {
        // This is an approximation as the actual normalized liquidity is a lot more complicated to calculate
        return bnum(
            formatFixed(
                // poolPairData.balanceOut.mul(poolPairData.amp),
                poolPairData.decimalsOut //+ StablePool.AMP_DECIMALS
            )
        );
    }

    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): OldBigNumber {
        // We multiply ratios by 10**-18 because we are in normalized space
        // so 0.5 should be 0.5 and not 500000000000000000
        // TODO: update bmath to use everything normalized
        if (swapType === SwapTypes.SwapExactIn) {
            return bnum(
                formatFixed(
                    poolPairData.balanceIn.mul(this.MAX_IN_RATIO).div(ONE),
                    poolPairData.decimalsIn
                )
            );
        } else {
            return bnum(
                formatFixed(
                    poolPairData.balanceOut.mul(this.MAX_OUT_RATIO).div(ONE),
                    poolPairData.decimalsOut
                )
            );
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is BPT
        if (this.address == token) {
            this.totalShares = newBalance;
        } else {
            // token is underlying in the pool
            const T = this.tokens.find((t) => isSameAddress(t.address, token));
            if (!T) throw Error('Pool does not contain this token');
            T.balance = formatFixed(newBalance, T.decimals);
        }
    }

    _exactTokenInForTokenOut(
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;

            const isCashToken = true; // TODO: Add check later (Line 149)
            // const isCashToken = poolPairData.pairType === PairTypes.CashTokenToSecurityToken

            const cashTokens = parseFixed(poolPairData.currency);
            const securityTokens = parseFixed(poolPairData.security);

            let x: BigNumber, y: BigNumber;

            if (isCashToken) {
                x = cashTokens;
                y = securityTokens;
            } else {
                x = securityTokens;
                y = cashTokens;
            }

            // z = x' / ((x + x') / y)
            // where,
            // x' - tokens coming in
            // x  - total amount of tokens of the same type as the tokens coming in
            // y  - total amount of tokens of the other type
            // z  - tokens going out

            const tokensOut = amount.div(
                x.add(amount.toString()).div(y).toString()
            );

            return bnum(tokensOut);
        } catch (err) {
            console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;

            const isCashToken = true; // TODO: Add check later
            // const isCashToken = poolPairData.pairType === PairTypes.CashTokenToSecurityToken

            const cashTokens = parseFixed(poolPairData.currency);
            const securityTokens = parseFixed(poolPairData.security);

            let x: BigNumber, y: BigNumber;

            if (isCashToken) {
                x = cashTokens;
                y = securityTokens;
            } else {
                x = securityTokens;
                y = cashTokens;
            }

            // x' = xz / (y - z)
            // where,
            // x' - tokens coming in
            // x  - total amount of tokens of the same type as the tokens coming in
            // y  - total amount of tokens of the other type
            // z  - tokens going out

            const tokensIn = x
                .mul(amount.toString())
                .div(y.sub(amount.toString()))
                .toString();

            return bnum(tokensIn);
        } catch (err) {
            console.error(`_evminGivenOut: ${err.message}`);
            return ZERO;
        }
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        //return _spotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData);
        return amount;
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        //return _spotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData);
        return amount;
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        /*return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );*/
        return amount;
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        /*return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );*/
        return amount;
    }

    subtractSwapFeeAmount(amount: BigNumber, swapFee: BigNumber): BigNumber {
        // https://github.com/balancer-labs/balancer-v2-monorepo/blob/c18ff2686c61a8cbad72cdcfc65e9b11476fdbc3/pkg/pool-utils/contracts/BasePool.sol#L466
        const feeAmount = amount.mul(swapFee).add(ONE.sub(1)).div(ONE);
        return amount.sub(feeAmount);
    }

    addSwapFeeAmount(amount: BigNumber, swapFee: BigNumber): BigNumber {
        // https://github.com/balancer-labs/balancer-v2-monorepo/blob/c18ff2686c61a8cbad72cdcfc65e9b11476fdbc3/pkg/pool-utils/contracts/BasePool.sol#L458
        const feeAmount = ONE.sub(swapFee);
        return amount.mul(ONE).add(feeAmount.sub(1)).div(feeAmount);
    }
}

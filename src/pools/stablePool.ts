import { BigNumber } from '../utils/bignumber';
import { PoolBase, PoolTypes, TypesForSwap, PairTypes } from '../types';
import { getAddress } from '@ethersproject/address';
import { bnum } from '../bmath';
import * as stableMath from '../poolMath/stableMath';

export interface StablePoolToken {
    address: string;
    balance: string;
    decimals: string | number;
}

export interface StablePoolPairData {
    id: string;
    poolType: PoolTypes;
    pairType: PairTypes;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    swapFee: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
    allBalances: BigNumber[]; // Only for stable pools
    invariant: BigNumber; // Only for stable pools
    amp: BigNumber; // Only for stable pools
    tokenIndexIn: number; // Only for stable pools
    tokenIndexOut: number; // Only for stable pools
}

export class StablePool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Stable;
    typeForSwap: TypesForSwap;
    id: string;
    amp: string;
    swapFee: string;
    totalShares: string;
    tokens: StablePoolToken[];
    tokensList: string[];
    poolPairData: StablePoolPairData;

    constructor(
        id: string,
        amp: string,
        swapFee: string,
        totalShares: string,
        tokens: StablePoolToken[],
        tokensList: string[]
    ) {
        this.id = id;
        this.amp = amp;
        this.swapFee = swapFee;
        this.totalShares = totalShares;
        this.tokens = tokens;
        this.tokensList = tokensList;
    }

    setTypeForSwap(type: TypesForSwap) {
        this.typeForSwap = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): void {
        let pairType: PairTypes;
        let tI: StablePoolToken;
        let tO: StablePoolToken;
        let balanceIn: string;
        let balanceOut: string;
        let decimalsOut: string | number;
        let decimalsIn: string | number;
        let tokenIndexIn: number;
        let tokenIndexOut: number;

        // Check if tokenIn is the pool token itself (BPT)
        if (tokenIn == this.id) {
            pairType = PairTypes.BptToToken;
            balanceIn = this.totalShares;
            decimalsIn = '18'; // Not used but has to be defined
        } else if (tokenOut == this.id) {
            pairType = PairTypes.TokenToBpt;
            balanceOut = this.totalShares;
            decimalsOut = '18'; // Not used but has to be defined
        } else {
            pairType = PairTypes.TokenToToken;
        }

        if (pairType != PairTypes.BptToToken) {
            tokenIndexIn = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenIn)
            );
            if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
            tI = this.tokens[tokenIndexIn];
            balanceIn = tI.balance;
            decimalsIn = tI.decimals;
        }
        if (pairType != PairTypes.TokenToBpt) {
            tokenIndexOut = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenOut)
            );
            if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
            tO = this.tokens[tokenIndexOut];
            balanceOut = tO.balance;
            decimalsOut = tO.decimals;
        }

        // Get all token balances
        let allBalances = [];
        for (let i = 0; i < this.tokens.length; i++) {
            allBalances.push(bnum(this.tokens[i].balance));
        }

        let inv = stableMath._invariant(bnum(this.amp), allBalances);

        const poolPairData: StablePoolPairData = {
            id: this.id,
            poolType: this.poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            balanceIn: bnum(balanceIn),
            balanceOut: bnum(balanceOut),
            invariant: inv,
            swapFee: bnum(this.swapFee),
            allBalances: allBalances,
            amp: bnum(this.amp),
            tokenIndexIn: tokenIndexIn,
            tokenIndexOut: tokenIndexOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
        };

        this.poolPairData = poolPairData;
    }

    getNormalizedLiquidity() {
        // This is an approximation as the actual normalized liquidity is a lot more complicated to calculate
        return this.poolPairData.balanceOut.times(this.poolPairData.amp);
    }
}

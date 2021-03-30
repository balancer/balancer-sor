import { BigNumber } from '../utils/bignumber';
import { PoolBase, PoolTypes, TypesForSwap, PairTypes } from '../types';
import { getAddress } from '@ethersproject/address';
import { bnum } from '../bmath';

export interface WeightedPoolToken {
    address: string;
    balance: string;
    decimals: string | number;
    denormWeight?: string;
}

export interface WeightedPoolPairData {
    id: string;
    poolType: PoolTypes;
    pairType: PairTypes;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    weightIn: BigNumber; // Weights are only defined for weighted pools
    weightOut: BigNumber; // Weights are only defined for weighted pools
    swapFee: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
}

export class WeightedPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Weighted;
    typeForSwap: TypesForSwap;
    id: string;
    swapFee: string;
    totalShares: string;
    tokens: WeightedPoolToken[];
    totalWeight: string;
    poolPairData: WeightedPoolPairData;

    constructor(
        id: string,
        swapFee: string,
        totalWeight: string,
        totalShares: string,
        tokens: WeightedPoolToken[]
    ) {
        this.id = id;
        this.swapFee = swapFee;
        this.totalShares = totalShares;
        this.tokens = tokens;
        this.totalWeight = totalWeight;
    }

    setTypeForSwap(type: TypesForSwap) {
        this.typeForSwap = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): void {
        let pairType: PairTypes;
        let tI: WeightedPoolToken;
        let tO: WeightedPoolToken;
        let balanceIn: string;
        let balanceOut: string;
        let decimalsOut: string | number;
        let decimalsIn: string | number;
        let weightIn: BigNumber;
        let weightOut: BigNumber;

        // Check if tokenIn is the pool token itself (BPT)
        if (tokenIn == this.id) {
            pairType = PairTypes.BptToToken;
            balanceIn = this.totalShares;
            decimalsIn = '18'; // Not used but has to be defined
            weightIn = bnum(1); // Not used but has to be defined
        } else if (tokenOut == this.id) {
            pairType = PairTypes.TokenToBpt;
            balanceOut = this.totalShares;
            decimalsOut = '18'; // Not used but has to be defined
            weightOut = bnum(1); // Not used but has to be defined
        } else {
            pairType = PairTypes.TokenToToken;
        }

        if (pairType != PairTypes.BptToToken) {
            let tokenIndexIn = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenIn)
            );
            if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
            tI = this.tokens[tokenIndexIn];
            balanceIn = tI.balance;
            decimalsIn = tI.decimals;
            weightIn = bnum(tI.denormWeight).div(bnum(this.totalWeight));
        }
        if (pairType != PairTypes.TokenToBpt) {
            let tokenIndexOut = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenOut)
            );
            if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
            tO = this.tokens[tokenIndexOut];
            balanceOut = tO.balance;
            decimalsOut = tO.decimals;
            weightOut = bnum(tO.denormWeight).div(bnum(this.totalWeight));
        }

        const poolPairData: WeightedPoolPairData = {
            id: this.id,
            poolType: this.poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: bnum(balanceIn),
            balanceOut: bnum(balanceOut),
            weightIn: weightIn,
            weightOut: weightOut,
            swapFee: bnum(this.swapFee),
        };

        this.poolPairData = poolPairData;
    }
}

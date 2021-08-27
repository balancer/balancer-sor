"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bmath_1 = require("./bmath");
const multicaller_1 = require("./utils/multicaller");
const lodash_1 = __importDefault(require("lodash"));
// Load pools data with multicalls
function getOnChainBalances(subgraphPools, multiAddress, vaultAddress, provider) {
    return __awaiter(this, void 0, void 0, function* () {
        if (subgraphPools.pools.length === 0)
            return subgraphPools;
        const vaultAbi = require('./abi/Vault.json');
        const weightedPoolAbi = require('./pools/weightedPool/weightedPoolAbi.json');
        const stablePoolAbi = require('./pools/stablePool/stablePoolAbi.json');
        const elementPoolAbi = require('./pools/elementPool/ConvergentCurvePool.json');
        const abis = Object.values(Object.fromEntries([
            ...vaultAbi,
            ...weightedPoolAbi,
            ...stablePoolAbi,
            ...elementPoolAbi,
        ].map(row => [row.name, row])));
        const multiPool = new multicaller_1.Multicaller(multiAddress, provider, abis);
        let pools = {};
        subgraphPools.pools.forEach((pool, i) => {
            // TO DO - This is a temp filter
            if (pool.id ===
                '0x6b15a01b5d46a5321b627bd7deef1af57bc629070000000000000000000000d4')
                subgraphPools.pools.splice(i, 1);
            lodash_1.default.set(pools, `${pool.id}.id`, pool.id);
            multiPool.call(`${pool.id}.poolTokens`, vaultAddress, 'getPoolTokens', [
                pool.id,
            ]);
            multiPool.call(`${pool.id}.totalSupply`, pool.address, 'totalSupply');
            // TO DO - Make this part of class to make more flexible?
            if (pool.poolType === 'Weighted') {
                multiPool.call(`${pool.id}.weights`, pool.address, 'getNormalizedWeights', []);
                multiPool.call(`${pool.id}.swapFee`, pool.address, 'getSwapFeePercentage');
            }
            else if (pool.poolType === 'Stable' ||
                pool.poolType === 'MetaStable') {
                // MetaStable is the same as Stable for multicall purposes
                multiPool.call(`${pool.id}.amp`, pool.address, 'getAmplificationParameter');
                multiPool.call(`${pool.id}.swapFee`, pool.address, 'getSwapFeePercentage');
            }
            else if (pool.poolType === 'Element') {
                multiPool.call(`${pool.id}.swapFee`, pool.address, 'percentFee');
            }
        });
        pools = yield multiPool.execute(pools);
        subgraphPools.pools.forEach(subgraphPool => {
            const onChainResult = pools[subgraphPool.id];
            try {
                subgraphPool.swapFee = bmath_1.scale(bmath_1.bnum(onChainResult.swapFee), -18).toString();
                onChainResult.poolTokens.tokens.forEach((token, i) => {
                    const tokenAddress = onChainResult.poolTokens.tokens[i]
                        .toString()
                        .toLowerCase();
                    const T = subgraphPool.tokens.find(t => t.address === tokenAddress);
                    const balance = bmath_1.scale(bmath_1.bnum(onChainResult.poolTokens.balances[i]), -Number(T.decimals)).toString();
                    T.balance = balance;
                    if (subgraphPool.poolType === 'Weighted')
                        T.weight = bmath_1.scale(bmath_1.bnum(onChainResult.weights[i]), -18).toString();
                });
            }
            catch (err) {
                // Likely an unsupported pool type
                // console.log(`Issue with pool onchain call`)
                // console.log(subgraphPool.id);
                // console.log(onChainResult);
            }
        });
        return subgraphPools;
    });
}
exports.getOnChainBalances = getOnChainBalances;

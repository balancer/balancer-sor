// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { mockTokenPriceService } from './lib/mockTokenPriceService';
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SOR } from '../src';
import { SwapInfo, SwapTypes, PoolTypes, SubgraphPoolBase } from '../src';
import { bnum } from '../src/utils/bignumber';
import {
    MetaStablePool,
    MetaStablePoolPairData,
} from '../src/pools/metaStablePool/metaStablePool';
import { BAL, sorConfigEth, USDC, WETH } from './lib/constants';
import { MockPoolDataService } from './lib/mockPoolDataService';

const gasPrice = parseFixed('30', 9);
const maxPools = 4;
const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

// const BPT = '0xebfed10e11dc08fcda1af1fda146945e8710f22e';
const stETH = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84';
const randomETH = '0x42d6622dece394b54999fbd73d108123806f6a18';
// const PTSP = '0x5f304f6cf88dc76b414f301e05adfb5a429e8b67';

async function getStableComparrison(
    stablePools: SubgraphPoolBase[],
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    swapAmt: BigNumber
): Promise<SwapInfo> {
    const sorStable = new SOR(
        provider,
        sorConfigEth,
        new MockPoolDataService(stablePools),
        mockTokenPriceService
    );
    await sorStable.fetchPools();

    const swapInfoStable: SwapInfo = await sorStable.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        swapAmt,
        {
            gasPrice,
            maxPools,
        }
    );

    return swapInfoStable;
}

// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/metaStablePools.spec.ts
describe(`Tests for MetaStable Pools.`, () => {
    context('limit amounts', () => {
        it(`tests getLimitAmountSwap SwapExactIn`, async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pool = cloneDeep(poolsFromFile.metaStablePool[0]);
            const swapType = SwapTypes.SwapExactIn;

            // Max out uses standard V2 limits
            const MAX_OUT_RATIO = bnum(0.3);

            const newPool = new MetaStablePool(
                pool.id,
                pool.address,
                pool.amp,
                pool.swapFee,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );

            const poolPairData: MetaStablePoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Stable,
                tokenIn: pool.tokens[0].address,
                tokenOut: pool.tokens[1].address,
                balanceIn: parseFixed(
                    pool.tokens[0].balance,
                    pool.tokens[0].decimals
                ),
                balanceOut: parseFixed(
                    pool.tokens[1].balance,
                    pool.tokens[1].decimals
                ),
                swapFee: parseFixed(pool.swapFee, 18),
                decimalsIn: Number(pool.tokens[0].decimals),
                decimalsOut: Number(pool.tokens[1].decimals),
                amp: BigNumber.from(pool.amp),
                allBalances: [
                    bnum(pool.tokens[0].balance),
                    bnum(pool.tokens[1].balance),
                ],
                allBalancesScaled: [
                    parseFixed(pool.tokens[0].balance, 18),
                    parseFixed(pool.tokens[1].balance, 18),
                ],
                invariant: bnum(0),
                tokenIndexIn: 0,
                tokenIndexOut: 1,
                tokenInPriceRate: parseFixed(pool.tokens[0].priceRate, 18),
                tokenOutPriceRate: parseFixed(pool.tokens[1].priceRate, 18),
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[0].balance).times(MAX_OUT_RATIO).toString()
            );
        });

        it(`tests getLimitAmountSwap SwapExactOut`, async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pool = cloneDeep(poolsFromFile.metaStablePool[0]);
            const swapType = SwapTypes.SwapExactOut;

            // Max out uses standard V2 limits
            const MAX_OUT_RATIO = bnum(0.3);

            const newPool = new MetaStablePool(
                pool.id,
                pool.address,
                pool.amp,
                pool.swapFee,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );

            const poolPairData: MetaStablePoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Stable,
                tokenIn: pool.tokens[0].address,
                tokenOut: pool.tokens[1].address,
                balanceIn: parseFixed(
                    pool.tokens[0].balance,
                    pool.tokens[0].decimals
                ),
                balanceOut: parseFixed(
                    pool.tokens[1].balance,
                    pool.tokens[1].decimals
                ),
                swapFee: parseFixed(pool.swapFee, 18),
                decimalsIn: Number(pool.tokens[0].decimals),
                decimalsOut: Number(pool.tokens[1].decimals),
                amp: BigNumber.from(pool.amp),
                allBalances: [],
                allBalancesScaled: [],
                invariant: bnum(0),
                tokenIndexIn: 0,
                tokenIndexOut: 1,
                tokenInPriceRate: parseFixed(pool.tokens[0].priceRate, 18),
                tokenOutPriceRate: parseFixed(pool.tokens[1].priceRate, 18),
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[1].balance)
                    .div(bnum(pool.tokens[1].priceRate))
                    .times(MAX_OUT_RATIO)
                    .toString()
            );
        });
    });

    context('direct pool', () => {
        it(`Full Swap - swapExactIn No Route`, async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pools: SubgraphPoolBase[] = cloneDeep(
                poolsFromFile.metaStablePool
            );
            const tokenIn = BAL.address;
            const tokenOut = USDC.address;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );

            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.returnAmount.toString()).eq('0');
            expect(swapInfo.swaps.length).eq(0);
        });

        it(`Full Swap - swapExactOut No Route`, async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pools: SubgraphPoolBase[] = cloneDeep(
                poolsFromFile.metaStablePool
            );
            const tokenIn = BAL.address;
            const tokenOut = USDC.address;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = parseFixed('1', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );

            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.returnAmount.toString()).eq('0');
            expect(swapInfo.swaps.length).eq(0);
        });

        it(`Full Swap - swapExactIn, Token ETH >Token Meta`, async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pools: SubgraphPoolBase[] = cloneDeep(
                poolsFromFile.metaStablePool
            );
            const tokenIn = WETH.address;
            const tokenInPriceRate = ONE;
            const tokenOut = stETH;
            const tokenOutPriceRate = ONE.div(2);
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 18); // Would expect ~ 2 back

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );

            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            const stablePools: SubgraphPoolBase[] = poolsFromFile.stablePool;

            const swapInfoStable = await getStableComparrison(
                stablePools,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt.mul(tokenInPriceRate).div(ONE)
            );

            expect(swapInfoStable.tokenAddresses).to.deep.eq(
                swapInfo.tokenAddresses
            );
            expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
            expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
            // Would expect stable to be half of amounts, i.e. 2stETH = 1ETH
            expect(swapInfoStable.returnAmount.toString()).eq(
                swapInfo.returnAmount.mul(tokenOutPriceRate).div(ONE).toString()
            );
            expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
                swapInfo.returnAmountConsideringFees
                    .mul(tokenOutPriceRate)
                    .div(ONE)
                    .toString()
            );
            expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
            swapInfoStable.swaps.forEach((swapStable, i) => {
                expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
                expect(swapStable.assetInIndex).eq(
                    swapInfo.swaps[i].assetInIndex
                );
                expect(swapStable.assetOutIndex).eq(
                    swapInfo.swaps[i].assetOutIndex
                );
                expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
                expect(swapStable.amount).eq(
                    BigNumber.from(swapInfo.swaps[i].amount)
                        .mul(tokenInPriceRate)
                        .div(ONE)
                        .toString()
                );
            });
        }).timeout(10000);

        it(`Full Swap - swapExactIn, Token Meta > Token ETH`, async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pools: SubgraphPoolBase[] = cloneDeep(
                poolsFromFile.metaStablePool
            );
            const tokenIn = stETH;
            const tokenInPriceRate = ONE.div(2);
            const tokenOut = WETH.address;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 18); // Would expect ~ 1 back

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );

            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            const stablePools: SubgraphPoolBase[] = poolsFromFile.stablePool;

            // Should be same as a 1/1 stable pool with swapAmt * priceRate, i.e swapAmt = 1 in this case
            const swapInfoStable = await getStableComparrison(
                stablePools,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt.mul(tokenInPriceRate).div(ONE)
            );

            expect(swapInfoStable.tokenAddresses).to.deep.eq(
                swapInfo.tokenAddresses
            );
            expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
            expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
            expect(swapInfoStable.returnAmount.toString()).eq(
                swapInfo.returnAmount.toString()
            );
            expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
                swapInfo.returnAmountConsideringFees.toString()
            );
            expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
            swapInfoStable.swaps.forEach((swapStable, i) => {
                expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
                expect(swapStable.assetInIndex).eq(
                    swapInfo.swaps[i].assetInIndex
                );
                expect(swapStable.assetOutIndex).eq(
                    swapInfo.swaps[i].assetOutIndex
                );
                expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
                expect(swapStable.amount).eq(
                    BigNumber.from(swapInfo.swaps[i].amount)
                        .mul(tokenInPriceRate)
                        .div(ONE)
                        .toString()
                );
            });
        }).timeout(10000);

        it(`Full Swap - swapExactOut, Token ETH >Token Meta`, async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pools: SubgraphPoolBase[] = cloneDeep(
                poolsFromFile.metaStablePool
            );
            const tokenIn = WETH.address;
            const tokenOut = stETH;
            const tokenOutPriceRate = ONE.div(2);
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = parseFixed('2', 18); // Would expect ~ 1 as input

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );

            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            const stablePools: SubgraphPoolBase[] = poolsFromFile.stablePool;

            const swapInfoStable = await getStableComparrison(
                stablePools,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt.mul(tokenOutPriceRate).div(ONE)
            );

            expect(swapInfoStable.tokenAddresses).to.deep.eq(
                swapInfo.tokenAddresses
            );
            expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
            expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
            expect(swapInfoStable.returnAmount.toString()).eq(
                swapInfo.returnAmount.toString()
            );
            expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
                swapInfo.returnAmountConsideringFees.toString()
            );
            expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
            swapInfoStable.swaps.forEach((swapStable, i) => {
                expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
                expect(swapStable.assetInIndex).eq(
                    swapInfo.swaps[i].assetInIndex
                );
                expect(swapStable.assetOutIndex).eq(
                    swapInfo.swaps[i].assetOutIndex
                );
                expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
                expect(swapStable.amount).eq(
                    BigNumber.from(swapInfo.swaps[i].amount)
                        .mul(tokenOutPriceRate)
                        .div(ONE)
                        .toString()
                );
            });
        }).timeout(10000);

        it(`Full Swap - swapExactOut, Token Meta > Token ETH`, async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pools: SubgraphPoolBase[] = cloneDeep(
                poolsFromFile.metaStablePool
            );
            const tokenIn = stETH;
            const tokenInPriceRate = ONE.div(2);
            const tokenOut = WETH.address;
            const tokenOutPriceRate = ONE;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = parseFixed('2', 18); // Would expect ~ 4 as input

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );

            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            const stablePools: SubgraphPoolBase[] = poolsFromFile.stablePool;

            const swapInfoStable = await getStableComparrison(
                stablePools,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt.mul(tokenOutPriceRate).div(ONE)
            );

            expect(swapInfoStable.tokenAddresses).to.deep.eq(
                swapInfo.tokenAddresses
            );
            expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
            expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
            expect(swapInfoStable.returnAmount.toString()).eq(
                swapInfo.returnAmount.mul(tokenInPriceRate).div(ONE).toString()
            );
            expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
                swapInfo.returnAmountConsideringFees
                    .mul(tokenInPriceRate)
                    .div(ONE)
                    .toString()
            );
            expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
            swapInfoStable.swaps.forEach((swapStable, i) => {
                expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
                expect(swapStable.assetInIndex).eq(
                    swapInfo.swaps[i].assetInIndex
                );
                expect(swapStable.assetOutIndex).eq(
                    swapInfo.swaps[i].assetOutIndex
                );
                expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
                expect(swapStable.amount).eq(
                    BigNumber.from(swapInfo.swaps[i].amount)
                        .mul(tokenOutPriceRate)
                        .div(ONE)
                        .toString()
                );
            });
        }).timeout(10000);
    });

    context('multihop', () => {
        it(`Full Swap - swapExactIn, Token>Token`, async () => {
            // With meta token as hop the result in/out should be same as a normal stable pool
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const poolsFromFile = require('./testData/metaStablePools/multihop.json');
            const pools: SubgraphPoolBase[] = cloneDeep(
                poolsFromFile.metaStablePools
            );
            const tokenIn = WETH.address;
            const tokenInPriceRate = ONE;
            const tokenOut = randomETH;
            const tokenOutPriceRate = ONE;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('77.723', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );

            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            const stablePools: SubgraphPoolBase[] = poolsFromFile.stablePools;
            // Same as stable with
            const swapInfoStable = await getStableComparrison(
                stablePools,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt.mul(tokenInPriceRate).div(ONE)
            );

            expect(swapInfoStable.tokenAddresses).to.deep.eq(
                swapInfo.tokenAddresses
            );
            expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
            expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
            // These should match as should
            expect(swapInfoStable.returnAmount.toString()).eq(
                swapInfo.returnAmount.toString()
            );
            expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
                swapInfo.returnAmountConsideringFees
                    .mul(tokenOutPriceRate)
                    .div(ONE)
                    .toString()
            );
            expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
            swapInfoStable.swaps.forEach((swapStable, i) => {
                expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
                expect(swapStable.assetInIndex).eq(
                    swapInfo.swaps[i].assetInIndex
                );
                expect(swapStable.assetOutIndex).eq(
                    swapInfo.swaps[i].assetOutIndex
                );
                expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
                expect(swapStable.amount).eq(
                    BigNumber.from(swapInfo.swaps[i].amount)
                        .mul(tokenInPriceRate)
                        .div(ONE)
                        .toString()
                );
            });
        });

        it(`Full Swap - swapExactOut, Token>Token`, async () => {
            // With meta token as hop the result in/out should be same as a normal stable pool
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const poolsFromFile = require('./testData/metaStablePools/multihop.json');
            const pools: SubgraphPoolBase[] = cloneDeep(
                poolsFromFile.metaStablePools
            );
            const tokenIn = WETH.address;
            const tokenInPriceRate = ONE;
            const tokenOut = randomETH;
            const tokenOutPriceRate = ONE;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = parseFixed('77.8', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );

            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            const stablePools: SubgraphPoolBase[] = poolsFromFile.stablePools;

            // Same as stable with
            const swapInfoStable = await getStableComparrison(
                stablePools,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt.mul(tokenInPriceRate).div(ONE)
            );

            expect(swapInfoStable.tokenAddresses).to.deep.eq(
                swapInfo.tokenAddresses
            );
            expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
            expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
            // These should match as should
            expect(swapInfoStable.returnAmount.toString()).eq(
                swapInfo.returnAmount.toString()
            );
            expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
                swapInfo.returnAmountConsideringFees
                    .mul(tokenOutPriceRate)
                    .div(ONE)
                    .toString()
            );
            expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
            swapInfoStable.swaps.forEach((swapStable, i) => {
                expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
                expect(swapStable.assetInIndex).eq(
                    swapInfo.swaps[i].assetInIndex
                );
                expect(swapStable.assetOutIndex).eq(
                    swapInfo.swaps[i].assetOutIndex
                );
                expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
                expect(swapStable.amount).eq(
                    BigNumber.from(swapInfo.swaps[i].amount)
                        .mul(tokenInPriceRate)
                        .div(ONE)
                        .toString()
                );
            });
        });

        // This replicates Kovan pool with Convergence issue.
        // it(`Full Swap - swapExactIn, Token>Token via Stable & Meta Pools`, async () => {
        //     // With meta token as hop the result in/out should be same as a normal stable pool
        //     const poolsFromFile = require('./testData/metaStablePools/multihop.json');
        //     const pools: SubGraphPoolsBase = {
        //         pools: JSON.parse(
        //             JSON.stringify(poolsFromFile.metaWithStable2)
        //         ),
        //     };
        //     const tokenIn = DAI.address;
        //     const tokenInPriceRate = bnum(1);
        //     const tokenHop = USDC.address;
        //     const tokenHopPriceRate = bnum(1);
        //     const tokenOut = PTSP;
        //     const tokenOutPriceRate = bnum('1.00239199558952863');
        //     const swapType = SwapTypes.SwapExactIn;
        //     const swapAmt: BigNumber = bnum('1');

        //     const sor = new SOR(provider, gasPrice, maxPools, chainId, pools);

        //     const fetchSuccess = await sor.fetchPools([],false);
        //     expect(fetchSuccess).to.be.true;

        //     let swapInfo: SwapInfo = await sor.getSwaps(
        //         tokenIn,
        //         tokenOut,
        //         swapType,
        //         swapAmt
        //     );

        //     console.log(swapInfo.returnAmount.toString());
        //     console.log(swapInfo.returnAmountConsideringFees.toString());
        //     console.log(swapInfo.swaps);

        //     // const stablePools: SubGraphPoolsBase = {
        //     //     pools: poolsFromFile.stablePools,
        //     // };
        //     // // Same as stable with
        //     // const swapInfoStable = await getStableComparrison(
        //     //     stablePools,
        //     //     tokenIn,
        //     //     tokenOut,
        //     //     swapType,
        //     //     swapAmt.times(tokenInPriceRate)
        //     // );

        //     // expect(swapInfoStable.tokenAddresses).to.deep.eq(
        //     //     swapInfo.tokenAddresses
        //     // );
        //     // expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
        //     // expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
        //     // // These should match as should
        //     // expect(swapInfoStable.returnAmount.toString()).eq(
        //     //     swapInfo.returnAmount.toString()
        //     // );
        //     // expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
        //     //     swapInfo.returnAmountConsideringFees
        //     //         .times(tokenOutPriceRate)
        //     //         .toString()
        //     // );
        //     // expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
        //     // swapInfoStable.swaps.forEach((swapStable, i) => {
        //     //     expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
        //     //     expect(swapStable.assetInIndex).eq(
        //     //         swapInfo.swaps[i].assetInIndex
        //     //     );
        //     //     expect(swapStable.assetOutIndex).eq(
        //     //         swapInfo.swaps[i].assetOutIndex
        //     //     );
        //     //     expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
        //     //     expect(swapStable.amount).eq(
        //     //         bnum(swapInfo.swaps[i].amount)
        //     //             .times(tokenInPriceRate)
        //     //             .toString()
        //     //     );
        //     // });
        // });
    });
});

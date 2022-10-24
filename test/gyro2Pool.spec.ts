import 'dotenv/config';
// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/gyro2Pool.spec.ts
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { formatFixed, parseFixed, BigNumber } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { bnum } from '../src/utils/bignumber';
import { USDC, DAI, sorConfigEth } from './lib/constants';
import { SwapTypes, SOR, SwapInfo } from '../src';
// Add new PoolType
import { Gyro2Pool } from '../src/pools/gyro2Pool/gyro2Pool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/gyro2Pools/gyro2TestPool.json';
import { MockPoolDataService } from './lib/mockPoolDataService';
import { mockTokenPriceService } from './lib/mockTokenPriceService';

describe('Gyro2Pool tests USDC > DAI', () => {
    const testPool = cloneDeep(testPools).pools[0];
    const pool = Gyro2Pool.fromPool(testPool);

    const poolPairData = pool.parsePoolPairData(USDC.address, DAI.address);

    const poolPairData2 = pool.parsePoolPairData(DAI.address, USDC.address);

    context('parsePoolPairData', () => {
        it(`should correctly parse USDC > DAI`, async () => {
            // Tests that compare poolPairData to known results with correct number scaling, etc, i.e.:
            expect(poolPairData.swapFee.toString()).to.eq(
                parseFixed(testPool.swapFee, 18).toString()
            );
            expect(poolPairData.id).to.eq(testPool.id);
        });

        it(`should correctly calculate price bounds USDC > DAI`, async () => {
            expect(
                Number(formatFixed(poolPairData.sqrtAlpha, 18))
            ).to.be.approximately(0.9995003747, 0.00000001);

            expect(
                Number(formatFixed(poolPairData.sqrtBeta, 18))
            ).to.be.approximately(1.000500375, 0.00000001);
        });

        it(`should correctly calculate price bounds DAI > USDC`, async () => {
            expect(
                Number(formatFixed(poolPairData2.sqrtAlpha, 18))
            ).to.be.approximately(0.9994998749, 0.00000001);

            expect(
                Number(formatFixed(poolPairData2.sqrtBeta, 18))
            ).to.be.approximately(1.000499875, 0.00000001);
        });
    });

    context('limit amounts', () => {
        it(`should correctly calculate limit amounts, USDC > DAI`, async () => {
            let amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactIn
            );

            expect(amount.toString()).to.eq('300');

            amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactOut
            );

            expect(amount.toString()).to.eq('369.6');
        });
    });

    context('normalized liquidity', () => {
        it(`should correctly calculate normalized liquidity, USDC > DAI`, async () => {
            const normalizedLiquidity =
                pool.getNormalizedLiquidity(poolPairData);

            expect(Number(normalizedLiquidity.toString())).to.be.approximately(
                1116333.916257166990921337,
                0.00001
            );
        });

        it(`should correctly calculate normalized liquidity, DAI > USDC`, async () => {
            const normalizedLiquidity =
                pool.getNormalizedLiquidity(poolPairData2);

            expect(Number(normalizedLiquidity.toString())).to.be.approximately(
                1116217.358286598731855228,
                0.00001
            );
        });
    });

    context('Test Swaps', () => {
        context('SwapExactIn', () => {
            const amountIn = bnum('13.5');

            it('should correctly calculate amountOut given amountIn', async () => {
                const amountOut = pool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                expect(amountOut.toString()).to.eq('13.379816831223414577');
            });
            it('should correctly calculate newSpotPrice', async () => {
                const newSpotPrice =
                    pool._spotPriceAfterSwapExactTokenInForTokenOut(
                        poolPairData,
                        amountIn
                    );
                expect(newSpotPrice.toString()).to.eq('1.008988469190824523');
            });
            it('should correctly calculate derivative of spot price function at newSpotPrice', async () => {
                const derivative =
                    pool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                        poolPairData,
                        amountIn
                    );
                expect(derivative.toString()).to.eq('0.000000895794688507');
            });
        });

        context('SwapExactOut', () => {
            const amountOut = bnum('45.568');

            it('should correctly calculate amountIn given amountOut', async () => {
                const amountIn = pool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
                expect(amountIn.toString()).to.eq('45.977973896504501314');
            });
            it('should correctly calculate newSpotPrice', async () => {
                const newSpotPrice =
                    pool._spotPriceAfterSwapTokenInForExactTokenOut(
                        poolPairData,
                        amountOut
                    );
                expect(newSpotPrice.toString()).to.eq('1.00901756299705875');
            });
            it('should correctly calculate derivative of spot price function at newSpotPrice', async () => {
                const derivative =
                    pool._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                        poolPairData,
                        amountOut
                    );
                expect(derivative.toString()).to.eq('0.000000903885604863');
            });
        });

        context('FullSwap', () => {
            it(`Full Swap - swapExactIn, Token>Token`, async () => {
                const pools: any = cloneDeep(testPools.pools);
                const tokenIn = USDC.address;
                const tokenOut = DAI.address;
                const swapType = SwapTypes.SwapExactIn;
                const swapAmt = parseFixed('13.5', 6);

                const gasPrice = parseFixed('30', 9);
                const maxPools = 4;
                const provider = new JsonRpcProvider(
                    `https://mainnet.infura.io/v3/${process.env.INFURA}`
                );

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

                console.log(`Return amt:`);
                console.log(swapInfo.returnAmount.toString());
                // This value is hard coded as sanity check if things unexpectedly change. Taken from V2 test run (with extra fee logic added).
                // TO DO - expect(swapInfo.returnAmount.toString()).eq('999603');
                expect(swapInfo.swaps.length).eq(1);
                expect(swapInfo.swaps[0].amount.toString()).eq(
                    swapAmt.toString()
                );
                expect(swapInfo.swaps[0].poolId).eq(testPools.pools[0].id);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
                ).eq(tokenIn);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
                ).eq(tokenOut);
            });
        });
    });
});

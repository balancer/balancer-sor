import { expect, assert } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { JsonRpcProvider } from '@ethersproject/providers';
import { parseFixed, BigNumber } from '@ethersproject/bignumber';
import { getFullSwap, getTotalSwapAmount } from './lib/testHelpers';
import { bnum } from '../src/utils/bignumber';
import { PhantomStablePool } from '../src/pools/phantomStablePool/phantomStablePool';
import {
    WETH,
    MKR,
    stETH,
    LINEAR_AUSDT,
    STABAL3PHANTOM,
    LINEAR_ADAI,
} from './lib/constants';
import poolsFromFile from './testData/phantomStablePools/phantomStablePool.json';
import { SubgraphPoolBase, SwapTypes } from '../src';

const pool = poolsFromFile.phantomStablePool[0] as SubgraphPoolBase;

// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/phantomStablePools.spec.ts
describe(`Tests for PhantomStable Pools.`, () => {
    /**
     PhantomStablePools use the same underlying maths, etc as normal Stable Pools.
    **/
    it('Test removeBPT', () => {
        const metaStableBptSwapPool = PhantomStablePool.fromPool(
            cloneDeep(pool)
        );
        // const poolPairData = metaStableBptSwapPool.parsePoolPairData(
        const poolPairDataNoBPT = metaStableBptSwapPool.parsePoolPairData(
            MKR.address,
            stETH.address
        );

        expect(poolPairDataNoBPT.tokenIndexIn).to.eq(2);
        expect(poolPairDataNoBPT.tokenIndexOut).to.eq(1);
        expect(poolPairDataNoBPT.allBalances).to.deep.eq([
            bnum(10),
            bnum(1000),
            bnum(300),
        ]);

        const balances = poolPairDataNoBPT.allBalances;
        const expectedallBalancesScaled = balances.map((balance) =>
            parseFixed(balance.toString(), 18)
        );
        expect(poolPairDataNoBPT.allBalancesScaled).to.deep.eq(
            expectedallBalancesScaled
        );
    });

    it('Test removeBPT', () => {
        const metaStableBptSwapPool = PhantomStablePool.fromPool(
            cloneDeep(pool)
        );
        const poolPairDataNoBPT = metaStableBptSwapPool.parsePoolPairData(
            MKR.address,
            WETH.address
        );

        expect(poolPairDataNoBPT.tokenIndexIn).to.eq(2);
        expect(poolPairDataNoBPT.tokenIndexOut).to.eq(0);
        expect(poolPairDataNoBPT.allBalances).to.deep.eq([
            bnum(10),
            bnum(1000),
            bnum(300),
        ]);

        const balances = poolPairDataNoBPT.allBalances;
        const expectedallBalancesScaled = balances.map((balance) =>
            parseFixed(balance.toString(), 18)
        );
        expect(poolPairDataNoBPT.allBalancesScaled).to.deep.eq(
            expectedallBalancesScaled
        );
    });

    context('Full Swaps', () => {
        let pool;
        beforeEach(() => {
            pool = cloneDeep(poolsFromFile.STABAL3[0]) as SubgraphPoolBase;
        });

        it('Token>Token, SwapExactIn', async () => {
            const returnAmount = await testFullSwap(
                LINEAR_AUSDT.address,
                STABAL3PHANTOM.address,
                SwapTypes.SwapExactIn,
                parseFixed('0.010001000098489046', 18),
                [pool]
            );
            expect(returnAmount).to.eq('9901097957797894');
        });

        it('Token>BPT, SwapExactIn', async () => {
            const returnAmount = await testFullSwap(
                LINEAR_AUSDT.address,
                STABAL3PHANTOM.address,
                SwapTypes.SwapExactIn,
                parseFixed('0.010001000098489046', 18),
                [pool]
            );
            expect(returnAmount).to.eq('9901097957797894');
        });

        it('BPT>Token, SwapExactIn', async () => {
            const returnAmount = await testFullSwap(
                LINEAR_ADAI.address,
                LINEAR_AUSDT.address,
                SwapTypes.SwapExactIn,
                parseFixed('10.2563', 18),
                [pool]
            );
            expect(returnAmount).to.eq('10153428718607272909');
        });
    });
});

const chainId = 42;

async function testFullSwap(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    swapAmount: BigNumber,
    pools: SubgraphPoolBase[]
) {
    const returnAmountDecimals = 18; // TO DO Remove?
    const maxPools = 4;
    // const costOutputToken = BigNumber.from('1000000000000000000');
    const costOutputToken = BigNumber.from('0');
    const gasPrice = BigNumber.from(`10000000000`);
    const provider = new JsonRpcProvider(
        `https://kovan.infura.io/v3/${process.env.INFURA}`
    );
    const swapGas = BigNumber.from(`32500`);

    const swapInfo = await getFullSwap(
        cloneDeep(pools),
        tokenIn,
        tokenOut,
        returnAmountDecimals,
        maxPools,
        swapType,
        swapAmount,
        costOutputToken,
        gasPrice,
        provider,
        swapGas,
        chainId
    );

    const totalSwapAmount = getTotalSwapAmount(swapType, swapInfo);

    console.log(swapInfo.swaps);
    console.log(swapInfo.tokenAddresses);
    console.log(`Return: ${swapInfo.returnAmount.toString()}`);
    console.log(
        `ReturnFees: ${swapInfo.returnAmountConsideringFees.toString()}`
    );
    assert.equal(
        swapAmount.toString(),
        totalSwapAmount.toString(),
        'Total From SwapInfo Should Equal Swap Amount.'
    );
    return swapInfo.returnAmount.toString();
}

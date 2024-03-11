// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/fullSwaps.spec.ts
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { Zero } from '@ethersproject/constants';
import { JsonRpcProvider } from '@ethersproject/providers';
import cloneDeep from 'lodash.clonedeep';
import { assert } from 'chai';
import { SubgraphPoolBase, SwapTypes } from '../src/types';
import { getFullSwap } from './lib/testHelpers';

import subgraphPoolsLarge from './testData/testPools/subgraphPoolsLarge.json';
import precisionTestPools from './testData/precisionTestPools.json';
import { WETH } from '@balancer-labs/typechain';
import _ from 'lodash';

const B80BAL20WETH = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

const provider = new JsonRpcProvider(``);

describe('Tests full swaps against known values', () => {
    const gasPrice = parseFixed('30', 9);

    it('Should have a reasonable return amount value', async () => {
        const tokenIn = B80BAL20WETH;
        const tokenOut = USDC;
        const swapType = SwapTypes.SwapExactIn;
        const returnAmountDecimals = 18;
        const maxPools = 4;
        const swapAmount = parseFixed('14', 18);
        const swapGas = BigNumber.from('100000');
        const costOutputToken = Zero;

        const swapInfo = await getFullSwap(
            cloneDeep(
                precisionTestPools.map((obj) =>
                    _.omitBy(obj, _.isNull)
                ) as SubgraphPoolBase[]
            ),
            tokenIn,
            tokenOut,
            returnAmountDecimals,
            maxPools,
            swapType,
            swapAmount,
            costOutputToken,
            gasPrice,
            provider,
            swapGas
        );

        assert.equal(
            swapInfo.returnAmount.toString(),
            '243265259',
            'Should have a reasonable return amount value'
        );
    }).timeout(10000);
});

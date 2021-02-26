// npx mocha -r ts-node/register test/helpers.spec.ts
import { parsePoolPairData, getSpotPriceAfterSwap } from '../src/helpers';
import { assert, expect } from 'chai';
import { formatAndFilterPools } from './utils';
import { getSpotPrice } from './testHelpers';
import { bnum, scale } from '../src/bmath';
import { Pools, PoolPairData } from '../src/types';
import { BigNumber } from '../src/utils/bignumber';

const allPools = require('./allPools.json');

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // WETH lower case
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f'; // DAI lower case
const ANT = '0x960b236a07cf122663c4303350609a66a7b288c0'; // ANT lower case
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC lower case
const MKR = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // MKR lower case
const OCEAN = '0x985dd3d42de1e256d09e1c10f112bccb8015ad41';

let allPoolsBn;

describe('Testing Helper Functions', () => {
    before(() => {
        // Parse Subgraph pools (string/normalized) to Pools (scaled/BigNumber)
        [, allPoolsBn] = formatAndFilterPools(
            JSON.parse(JSON.stringify(allPools))
        );
    });

    it('Should Parse Pool Pair Data', () => {
        // The parsePoolPairData function normalizes weights.
        const pool = allPoolsBn.pools[0];
        const tokenIn = '0x992a780fdeda7a24c52526e027dfef90cddc685f';
        const tokenOut = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

        assert.equal(
            pool.id,
            '0x05e671f4c857d02f42d837e64e6ec50b27819261',
            'Test pool should have correct ID.'
        );

        const poolPairData: PoolPairData = parsePoolPairData(
            pool,
            tokenIn,
            tokenOut
        );

        let poolPairDataExpected = {
            id: pool.id,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: 18,
            decimalsOut: 18,
            balanceIn: pool.tokens[0].balance,
            balanceOut: pool.tokens[1].balance,
            weightIn: scale(
                bnum(pool.tokens[0].denormWeight).div(bnum(pool.totalWeight)),
                18
            ),
            weightOut: scale(
                bnum(pool.tokens[1].denormWeight).div(bnum(pool.totalWeight)),
                18
            ),
            swapFee: pool.swapFee,
        };

        expect(poolPairDataExpected).to.deep.equal(poolPairData);
    });

    it('Spot price helper should return same SP for no amount change, swapExactIn', () => {
        const pool = allPoolsBn.pools[0];
        const tokenIn = '0x992a780fdeda7a24c52526e027dfef90cddc685f';
        const tokenOut = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const swapAmount = bnum(0);

        const poolPairData: PoolPairData = parsePoolPairData(
            pool,
            tokenIn,
            tokenOut
        );

        // This function return wei result
        const expectedSp = getSpotPrice(poolPairData);

        // This function returns scaled to Ether result (i.e. 1 for 1e18Wei)
        const helperSp = getSpotPriceAfterSwap(
            poolPairData,
            'swapExactIn',
            swapAmount
        );

        // We're loosing some precision here?
        expect(scale(expectedSp, -18)).to.equal(helperSp);
    });
});

// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/batchswapQuery.spec.ts
import dotenv from 'dotenv';
dotenv.config();
import { SwapTypes } from '../src';
import { sorConfigEth } from './lib/constants';
import { parseFixed } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { BatchswapQuery } from '../src/batchswapQuery';
import { ADDRESSES, Network, PROVIDER_URLS } from './testScripts/constants';

const COMP_WETH_POOL_ID =
    '0xefaa1604e82e1b3af8430b90192c1b9e8197e377000200000000000000000021';
const WBTC_CHZ_LINK_COMP_POOL_ID =
    '0x344818b9b4cfec947fe8ccbea65b3605585c2c71000100000000000000000404';
const WETH_WBTC_POOL_ID =
    '0xa6f548df93de924d73be7d25dc02554c6bd66db500020000000000000000000e';

const tokens = ADDRESSES[Network.MAINNET];

describe('batchswapQuery', () => {
    it('selects a 75/25 split', async () => {
        const provider = new JsonRpcProvider(PROVIDER_URLS[Network.MAINNET]);

        const batchswapQuery = new BatchswapQuery(
            sorConfigEth.vault,
            sorConfigEth.multicall,
            provider
        );

        const response = await batchswapQuery.getBestPaths({
            paths: [
                {
                    swaps: [
                        {
                            pool: COMP_WETH_POOL_ID,
                            tokenIn: tokens.COMP.address,
                            tokenInDecimals: tokens.COMP.decimals,
                            tokenOut: tokens.WETH.address,
                            tokenOutDecimals: tokens.WETH.decimals,
                        },
                    ],
                },
                {
                    swaps: [
                        {
                            pool: WBTC_CHZ_LINK_COMP_POOL_ID,
                            tokenIn: tokens.COMP.address,
                            tokenInDecimals: tokens.COMP.decimals,
                            tokenOut: tokens.WBTC.address,
                            tokenOutDecimals: tokens.WBTC.decimals,
                        },
                        {
                            pool: WETH_WBTC_POOL_ID,
                            tokenIn: tokens.WBTC.address,
                            tokenInDecimals: tokens.WBTC.decimals,
                            tokenOut: tokens.WETH.address,
                            tokenOutDecimals: tokens.WETH.decimals,
                        },
                    ],
                },
            ],
            swapType: SwapTypes.SwapExactIn,
            swapAmount: parseFixed('1000', tokens.COMP.decimals),
            tokenIn: tokens.COMP.address,
            tokenOut: tokens.WETH.address,
            costOutputToken: parseFixed('0.000000001', tokens.WETH.decimals),
        });

        console.log({
            ...response,
            returnAmount: response.returnAmount.toString(),
            returnAmountConsideringFees:
                response.returnAmountConsideringFees.toString(),
            returnAmountFromSwaps: response.returnAmountFromSwaps.toString(),
            swapAmount: response.swapAmount.toString(),
            swapAmountForSwaps: response.swapAmountForSwaps.toString(),
        });
    }).timeout(10000);

    it('properly formats exact out swaps', async () => {
        const provider = new JsonRpcProvider(PROVIDER_URLS[Network.MAINNET]);

        const batchswapQuery = new BatchswapQuery(
            sorConfigEth.vault,
            sorConfigEth.multicall,
            provider
        );

        const response = await batchswapQuery.getBestPaths({
            paths: [
                {
                    swaps: [
                        {
                            pool: COMP_WETH_POOL_ID,
                            tokenIn: tokens.COMP.address,
                            tokenInDecimals: tokens.COMP.decimals,
                            tokenOut: tokens.WETH.address,
                            tokenOutDecimals: tokens.WETH.decimals,
                        },
                    ],
                },
                {
                    swaps: [
                        {
                            pool: WBTC_CHZ_LINK_COMP_POOL_ID,
                            tokenIn: tokens.COMP.address,
                            tokenInDecimals: tokens.COMP.decimals,
                            tokenOut: tokens.WBTC.address,
                            tokenOutDecimals: tokens.WBTC.decimals,
                        },
                        {
                            pool: WETH_WBTC_POOL_ID,
                            tokenIn: tokens.WBTC.address,
                            tokenInDecimals: tokens.WBTC.decimals,
                            tokenOut: tokens.WETH.address,
                            tokenOutDecimals: tokens.WETH.decimals,
                        },
                    ],
                },
            ],
            swapType: SwapTypes.SwapExactOut,
            swapAmount: parseFixed('25', tokens.WETH.decimals),
            tokenIn: tokens.COMP.address,
            tokenOut: tokens.WETH.address,
            costOutputToken: parseFixed('0.0001', tokens.COMP.decimals),
        });

        console.log({
            ...response,
            returnAmount: response.returnAmount.toString(),
            returnAmountConsideringFees:
                response.returnAmountConsideringFees.toString(),
            returnAmountFromSwaps: response.returnAmountFromSwaps.toString(),
            swapAmount: response.swapAmount.toString(),
            swapAmountForSwaps: response.swapAmountForSwaps.toString(),
        });
    }).timeout(10000);
});

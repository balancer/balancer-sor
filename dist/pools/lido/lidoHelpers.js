'use strict';
var __awaiter =
    (this && this.__awaiter) ||
    function(thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function(resolve) {
                      resolve(value);
                  });
        }
        return new (P || (P = Promise))(function(resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }
            function rejected(value) {
                try {
                    step(generator['throw'](value));
                } catch (e) {
                    reject(e);
                }
            }
            function step(result) {
                result.done
                    ? resolve(result.value)
                    : adopt(result.value).then(fulfilled, rejected);
            }
            step(
                (generator = generator.apply(thisArg, _arguments || [])).next()
            );
        });
    };
Object.defineProperty(exports, '__esModule', { value: true });
const contracts_1 = require('@ethersproject/contracts');
const types_1 = require('../../types');
const bmath_1 = require('../../bmath');
const index_1 = require('../../index');
exports.Lido = {
    Networks: [1, 42],
    STETH: {
        1: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
        42: '0x4803bb90d18a1cb7a2187344fe4feb0e07878d05',
    },
    WSTETHADDR: {
        1: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
        42: '0xa387b91e393cfb9356a460370842bc8dbb2f29af',
    },
    WETH: {
        1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        42: '0xdfcea9088c8a88a76ff74892c1457c17dfeef9c1',
    },
    DAI: {
        1: '0x6b175474e89094c44da98b954eedeac495271d0f',
        42: '0x04df6e4121c27713ed22341e7c7df330f56f289b',
    },
    USDC: {
        1: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        42: '0xc2569dd7d0fd715b054fbf16e75b001e5c0c1115',
    },
    USDT: {
        1: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        42: '0xcc08220af469192c53295fdd34cfb8df29aa17ab',
    },
    StaticPools: {
        // DAI/USDC/USDT
        staBal: {
            1: '0x06df3b2bbb68adc8b0e302443692037ed9f91b42000000000000000000000063',
            42: '0x5f304f6cf88dc76b414f301e05adfb5a429e8b670000000000000000000000f4',
        },
        // WETH/DAI (WETH/USDC on Kovan)
        wethDai: {
            1: '0x0b09dea16768f0799065c475be02919503cb2a3500020000000000000000001a',
            42: '0x3a19030ed746bd1c3f2b0f996ff9479af04c5f0a000200000000000000000004',
        },
        // WETH/wstETH Lido Pool
        wstEthWeth: {
            1: 'TODO',
            42: '0xe08590bde837eb9b2d42aa1196469d6e08fe96ec000200000000000000000101',
        },
    },
};
exports.Routes = {
    1: {},
    42: {},
};
// MAINNET STATIC ROUTES FOR LIDO <> Stable
// DAI/wstETH: DAI > WETH > wstETH
exports.Routes[1][`${exports.Lido.DAI[1]}${exports.Lido.WSTETHADDR[1]}0`] = {
    name: 'DAI/wstETH-SwapExactIn',
    tokenInDecimals: 18,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.DAI[1],
        exports.Lido.WETH[1],
        exports.Lido.WSTETHADDR[1],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wethDai[1],
            amount: '',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[1],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
    ],
};
// wstETH/DAI: wstETH > WETH > DAI
exports.Routes[1][`${exports.Lido.WSTETHADDR[1]}${exports.Lido.DAI[1]}0`] = {
    name: 'wstETH/DAI-SwapExactIn',
    tokenInDecimals: 18,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.WSTETHADDR[1],
        exports.Lido.WETH[1],
        exports.Lido.DAI[1],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[1],
            amount: '',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[1],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
    ],
};
// DAI/wstETH: DAI > WETH > wstETH
exports.Routes[1][`${exports.Lido.DAI[1]}${exports.Lido.WSTETHADDR[1]}1`] = {
    name: 'DAI/wstETH-SwapExactOut',
    tokenInDecimals: 18,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.DAI[1],
        exports.Lido.WETH[1],
        exports.Lido.WSTETHADDR[1],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[1],
            amount: '',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[1],
            amount: '0',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
    ],
};
// wstETH/DAI: wstETH > WETH > DAI
exports.Routes[1][`${exports.Lido.WSTETHADDR[1]}${exports.Lido.DAI[1]}1`] = {
    name: 'wstETH/DAI-SwapExactOut',
    tokenInDecimals: 18,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.WSTETHADDR[1],
        exports.Lido.WETH[1],
        exports.Lido.DAI[1],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wethDai[1],
            amount: '',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[1],
            amount: '0',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
    ],
};
// USDC/wstETH: USDC > DAI > WETH > wstETH
exports.Routes[1][`${exports.Lido.USDC[1]}${exports.Lido.WSTETHADDR[1]}0`] = {
    name: 'USDC/wstETH-SwapExactIn',
    tokenInDecimals: 6,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.USDC[1],
        exports.Lido.DAI[1],
        exports.Lido.WETH[1],
        exports.Lido.WSTETHADDR[1],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.staBal[1],
            amount: '',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[1],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[1],
            amount: '0',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
    ],
};
exports.Routes[1][`${exports.Lido.USDC[1]}${exports.Lido.WSTETHADDR[1]}1`] = {
    name: 'USDC/wstETH-SwapExactOut',
    tokenInDecimals: 6,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.USDC[1],
        exports.Lido.DAI[1],
        exports.Lido.WETH[1],
        exports.Lido.WSTETHADDR[1],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[1],
            amount: '',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[1],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.staBal[1],
            amount: '0',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
    ],
};
// wstETH/USDC: wstETH > WETH > DAI > USDC
exports.Routes[1][`${exports.Lido.WSTETHADDR[1]}${exports.Lido.USDC[1]}0`] = {
    name: 'wstETH/USDC-SwapExactIn',
    tokenInDecimals: 18,
    tokenOutDecimals: 6,
    tokenAddresses: [
        exports.Lido.WSTETHADDR[1],
        exports.Lido.WETH[1],
        exports.Lido.DAI[1],
        exports.Lido.USDC[1],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[1],
            amount: '',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[1],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.staBal[1],
            amount: '0',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
    ],
};
exports.Routes[1][`${exports.Lido.WSTETHADDR[1]}${exports.Lido.USDC[1]}1`] = {
    name: 'wstETH/USDC-SwapExactOut',
    tokenInDecimals: 18,
    tokenOutDecimals: 6,
    tokenAddresses: [
        exports.Lido.WSTETHADDR[1],
        exports.Lido.WETH[1],
        exports.Lido.DAI[1],
        exports.Lido.USDC[1],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.staBal[1],
            amount: '',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[1],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[1],
            amount: '0',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
    ],
};
// USDT/wstETH: USDT > DAI > WETH > wstETH
exports.Routes[1][`${exports.Lido.USDT[1]}${exports.Lido.WSTETHADDR[1]}0`] = {
    name: 'USDT/wstETH-SwapExactIn',
    tokenInDecimals: 6,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.USDT[1],
        exports.Lido.DAI[1],
        exports.Lido.WETH[1],
        exports.Lido.WSTETHADDR[1],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.staBal[1],
            amount: '',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[1],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[1],
            amount: '0',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
    ],
};
exports.Routes[1][`${exports.Lido.USDT[1]}${exports.Lido.WSTETHADDR[1]}1`] = {
    name: 'USDT/wstETH-SwapExactOut',
    tokenInDecimals: 6,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.USDT[1],
        exports.Lido.DAI[1],
        exports.Lido.WETH[1],
        exports.Lido.WSTETHADDR[1],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[1],
            amount: '',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[1],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.staBal[1],
            amount: '0',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
    ],
};
// wstETH/USDT: wstETH > WETH > DAI > USDT
exports.Routes[1][`${exports.Lido.WSTETHADDR[1]}${exports.Lido.USDT[1]}0`] = {
    name: 'wstETH/USDT-SwapExactIn',
    tokenInDecimals: 18,
    tokenOutDecimals: 6,
    tokenAddresses: [
        exports.Lido.WSTETHADDR[1],
        exports.Lido.WETH[1],
        exports.Lido.DAI[1],
        exports.Lido.USDT[1],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[1],
            amount: '',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[1],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.staBal[1],
            amount: '0',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
    ],
};
exports.Routes[1][`${exports.Lido.WSTETHADDR[1]}${exports.Lido.USDT[1]}1`] = {
    name: 'wstETH/USDT-SwapExactOut',
    tokenInDecimals: 18,
    tokenOutDecimals: 6,
    tokenAddresses: [
        exports.Lido.WSTETHADDR[1],
        exports.Lido.WETH[1],
        exports.Lido.DAI[1],
        exports.Lido.USDT[1],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.staBal[1],
            amount: '',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[1],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[1],
            amount: '0',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
    ],
};
// KOVAN STATIC ROUTES FOR LIDO <> Stable
// USDC/wstETH: USDC > WETH > wstETH
exports.Routes[42][
    `${exports.Lido.USDC[42]}${exports.Lido.WSTETHADDR[42]}0`
] = {
    name: 'USDC/wstETH-SwapExactIn',
    tokenInDecimals: 6,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.USDC[42],
        exports.Lido.WETH[42],
        exports.Lido.WSTETHADDR[42],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wethDai[42],
            amount: '',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[42],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
    ],
};
// wstETH/USDC: wstETH > WETH > USDC
exports.Routes[42][
    `${exports.Lido.WSTETHADDR[42]}${exports.Lido.USDC[42]}0`
] = {
    name: 'wstETH/USDC-SwapExactIn',
    tokenInDecimals: 18,
    tokenOutDecimals: 6,
    tokenAddresses: [
        exports.Lido.WSTETHADDR[42],
        exports.Lido.WETH[42],
        exports.Lido.USDC[42],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[42],
            amount: '',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[42],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
    ],
};
// USDC/wstETH: USDC > WETH > wstETH
exports.Routes[42][
    `${exports.Lido.USDC[42]}${exports.Lido.WSTETHADDR[42]}1`
] = {
    name: 'USDC/wstETH-SwapExactOut',
    tokenInDecimals: 6,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.USDC[42],
        exports.Lido.WETH[42],
        exports.Lido.WSTETHADDR[42],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[42],
            amount: '',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[42],
            amount: '0',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
    ],
};
// wstETH/USDC: wstETH > WETH > USDC
exports.Routes[42][
    `${exports.Lido.WSTETHADDR[42]}${exports.Lido.USDC[42]}1`
] = {
    name: 'wstETH/USDC-SwapExactOut',
    tokenInDecimals: 18,
    tokenOutDecimals: 6,
    tokenAddresses: [
        exports.Lido.WSTETHADDR[42],
        exports.Lido.WETH[42],
        exports.Lido.USDC[42],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wethDai[42],
            amount: '',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[42],
            amount: '0',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
    ],
};
// DAI/wstETH: DAI > USDC > WETH > wstETH
exports.Routes[42][`${exports.Lido.DAI[42]}${exports.Lido.WSTETHADDR[42]}0`] = {
    name: 'DAI/wstETH-SwapExactIn',
    tokenInDecimals: 18,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.DAI[42],
        exports.Lido.USDC[42],
        exports.Lido.WETH[42],
        exports.Lido.WSTETHADDR[42],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.staBal[42],
            amount: '',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[42],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[42],
            amount: '0',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
    ],
};
exports.Routes[42][`${exports.Lido.DAI[42]}${exports.Lido.WSTETHADDR[42]}1`] = {
    name: 'DAI/wstETH-SwapExactOut',
    tokenInDecimals: 18,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.DAI[42],
        exports.Lido.USDC[42],
        exports.Lido.WETH[42],
        exports.Lido.WSTETHADDR[42],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[42],
            amount: '',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[42],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.staBal[42],
            amount: '0',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
    ],
};
// wstETH/DAI: wstETH > WETH > USDC > DAI
exports.Routes[42][`${exports.Lido.WSTETHADDR[42]}${exports.Lido.DAI[42]}0`] = {
    name: 'wstETH/DAI-SwapExactIn',
    tokenInDecimals: 18,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.WSTETHADDR[42],
        exports.Lido.WETH[42],
        exports.Lido.USDC[42],
        exports.Lido.DAI[42],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[42],
            amount: '',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[42],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.staBal[42],
            amount: '0',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
    ],
};
exports.Routes[42][`${exports.Lido.WSTETHADDR[42]}${exports.Lido.DAI[42]}1`] = {
    name: 'wstETH/DAI-SwapExactOut',
    tokenInDecimals: 18,
    tokenOutDecimals: 6,
    tokenAddresses: [
        exports.Lido.WSTETHADDR[42],
        exports.Lido.WETH[42],
        exports.Lido.USDC[42],
        exports.Lido.DAI[42],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.staBal[42],
            amount: '',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[42],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[42],
            amount: '0',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
    ],
};
// USDT/wstETH: USDT > USDC > WETH > wstETH
exports.Routes[42][
    `${exports.Lido.USDT[42]}${exports.Lido.WSTETHADDR[42]}0`
] = {
    name: 'USDT/wstETH-SwapExactIn',
    tokenInDecimals: 6,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.USDT[42],
        exports.Lido.USDC[42],
        exports.Lido.WETH[42],
        exports.Lido.WSTETHADDR[42],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.staBal[42],
            amount: '',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[42],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[42],
            amount: '0',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
    ],
};
exports.Routes[42][
    `${exports.Lido.USDT[42]}${exports.Lido.WSTETHADDR[42]}1`
] = {
    name: 'USDT/wstETH-SwapExactOut',
    tokenInDecimals: 6,
    tokenOutDecimals: 18,
    tokenAddresses: [
        exports.Lido.USDT[42],
        exports.Lido.USDC[42],
        exports.Lido.WETH[42],
        exports.Lido.WSTETHADDR[42],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[42],
            amount: '',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[42],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.staBal[42],
            amount: '0',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
    ],
};
// wstETH/USDT: wstETH > WETH > USDC > USDT
exports.Routes[42][
    `${exports.Lido.WSTETHADDR[42]}${exports.Lido.USDT[42]}0`
] = {
    name: 'wstETH/USDT-SwapExactIn',
    tokenInDecimals: 18,
    tokenOutDecimals: 6,
    tokenAddresses: [
        exports.Lido.WSTETHADDR[42],
        exports.Lido.WETH[42],
        exports.Lido.USDC[42],
        exports.Lido.USDT[42],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[42],
            amount: '',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[42],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.staBal[42],
            amount: '0',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
    ],
};
exports.Routes[42][
    `${exports.Lido.WSTETHADDR[42]}${exports.Lido.USDT[42]}1`
] = {
    name: 'wstETH/USDT-SwapExactOut',
    tokenInDecimals: 18,
    tokenOutDecimals: 6,
    tokenAddresses: [
        exports.Lido.WSTETHADDR[42],
        exports.Lido.WETH[42],
        exports.Lido.USDC[42],
        exports.Lido.USDT[42],
    ],
    swaps: [
        {
            poolId: exports.Lido.StaticPools.staBal[42],
            amount: '',
            assetInIndex: '2',
            assetOutIndex: '3',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wethDai[42],
            amount: '0',
            assetInIndex: '1',
            assetOutIndex: '2',
            userData: '0x',
        },
        {
            poolId: exports.Lido.StaticPools.wstEthWeth[42],
            amount: '0',
            assetInIndex: '0',
            assetOutIndex: '1',
            userData: '0x',
        },
    ],
};
function isLidoSwap(chainId, tokenIn, tokenOut) {
    if (!exports.Lido.Networks.includes(chainId)) return false;
    if (
        tokenIn === exports.Lido.WSTETHADDR[chainId] ||
        tokenOut === exports.Lido.WSTETHADDR[chainId] ||
        tokenIn === exports.Lido.STETH[chainId] ||
        tokenOut === exports.Lido.STETH[chainId]
    )
        return true;
    else return false;
}
exports.isLidoSwap = isLidoSwap;
// Uses Vault queryBatchSwap to get return amount for swap
function queryBatchSwap(swapType, swaps, assets, provider) {
    return __awaiter(this, void 0, void 0, function*() {
        const vaultAbi = require('../../abi/Vault.json');
        const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
        const vaultContract = new contracts_1.Contract(
            vaultAddr,
            vaultAbi,
            provider
        );
        const funds = {
            sender: index_1.ZERO_ADDRESS,
            recipient: index_1.ZERO_ADDRESS,
            fromInternalBalance: false,
            toInternalBalance: false,
        };
        try {
            const deltas = yield vaultContract.callStatic.queryBatchSwap(
                swapType,
                swaps,
                assets,
                funds
            );
            // negative amounts represent tokens (or ETH) sent by the Vault
            if (swapType === types_1.SwapTypes.SwapExactIn)
                return bmath_1
                    .bnum(deltas[assets.length - 1].toString())
                    .times(-1);
            else return bmath_1.bnum(deltas[0].toString());
        } catch (err) {
            console.error(`SOR - queryBatchSwap: ${err.message}`);
            return bmath_1.bnum(0);
        }
    });
}
/*
Used when SOR doesn't support paths with more than one hop.
Enables swapping of stables <> wstETH via WETH/DAI pool which has good liquidity.
*/
function getLidoStaticSwaps(
    chainId,
    tokenIn,
    tokenOut,
    swapType,
    swapAmount,
    provider
) {
    return __awaiter(this, void 0, void 0, function*() {
        // Check for stETH tokens and convert to use wstETH for routing
        let isWrappingIn,
            isWrappingOut = false;
        if (tokenIn === exports.Lido.STETH[chainId]) {
            tokenIn = exports.Lido.WSTETHADDR[chainId];
            isWrappingIn = true;
        }
        if (tokenOut === exports.Lido.STETH[chainId]) {
            tokenOut = exports.Lido.WSTETHADDR[chainId];
            isWrappingOut = true;
        }
        let swapInfo = {
            tokenAddresses: [],
            swaps: [],
            swapAmount: bmath_1.ZERO,
            tokenIn: '',
            tokenOut: '',
            returnAmount: bmath_1.ZERO,
            returnAmountConsideringFees: bmath_1.ZERO,
            marketSp: bmath_1.ZERO,
        };
        const staticRoute =
            exports.Routes[chainId][`${tokenIn}${tokenOut}${swapType}`];
        if (!staticRoute) return swapInfo;
        swapInfo.tokenAddresses = staticRoute.tokenAddresses;
        swapInfo.swaps = staticRoute.swaps;
        if (swapType === types_1.SwapTypes.SwapExactIn)
            swapInfo.swapAmount = bmath_1.scale(
                swapAmount,
                staticRoute.tokenInDecimals
            );
        else
            swapInfo.swapAmount = bmath_1.scale(
                swapAmount,
                staticRoute.tokenOutDecimals
            );
        swapInfo.swaps[0].amount = swapInfo.swapAmount.toString();
        if (isWrappingIn) swapInfo.tokenIn = exports.Lido.STETH[chainId];
        else swapInfo.tokenIn = tokenIn;
        if (isWrappingOut) swapInfo.tokenOut = exports.Lido.STETH[chainId];
        else swapInfo.tokenOut = tokenOut;
        // Unlike main SOR here we haven't calculated the return amount for swaps so use query call on Vault to get value.
        swapInfo.returnAmount = yield queryBatchSwap(
            swapType,
            swapInfo.swaps,
            swapInfo.tokenAddresses,
            provider
        );
        // Considering fees shouldn't matter as there won't be alternative options on V1
        swapInfo.returnAmountConsideringFees = swapInfo.returnAmount;
        return swapInfo;
    });
}
exports.getLidoStaticSwaps = getLidoStaticSwaps;

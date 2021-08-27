import { BaseProvider } from '@ethersproject/providers';
import { SwapInfo, SwapTypes } from '../../types';
import { BigNumber } from '../../utils/bignumber';
import { SubGraphPoolsBase } from '../../index';
export declare const Lido: {
    Networks: number[];
    stETH: {
        1: string;
        42: string;
    };
    wstETH: {
        1: string;
        42: string;
    };
    WETH: {
        1: string;
        42: string;
    };
    DAI: {
        1: string;
        42: string;
    };
    USDC: {
        1: string;
        42: string;
    };
    USDT: {
        1: string;
        42: string;
    };
    StaticPools: {
        staBal: {
            1: string;
            42: string;
        };
        wethDai: {
            1: string;
            42: string;
        };
        wstEthWeth: {
            1: string;
            42: string;
        };
    };
};
export declare const Routes: {
    1: {};
    42: {};
};
export declare function isLidoStableSwap(chainId: number, tokenIn: string, tokenOut: string): boolean;
export declare function getStEthRate(provider: BaseProvider, chainId: number): Promise<BigNumber>;
export declare function getLidoStaticSwaps(pools: SubGraphPoolsBase, chainId: number, tokenIn: string, tokenOut: string, swapType: SwapTypes, swapAmount: BigNumber, provider: BaseProvider): Promise<SwapInfo>;

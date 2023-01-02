import {
    FundManagement,
    NewPath,
    Swap,
    SwapInfo,
    SwapTypes,
    SwapV2,
} from './types';
import { BigNumber } from '@ethersproject/bignumber';
import { AddressZero, MaxUint256, Zero } from '@ethersproject/constants';
import { Provider } from '@ethersproject/providers';
import { Multicaller } from '../test/lib/multicaller';
import vaultAbi from './abi/Vault.json';
import { uniq } from 'lodash';

interface BatchSwapQueryData {
    swapType: SwapTypes;
    swaps: SwapV2[];
    assets: string[];
}

export class BatchswapQuery {
    constructor(
        private readonly vaultAddress: string,
        private readonly multicallAddress: string,
        private readonly provider: Provider
    ) {}

    public async getBestPaths({
        paths,
        swapType,
        swapAmount,
        tokenIn,
        tokenOut,
        costOutputToken,
    }: {
        // we're only concerned with the swaps
        paths: Pick<NewPath, 'swaps'>[];
        swapAmount: BigNumber;
        swapType: SwapTypes;
        tokenIn: string;
        tokenOut: string;
        costOutputToken: BigNumber;
    }): Promise<SwapInfo> {
        const isExactIn = swapType === SwapTypes.SwapExactIn;

        //create sampling queries for 100, 75/25, 50/50, 25/75 across the two most liquid paths
        const queries = this.getSamplingQueriesForPaths({
            paths,
            swapType,
            swapAmount,
        });

        //use multicall to query all batchswaps in a single request
        const queryResponse = await this.queryBatchSwaps({ queries });

        const { bestResultIdx, total, totalConsideringFees } =
            this.getBestQueryIndexAndTotals({
                isExactIn,
                tokenIn,
                tokenOut,
                queries,
                queryResponse,
                costOutputToken,
            });

        return {
            swaps: queries[bestResultIdx].swaps,
            tokenAddresses: queries[bestResultIdx].assets,
            swapAmount,
            swapAmountForSwaps: swapAmount,
            returnAmount: total,
            returnAmountFromSwaps: total,
            returnAmountConsideringFees: totalConsideringFees,
            tokenIn,
            tokenOut,
            //TODO: determine the best strategy here
            marketSp: '0',
        };
    }

    private getSamplingQueriesForPaths({
        paths,
        swapType,
        swapAmount,
    }: {
        paths: Pick<NewPath, 'swaps'>[];
        swapAmount: BigNumber;
        swapType: SwapTypes;
    }): BatchSwapQueryData[] {
        const queries: BatchSwapQueryData[] = [
            // 100% to the most liquid path
            this.formatBatchSwapQueryData({
                swaps: this.setAmountForPathSwaps({
                    swaps: paths[0].swaps,
                    swapType,
                    swapAmount: swapAmount.toString(),
                }),
                swapType,
            }),
        ];

        if (paths.length > 1) {
            queries.push(
                this.formatPathsWithSplit({
                    swapAmount,
                    swapType,
                    paths: [
                        { ...paths[0], percent: 75 },
                        { ...paths[1], percent: 25 },
                    ],
                })
            );

            queries.push(
                this.formatPathsWithSplit({
                    swapAmount,
                    swapType,
                    paths: [
                        { ...paths[0], percent: 50 },
                        { ...paths[1], percent: 50 },
                    ],
                })
            );

            queries.push(
                this.formatPathsWithSplit({
                    swapAmount,
                    swapType,
                    paths: [
                        { ...paths[0], percent: 25 },
                        { ...paths[1], percent: 75 },
                    ],
                })
            );
        }

        return queries;
    }

    private getBestQueryIndexAndTotals({
        isExactIn,
        tokenIn,
        tokenOut,
        queries,
        queryResponse,
        costOutputToken,
    }: {
        isExactIn: boolean;
        tokenIn: string;
        tokenOut: string;
        queries: BatchSwapQueryData[];
        queryResponse: BigNumber[][];
        costOutputToken: BigNumber;
    }): {
        bestResultIdx: number;
        total: BigNumber;
        totalConsideringFees: BigNumber;
    } {
        const assetOfInterest = isExactIn ? tokenOut : tokenIn;
        let total = isExactIn ? Zero : MaxUint256;
        let totalConsideringFees = isExactIn ? Zero : MaxUint256;
        let bestResultIdx = -1;

        for (let i = 0; i < queries.length; i++) {
            const assetIdx = queries[i].assets.indexOf(assetOfInterest);
            const queryTotal = isExactIn
                ? queryResponse[i][assetIdx].abs()
                : queryResponse[i][assetIdx];
            const gasFees = costOutputToken.mul(queries[i].swaps.length);
            const queryTotalConsideringFees = isExactIn
                ? queryTotal.sub(gasFees)
                : queryTotal.add(gasFees);

            if (
                (isExactIn &&
                    totalConsideringFees.lt(queryTotalConsideringFees)) ||
                (!isExactIn && total.gt(queryTotalConsideringFees))
            ) {
                total = queryTotal;
                totalConsideringFees = queryTotalConsideringFees;
                bestResultIdx = i;
            }
        }

        return { bestResultIdx, total, totalConsideringFees };
    }

    private formatPathsWithSplit({
        swapType,
        swapAmount,
        paths,
    }: {
        swapType: SwapTypes;
        swapAmount: BigNumber;
        paths: (Pick<NewPath, 'swaps'> & { percent: number })[];
    }): BatchSwapQueryData {
        //TODO: might be rounding error where we need to add 1 to one amount?
        return this.formatBatchSwapQueryData({
            swaps: paths
                .map((path) =>
                    this.setAmountForPathSwaps({
                        swaps: path.swaps,
                        swapType,
                        swapAmount: swapAmount
                            .mul(path.percent)
                            .div(100)
                            .toString(),
                    })
                )
                .flat(),
            swapType,
        });
    }

    private formatBatchSwapQueryData({
        swaps,
        swapType,
    }: {
        swaps: Swap[];
        swapType: SwapTypes;
    }): BatchSwapQueryData {
        const assets = uniq([
            ...swaps.map((swap) => swap.tokenIn),
            ...swaps.map((swap) => swap.tokenOut),
        ]);

        return {
            swapType,
            assets,
            swaps: swaps.map((swap) => {
                return {
                    poolId: swap.pool,
                    assetInIndex: assets.indexOf(swap.tokenIn),
                    assetOutIndex: assets.indexOf(swap.tokenOut),
                    amount: swap.swapAmount || '0',
                    userData: '0x',
                };
            }),
        };
    }

    private setAmountForPathSwaps({
        swaps,
        swapType,
        swapAmount,
    }: {
        swaps: Swap[];
        swapType: SwapTypes;
        swapAmount: string;
    }): Swap[] {
        const isExactIn = swapType === SwapTypes.SwapExactIn;
        const formattedSwaps = !isExactIn ? [...swaps].reverse() : swaps;

        return formattedSwaps.map((swap, index) => {
            return {
                ...swap,
                swapAmount: index === 0 ? swapAmount : '0',
            };
        });
    }

    private async queryBatchSwaps({
        queries,
    }: {
        queries: BatchSwapQueryData[];
    }): Promise<BigNumber[][]> {
        const multicaller = new Multicaller(
            this.multicallAddress,
            this.provider,
            vaultAbi
        );

        const funds: FundManagement = {
            sender: AddressZero,
            recipient: AddressZero,
            fromInternalBalance: false,
            toInternalBalance: false,
        };

        for (let i = 0; i < queries.length; i++) {
            const { swapType, swaps, assets } = queries[i];

            multicaller.call(`${i}`, this.vaultAddress, 'queryBatchSwap', [
                swapType,
                swaps,
                assets,
                funds,
            ]);
        }

        const response = await multicaller.execute();

        return Object.values(response) as BigNumber[][];
    }
}

import { NewPath, PoolBase, PoolTypes } from '../types';
import { keyBy, orderBy, sortBy, uniq } from 'lodash';
import { Graph } from 'graphlib';
import { Zero } from '@ethersproject/constants';
import {
    PathGraphEdge,
    PathGraphEdgeLabel,
    PathGraphTraversalConfig,
    PoolAddressDictionary,
    PoolPairMap,
} from './pathGraphTypes';
import * as console from 'console';

export class PathGraph {
    private graph: Graph = new Graph({ multigraph: true });
    private poolAddressMap: PoolAddressDictionary = {};
    private graphIsInitialized = false;
    private maxPathsPerTokenPair = 2;

    public get isGraphInitialized(): boolean {
        return this.graphIsInitialized;
    }

    public buildGraph({
        pools,
        maxPathsPerTokenPair = 2,
    }: {
        pools: PoolBase[];
        maxPathsPerTokenPair?: number;
    }): void {
        this.poolAddressMap = keyBy(pools, 'address');
        const graph = new Graph({ multigraph: true });
        const poolPairMap = this.buildSortedPoolPairMap(pools);

        for (const id of Object.keys(poolPairMap)) {
            const items = poolPairMap[id];

            for (let i = 0; i < items.length; i++) {
                const poolPair = items[i].poolPair;
                const pool = this.poolAddressMap[poolPair.address];

                // we take the first `maxPathsPerTokenPair` most liquid pairs.
                // Always include pairs where the pool has phantom bpt
                if (
                    i < maxPathsPerTokenPair ||
                    pool.tokensList.includes(poolPair.address)
                ) {
                    this.addGraphEdgeForPoolPair({
                        tokenIn: poolPair.tokenIn,
                        tokenOut: poolPair.tokenOut,
                        pool,
                        graph,
                    });
                }
            }
        }

        this.graph = graph;
        this.graphIsInitialized = true;
        this.maxPathsPerTokenPair = maxPathsPerTokenPair;
    }

    public traverseGraphAndFindBestPaths({
        tokenIn,
        tokenOut,
        config = {
            maxDepth: 7,
            maxNonBoostedPathDepth: 2,
            maxNonBoostedSegmentsInBoostedPath: 1,
            approxPathsToReturn: 20,
        },
    }: {
        tokenIn: string;
        tokenOut: string;
        config?: PathGraphTraversalConfig;
    }): NewPath[] {
        const paths: PathGraphEdge[][] = [];
        const selectedPathIds: string[] = [];
        let seenPoolAddresses: string[] = [];

        while (paths.length < config.approxPathsToReturn) {
            //the tokenPairIndex refers to the nth most liquid path for a token
            //pair x -> y. maxPathsPerTokenPair is provided as a config on graph init
            for (let idx = 0; idx < this.maxPathsPerTokenPair; idx++) {
                let foundPath = true;

                //loop until we've found all unique paths from tokenIn -> tokenOut
                //that meet validity and config criteria, preferring the ${idx}th most
                //liquid pair. When there is less than ${idx+1} pairs, we default to the
                //most liquid pair
                while (foundPath) {
                    foundPath = false;
                    const path = this.traverseGraphAndFindUniquePath({
                        token: tokenIn,
                        tokenOut,
                        tokenPairIndex: idx,
                        config,
                        tokenPath: [tokenIn],
                        seenPoolAddresses,
                        selectedPathIds,
                    });

                    if (path) {
                        seenPoolAddresses = [
                            ...seenPoolAddresses,
                            ...path.map((segment) => segment.poolAddress),
                        ];

                        paths.push(path);
                        selectedPathIds.push(this.getIdForPath(path));
                        foundPath = true;
                    }
                }
            }

            // the assumption we make here is that if we are going to re-use a pool,
            // the outcome will most likely be better if we reuse stable pools over
            // volatile pools. If there are stable pools in the seen list, we remove
            // them and rerun the traversal.
            if (
                paths.length < config.approxPathsToReturn &&
                seenPoolAddresses.length > 0
            ) {
                const volatilePoolAddresses =
                    this.filterVolatilePools(seenPoolAddresses);

                if (volatilePoolAddresses.length < seenPoolAddresses.length) {
                    seenPoolAddresses = volatilePoolAddresses;
                } else {
                    seenPoolAddresses = [];
                }
            } else {
                // we have either found enough paths, or found no new paths for
                // for an entire iteration
                break;
            }
        }

        console.log(
            'abc',
            paths.map((segment) => segment.map((a) => a.poolId))
        );

        return paths.map((path) => {
            return {
                id: path.map((segment) => segment.poolId).join('_'),
                swaps: path.map((segment) => ({
                    pool: segment.poolId,
                    tokenIn: segment.tokenIn,
                    tokenOut: segment.tokenOut,
                    tokenInDecimals: 0,
                    tokenOutDecimals: 0,
                })),
                poolPairData: path.map((segment) => segment.poolPair),
                pools: path.map(
                    (segment) => this.poolAddressMap[segment.poolAddress]
                ),
                limitAmount: Zero,
            };
        });
    }

    private buildSortedPoolPairMap(pools: PoolBase[]): PoolPairMap {
        const poolPairMap: PoolPairMap = {};

        for (const pool of pools) {
            for (let i = 0; i < pool.tokensList.length - 1; i++) {
                for (let j = i + 1; j < pool.tokensList.length; j++) {
                    const id = `${pool.tokensList[i]}-${pool.tokensList[j]}`;
                    const reverseId = `${pool.tokensList[j]}-${pool.tokensList[i]}`;

                    if (!poolPairMap[id]) {
                        poolPairMap[id] = [];
                    }

                    if (!poolPairMap[reverseId]) {
                        poolPairMap[reverseId] = [];
                    }

                    const poolPair = pool.parsePoolPairData(
                        pool.tokensList[i],
                        pool.tokensList[j]
                    );

                    poolPairMap[id].push({
                        poolPair,
                        normalizedLiquidity:
                            pool.getNormalizedLiquidity(poolPair),
                    });

                    const poolPairReverse = pool.parsePoolPairData(
                        pool.tokensList[j],
                        pool.tokensList[i]
                    );

                    poolPairMap[reverseId].push({
                        poolPair: poolPairReverse,
                        normalizedLiquidity:
                            pool.getNormalizedLiquidity(poolPairReverse),
                    });
                }
            }
        }

        for (const id of Object.keys(poolPairMap)) {
            poolPairMap[id] = orderBy(
                poolPairMap[id],
                (item) => item.normalizedLiquidity.toNumber(),
                'desc'
            );
        }

        return poolPairMap;
    }

    private addGraphEdgeForPoolPair({
        tokenIn,
        tokenOut,
        pool,
        graph,
    }: {
        tokenIn: string;
        tokenOut: string;
        pool: PoolBase;
        graph: Graph;
    }) {
        const poolPair = pool.parsePoolPairData(tokenIn, tokenOut);

        const label: PathGraphEdgeLabel = {
            poolId: pool.id,
            poolAddress: pool.address,
            poolPair,
            normalizedLiquidity: pool.getNormalizedLiquidity(poolPair),
            isPhantomBptHop:
                !!this.poolAddressMap[tokenIn] ||
                !!this.poolAddressMap[tokenOut],
        };

        graph.setEdge(
            {
                name: `${pool.id}-${tokenIn}-${tokenOut}`,
                v: tokenIn,
                w: tokenOut,
            },
            label
        );
    }

    private traverseGraphAndFindUniquePath({
        token,
        tokenOut,
        tokenPath,
        tokenPairIndex,
        config,
        seenPoolAddresses,
        selectedPathIds,
    }: {
        token: string;
        tokenOut: string;
        tokenPath: string[];
        tokenPairIndex: number;
        config: PathGraphTraversalConfig;
        seenPoolAddresses: string[];
        selectedPathIds: string[];
    }): null | PathGraphEdge[] {
        const successors = (this.graph.successors(token) || []).filter(
            (successor) => !tokenPath.includes(successor)
        );

        if (successors.includes(tokenOut)) {
            const path = this.buildPath({
                tokenPath: [...tokenPath, tokenOut],
                tokenPairIndex,
            });

            if (
                path &&
                this.isValidPath({
                    path,
                    config,
                    seenPoolAddresses,
                    selectedPathIds,
                })
            ) {
                return path;
            }
        }

        // we peek ahead one level, and optimistically sort the successors
        const sorted = sortBy(successors, (successor) => {
            const children = this.graph.successors(successor) || [];
            return children.includes(tokenOut) ? -1 : 1;
        });

        for (const successor of sorted) {
            const result = this.traverseGraphAndFindUniquePath({
                token: successor,
                tokenOut,
                tokenPath: [...tokenPath, successor],
                tokenPairIndex,
                config,
                seenPoolAddresses,
                selectedPathIds,
            });

            if (result != null) {
                return result;
            }
        }

        return null;
    }

    private buildPath({
        tokenPath,
        tokenPairIndex,
    }: {
        tokenPath: string[];
        tokenPairIndex: number;
    }): PathGraphEdge[] | null {
        const path: PathGraphEdge[] = [];
        let isUnique = false;

        for (let i = 0; i < tokenPath.length - 1; i++) {
            const outEdges =
                this.graph.outEdges(tokenPath[i], tokenPath[i + 1]) || [];

            if (outEdges.length > tokenPairIndex) {
                //if no part of this path uses the current tokenPairIndex, it
                //will be a duplicate path, so we ignore it.
                isUnique = true;
            }

            //this edge has already been qualified in the traversal, so it's safe
            //to assume its here
            const edge = outEdges[tokenPairIndex] || outEdges[0];
            const edgeLabel: PathGraphEdgeLabel = this.graph.edge(edge);

            path.push({
                tokenIn: tokenPath[i],
                tokenOut: tokenPath[i + 1],
                ...edgeLabel,
            });
        }

        return isUnique ? path : null;
    }

    private isValidPath({
        path,
        config,
        seenPoolAddresses,
        selectedPathIds,
    }: {
        path: PathGraphEdge[];
        config: PathGraphTraversalConfig;
        seenPoolAddresses: string[];
        selectedPathIds: string[];
    }) {
        const { maxNonBoostedSegmentsInBoostedPath, maxNonBoostedPathDepth } =
            config;
        const uniquePools = uniq(path.map((edge) => edge.poolId));
        const numBoostedSegments = path.filter(
            (edge) => edge.isPhantomBptHop
        ).length;
        const numNonBoostedSegments = path.length - numBoostedSegments;
        const isBoostedPath = numBoostedSegments > 0;

        //dont include any path that hops through the same pool twice
        if (uniquePools.length !== path.length) {
            return false;
        }

        //non boosted path is too long
        if (!isBoostedPath && path.length > maxNonBoostedPathDepth) {
            return false;
        }

        //boosted path has more non boosted segments than is allowed
        if (
            isBoostedPath &&
            numNonBoostedSegments > maxNonBoostedSegmentsInBoostedPath
        ) {
            return false;
        }

        const intersection = path.filter((segment) =>
            seenPoolAddresses.includes(segment.poolAddress)
        );

        //this path contains a pool that has already been used
        if (intersection.length > 0) {
            return false;
        }

        //this is a duplicate path
        if (selectedPathIds.includes(this.getIdForPath(path))) {
            return false;
        }

        return true;
    }

    private getIdForPath(path: PathGraphEdge[]): string {
        return path
            .map(
                (segment) =>
                    `${segment.poolId}-${segment.tokenIn}-${segment.tokenOut}`
            )
            .join('_');
    }

    private filterVolatilePools(poolAddresses: string[]): string[] {
        return poolAddresses.filter(
            (address) =>
                this.poolAddressMap[address].poolType === PoolTypes.Weighted
        );
    }

    //TODO: just for testing
    private getTokenSymbol(tokenAddress: string): string {
        const allTokens = Object.values(this.poolAddressMap)
            .map((pool) => pool.tokens)
            .flat();

        const token = allTokens.find(
            (token) =>
                token.address.toLowerCase() === tokenAddress.toLowerCase()
        );

        return (token as unknown as { symbol: string })?.symbol || '';
    }
}

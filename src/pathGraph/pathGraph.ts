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

export class PathGraph {
    private graph: Graph = new Graph({ multigraph: true });
    private poolAddressMap: PoolAddressDictionary = {};
    private graphIsInitialized = false;
    private maxPathsPerTokenPair = 2;

    public get isGraphInitialized(): boolean {
        return this.graphIsInitialized;
    }

    // We build a directed graph for all pools.
    // Nodes are tokens and edges are triads: [pool.id, tokenIn, tokenOut].
    // The current criterion for including a pool path into this graph is the following:
    // (a) We include every pool with phantom BPTs.
    // (b) For any token pair x -> y, we include only the most liquid ${maxPathsPerTokenPair}
    // pool pairs (default 2).
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

    // Since the path combinations here can get quite large, we use configurable parameters
    // to enforce upper limits across several dimensions, defined in the pathConfig.
    // (a) maxDepth - the max depth of the traversal (length of token path), defaults to 7.
    // (b) maxNonBoostedPathDepth - the max depth for any path that does not contain a phantom bpt.
    // (c) maxNonBoostedHopTokensInBoostedPath - The max number of non boosted hop tokens
    // allowed in a boosted path.
    // (d) approxPathsToReturn - search for up to this many paths. Since all paths for a single traversal
    // are added, its possible that the amount returned is larger than this number.
    // (e) poolIdsToInclude - Only include paths with these poolIds (optional)

    // Additionally, we impose the following requirements for a path to be considered valid
    // (a) It does not visit the same token twice
    // (b) It does not use the same pool twice
    public traverseGraphAndFindBestPaths({
        tokenIn,
        tokenOut,
        pathConfig,
    }: {
        tokenIn: string;
        tokenOut: string;
        pathConfig?: Partial<PathGraphTraversalConfig>;
    }): NewPath[] {
        if (!this.graph.hasNode(tokenIn) || !this.graph.hasNode(tokenOut)) {
            return [];
        }

        // apply defaults, allowing caller override whatever they'd like
        const config: PathGraphTraversalConfig = {
            maxDepth: 7,
            maxNonBoostedPathDepth: 2,
            maxNonBoostedHopTokensInBoostedPath: 1,
            approxPathsToReturn: 10,
            ...pathConfig,
        };

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
                        tokenIn,
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

        return paths.map((path) => {
            return {
                id: path.map((segment) => segment.poolId).join('_'),
                swaps: path.map((segment) => ({
                    pool: segment.poolId,
                    tokenIn: segment.tokenIn,
                    tokenOut: segment.tokenOut,
                    tokenInDecimals: this.getTokenDecimals(segment.tokenIn),
                    tokenOutDecimals: this.getTokenDecimals(segment.tokenOut),
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
        tokenIn,
        tokenOut,
        tokenPath,
        tokenPairIndex,
        config,
        seenPoolAddresses,
        selectedPathIds,
    }: {
        token: string;
        tokenIn: string;
        tokenOut: string;
        tokenPath: string[];
        tokenPairIndex: number;
        config: PathGraphTraversalConfig;
        seenPoolAddresses: string[];
        selectedPathIds: string[];
    }): null | PathGraphEdge[] {
        if (!this.isValidTokenPath({ tokenPath, config, tokenIn, tokenOut })) {
            return null;
        }

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
                    seenPoolAddresses,
                    selectedPathIds,
                    config,
                })
            ) {
                return path;
            }
        }

        // we peek ahead one level, and optimistically sort the successors
        const sortedAndFiltered = sortBy(successors, (successor) => {
            const children = this.graph.successors(successor) || [];
            return children.includes(tokenOut) ? -1 : 1;
        }).filter((successor) => !tokenPath.includes(successor));

        for (const successor of sortedAndFiltered) {
            const result = this.traverseGraphAndFindUniquePath({
                token: successor,
                tokenIn,
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
        seenPoolAddresses,
        selectedPathIds,
        config,
    }: {
        path: PathGraphEdge[];
        seenPoolAddresses: string[];
        selectedPathIds: string[];
        config: PathGraphTraversalConfig;
    }) {
        if (config.poolIdsToInclude) {
            for (const edge of path) {
                if (!config.poolIdsToInclude.includes(edge.poolId)) {
                    //path includes a pool that is not allowed for this traversal
                    return false;
                }
            }
        }

        const isBoostedPath =
            path.filter(
                (edge) =>
                    this.poolAddressMap[edge.tokenIn] ||
                    this.poolAddressMap[edge.tokenOut]
            ).length > 0;

        if (!isBoostedPath && path.length + 1 > config.maxNonBoostedPathDepth) {
            return false;
        }

        const uniquePools = uniq(path.map((edge) => edge.poolId));

        //dont include any path that hops through the same pool twice
        if (uniquePools.length !== path.length) {
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

    private isValidTokenPath({
        tokenPath,
        config,
        tokenIn,
        tokenOut,
    }: {
        tokenPath: string[];
        config: PathGraphTraversalConfig;
        tokenIn: string;
        tokenOut: string;
    }) {
        const hopTokens = tokenPath.filter(
            (token) => token !== tokenIn && token !== tokenOut
        );
        const numStandardHopTokens = hopTokens.filter(
            (token) => !this.poolAddressMap[token]
        ).length;
        const isBoostedPath =
            tokenPath.filter((token) => this.poolAddressMap[token]).length > 0;

        if (tokenPath.length > config.maxDepth) {
            return false;
        }

        if (
            isBoostedPath &&
            numStandardHopTokens > config.maxNonBoostedHopTokensInBoostedPath
        ) {
            return false;
        }

        return true;
    }

    private getTokenDecimals(tokenAddress: string): number {
        const allTokens = Object.values(this.poolAddressMap)
            .map((pool) => pool.tokens)
            .flat();

        const token = allTokens.find(
            (token) =>
                token.address.toLowerCase() === tokenAddress.toLowerCase()
        );

        return token?.decimals || 18;
    }
}

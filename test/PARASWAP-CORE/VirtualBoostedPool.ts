import { getAddress } from '@ethersproject/address';
import { Interface } from '@ethersproject/abi';
import { BZERO } from './basicOperations';
import { LinearPool } from './LinearPool';
import { PhantomStablePool } from './PhantomStablePool';
import { PoolState, TokenState, SubgraphPoolBase, callData } from './types';

export class VirtualBoostedPool {
    /*
    VirtualBoostedPool information where a VirtualBoostedPool is a combination of Linear pools nested in a PhantomStable pool. i.e. bb-a-USD
    mainToken are the underlying mainTokens of the Linear Pools and will be seen as the tokens the VirtualPool contains.
    i.e. bb-a-USD VirtualBoostedPool will look like it has USDC, DAI, USDT and bb-a-USD_bpt
    phantomStablePool is the PhantomStablePool connecting all LinearPools
    linearPools is the list of LinearPools
    Initially this will be a hardcoded list but can be added to Subgraph to be more scalable.
    */
    virtualBoostedPools = {
        '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2': {
            mainTokens: [
                {
                    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
                    decimals: 18,
                    linearPool: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
                }, // DAI
                {
                    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    decimals: 6,
                    linearPool: '0x9210f1204b5a24742eba12f710636d76240df3d0',
                }, // USDC
                {
                    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                    decimals: 6,
                    linearPool: '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c',
                }, // USDT
            ],
            phantomStablePool: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
            linearPools: [
                {
                    address: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
                    id: '0x804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000fb',
                },
                {
                    address: '0x9210f1204b5a24742eba12f710636d76240df3d0',
                    id: '0x9210f1204b5a24742eba12f710636d76240df3d00000000000000000000000fc',
                },
                {
                    address: '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c',
                    id: '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c0000000000000000000000fd',
                },
            ],
        },
    };

    // Creates and returns VirtualBoostedPools contained in pools list
    getVirtualBoostedPools(pools: SubgraphPoolBase[]): SubgraphPoolBase[] {
        const virtualBoostedPools: SubgraphPoolBase[] = [];
        pools.forEach((pool) => {
            if (this.virtualBoostedPools[pool.address])
                virtualBoostedPools.push({
                    id: pool.id,
                    address: pool.address,
                    poolType: 'VirtualBoosted',
                    tokens: this.virtualBoostedPools[pool.address].mainTokens,
                });
        });

        return virtualBoostedPools;
    }

    /*
    Creates multicall data for a VirtualBoostedPool which can be passed to multicall contract.
    Retrieves following onchain data:
    PhantomStable - scaling factors, amp (assumes poolTokens and swapFee are constructed elsewhere)
    LinearPools - (for each Linear Pool) pooltokens/balances, swapFee, scalingfactors, main/wrapped/bpt indices, targets
    */
    getOnChainCalls(
        pool: SubgraphPoolBase,
        vaultAddress: string,
        vaultInterface: Interface,
        poolInterfaces: { [type: string]: Interface }
    ): callData[] {
        // Add calls for PhantomStable Pool
        // Assumes poolTokens and swapFee callData are already added in main getOnChainState
        const poolCallData: callData[] = [];
        // Add scaling factors for upper PhantomStablePool
        poolCallData.push({
            target: pool.address,
            callData:
                poolInterfaces['MetaStable'].encodeFunctionData(
                    'getScalingFactors'
                ),
        });
        // Add amp parameter for upper PhantomStable Pool
        poolCallData.push({
            target: pool.address,
            callData: poolInterfaces['MetaStable'].encodeFunctionData(
                'getAmplificationParameter'
            ),
        });

        // Add calls for each linear pool
        this.virtualBoostedPools[pool.address].linearPools.forEach(
            (linearPool) => {
                poolCallData.push({
                    target: vaultAddress,
                    callData: vaultInterface.encodeFunctionData(
                        'getPoolTokens',
                        [linearPool.id]
                    ),
                });
                poolCallData.push({
                    target: linearPool.address,
                    callData: poolInterfaces['Weighted'].encodeFunctionData(
                        'getSwapFeePercentage'
                    ),
                });
                poolCallData.push({
                    target: linearPool.address,
                    callData:
                        poolInterfaces['Linear'].encodeFunctionData(
                            'getScalingFactors'
                        ),
                });
                poolCallData.push({
                    target: linearPool.address,
                    callData:
                        poolInterfaces['Linear'].encodeFunctionData(
                            'getMainIndex'
                        ),
                });
                poolCallData.push({
                    target: linearPool.address,
                    callData:
                        poolInterfaces['Linear'].encodeFunctionData(
                            'getWrappedIndex'
                        ),
                });
                poolCallData.push({
                    target: linearPool.address,
                    callData:
                        poolInterfaces['Linear'].encodeFunctionData(
                            'getBptIndex'
                        ),
                });
                // returns lowerTarget, upperTarget
                poolCallData.push({
                    target: linearPool.address,
                    callData:
                        poolInterfaces['Linear'].encodeFunctionData(
                            'getTargets'
                        ),
                });
            }
        );
        return poolCallData;
    }

    /*
    Decodes multicall data for a VirtualBoostedPool.
    data must contain returnData
    startIndex is where to start in returnData. Allows this decode function to be called along with other pool types.
    */
    decodeOnChainCalls(
        pool: SubgraphPoolBase,
        poolInterfaces: { [type: string]: Interface },
        vaultInterface: Interface,
        data: any,
        startIndex: number
    ): [{ [address: string]: PoolState }, number] {
        const pools = {};
        const poolTokens = vaultInterface.decodeFunctionResult(
            'getPoolTokens',
            data.returnData[startIndex++]
        );

        const swapFee = poolInterfaces['Weighted'].decodeFunctionResult(
            'getSwapFeePercentage',
            data.returnData[startIndex++]
        )[0];

        const scalingFactors = poolInterfaces[
            'MetaStable'
        ].decodeFunctionResult(
            'getScalingFactors',
            data.returnData[startIndex++]
        )[0];

        const amp = poolInterfaces['Stable'].decodeFunctionResult(
            'getAmplificationParameter',
            data.returnData[startIndex++]
        );

        const poolState: PoolState = {
            swapFee: BigInt(swapFee.toString()),
            tokens: poolTokens.tokens.reduce(
                (
                    ptAcc: { [address: string]: TokenState },
                    pt: string,
                    j: number
                ) => {
                    const tokenState: TokenState = {
                        balance: BigInt(poolTokens.balances[j].toString()),
                    };

                    if (scalingFactors)
                        tokenState.scalingFactor = BigInt(
                            scalingFactors[j].toString()
                        );

                    ptAcc[pt.toLowerCase()] = tokenState;
                    return ptAcc;
                },
                {}
            ),
        };

        poolState.amp = BigInt(amp.value.toString());

        pools[pool.address.toLowerCase()] = poolState;

        this.virtualBoostedPools[pool.address].linearPools.forEach(
            (linearPool) => {
                const poolTokens = vaultInterface.decodeFunctionResult(
                    'getPoolTokens',
                    data.returnData[startIndex++]
                );

                const swapFee = poolInterfaces['Weighted'].decodeFunctionResult(
                    'getSwapFeePercentage',
                    data.returnData[startIndex++]
                )[0];

                const scalingFactors = poolInterfaces[
                    'MetaStable'
                ].decodeFunctionResult(
                    'getScalingFactors',
                    data.returnData[startIndex++]
                )[0];

                const mainIndex = poolInterfaces['Linear'].decodeFunctionResult(
                    'getMainIndex',
                    data.returnData[startIndex++]
                );

                const wrappedIndex = poolInterfaces[
                    'Linear'
                ].decodeFunctionResult(
                    'getWrappedIndex',
                    data.returnData[startIndex++]
                );

                const bptIndex = poolInterfaces['Linear'].decodeFunctionResult(
                    'getBptIndex',
                    data.returnData[startIndex++]
                );

                const [lowerTarget, upperTarget] = poolInterfaces[
                    'Linear'
                ].decodeFunctionResult(
                    'getTargets',
                    data.returnData[startIndex++]
                );

                const poolState: PoolState = {
                    swapFee: BigInt(swapFee.toString()),
                    mainIndex: Number(mainIndex),
                    wrappedIndex: Number(wrappedIndex),
                    bptIndex: Number(bptIndex),
                    lowerTarget: BigInt(lowerTarget.toString()),
                    upperTarget: BigInt(upperTarget.toString()),
                    tokens: poolTokens.tokens.reduce(
                        (
                            ptAcc: { [address: string]: TokenState },
                            pt: string,
                            j: number
                        ) => {
                            const tokenState: TokenState = {
                                balance: BigInt(
                                    poolTokens.balances[j].toString()
                                ),
                            };

                            if (scalingFactors)
                                tokenState.scalingFactor = BigInt(
                                    scalingFactors[j].toString()
                                );

                            ptAcc[pt.toLowerCase()] = tokenState;
                            return ptAcc;
                        },
                        {}
                    ),
                };

                pools[linearPool.address] = poolState;
            }
        );

        return [pools, startIndex];
    }

    // Finds the address and poolType the tokenAddr belongs to
    getTokenPool(
        boostedPoolAddr: string,
        tokenAddr: string
    ): {
        address: string;
        type: string;
    } {
        if (getAddress(boostedPoolAddr) === getAddress(tokenAddr))
            return {
                address: boostedPoolAddr,
                type: 'StablePhantom',
            };

        const boostedPool = this.virtualBoostedPools[boostedPoolAddr];
        const index = boostedPool.mainTokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenAddr)
        );
        if (index < 0) throw Error('Token missing');

        return {
            address: boostedPool.mainTokens[index].linearPool,
            type: 'Linear',
        };
    }

    _calcOutGivenIn(
        tokenIn: string,
        tokenOut: string,
        boostedPool: string,
        poolStates: { [address: string]: PoolState },
        tokenAmountsIn: bigint[]
    ): bigint[] {
        const poolIn = this.getTokenPool(boostedPool, tokenIn);
        const poolOut = this.getTokenPool(boostedPool, tokenOut);

        const linearPool = new LinearPool();
        const phantomStablePool = new PhantomStablePool();

        // Find where tokenIn/Out fits, i.e. boosted or phantom
        if (poolIn.type === 'Linear' && poolOut.type === 'Linear') {
            console.log(`tokenIn[Linear]inBpt[Stable]outBpt[Linear]tokenOut`);
            // Find pools of interest
            const linearIn = poolStates[poolIn.address];
            const stablePhantom = poolStates[boostedPool];
            const linearOut = poolStates[poolOut.address];

            if (
                linearIn.bptIndex === undefined ||
                linearIn.mainIndex === undefined ||
                linearIn.wrappedIndex === undefined ||
                linearIn.lowerTarget === undefined ||
                linearIn.upperTarget === undefined ||
                stablePhantom.amp === undefined ||
                linearOut.bptIndex === undefined ||
                linearOut.mainIndex === undefined ||
                linearOut.wrappedIndex === undefined ||
                linearOut.lowerTarget === undefined ||
                linearOut.upperTarget === undefined
            )
                throw 'Pool missing data';

            const linearInTokens = Object.values(linearIn.tokens);
            const stablePhantomTokens = Object.values(stablePhantom.tokens);
            const linearOutTokens = Object.values(linearOut.tokens);
            const linearInTokenAddrs = Object.keys(linearIn.tokens);
            const linearOutTokenAddrs = Object.keys(linearOut.tokens);
            const stablePhantomTokenAddrs = Object.keys(stablePhantom.tokens);

            // First hop through Linear Pool of tokenIn
            const amtOutLinearOne = linearPool._swapGivenIn(
                tokenAmountsIn,
                linearInTokenAddrs,
                linearInTokens.map((t) => t.balance),
                linearIn.mainIndex, // indexIn
                linearIn.bptIndex, // indexOut
                linearIn.bptIndex, // bptIndex
                linearIn.wrappedIndex, // wrappedIndex
                linearIn.mainIndex, // mainIndex
                linearInTokens.map((t) =>
                    t.scalingFactor ? t.scalingFactor : BZERO
                ),
                linearIn.swapFee,
                linearIn.lowerTarget,
                linearIn.upperTarget
            );

            // Second hop through PhantomStable inbpt>outbpt
            const amtOutPhantomStable = phantomStablePool._swapGivenIn(
                amtOutLinearOne,
                stablePhantomTokenAddrs,
                stablePhantomTokens.map((t) => t.balance),
                stablePhantomTokenAddrs.indexOf(
                    linearInTokenAddrs[linearIn.bptIndex]
                ), // indexIn
                stablePhantomTokenAddrs.indexOf(
                    linearOutTokenAddrs[linearOut.bptIndex]
                ), // indexOut
                stablePhantomTokenAddrs.indexOf(boostedPool), // bptIndex
                stablePhantomTokens.map((t) =>
                    t.scalingFactor ? t.scalingFactor : BZERO
                ),
                stablePhantom.swapFee,
                stablePhantom.amp
            );

            // Last hop through Linear Pool of tokenOut
            const amtOutLinearTwo = linearPool._swapGivenIn(
                amtOutPhantomStable,
                Object.keys(linearOut.tokens),
                linearOutTokens.map((t) => t.balance),
                linearOut.bptIndex, // indexIn
                linearOut.mainIndex, // indexOut
                linearOut.bptIndex, // bptIndex
                linearOut.wrappedIndex,
                linearOut.mainIndex, // mainIndex
                linearOutTokens.map((t) =>
                    t.scalingFactor ? t.scalingFactor : BZERO
                ),
                linearOut.swapFee,
                linearOut.lowerTarget,
                linearOut.upperTarget
            );

            return amtOutLinearTwo;
        } else if (
            poolIn.type === 'Linear' &&
            poolOut.type === 'StablePhantom'
        ) {
            console.log(`tokenIn[Linear]inBpt[Stable]tokenOut`);
            // TO DO - Add this implementation when agreed
        } else if (
            poolIn.type === 'StablePhantom' &&
            poolOut.type === 'Linear'
        ) {
            console.log(`tokenIn[Stable]outBpt[Linear]tokenOut`);
            // TO DO - Add this implementation when agreed
        } else {
            console.error('Incorrect swap type');
            return [BZERO];
        }

        return [BZERO];
    }
}

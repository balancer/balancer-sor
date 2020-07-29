import { pack, keccak256 } from '@ethersproject/solidity';
import { getCreate2Address } from '@ethersproject/address';
import { ethers, utils } from 'ethers';
import { Web3Provider, JsonRpcProvider } from 'ethers/providers';
import { BigNumber } from './utils/bignumber';
import { BONE } from './bmath';

const FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const INIT_CODE_HASH =
    '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f';

export function getAddress(tokenA: string, tokenB: string): string {
    const tokens =
        tokenA.toLowerCase() < tokenB.toLowerCase()
            ? [tokenA, tokenB]
            : [tokenB, tokenA];

    let address = getCreate2Address(
        FACTORY_ADDRESS,
        keccak256(
            ['bytes'],
            [pack(['address', 'address'], [tokens[0], tokens[1]])]
        ),
        INIT_CODE_HASH
    );

    return address;
}

export async function getOnChainReserves(
    PairAddr: string,
    provider: Web3Provider
): Promise<any[]> {
    const uniswapV2PairAbi = require('./abi/UniswapV2Pair.json');

    const pairContract = new ethers.Contract(
        PairAddr,
        uniswapV2PairAbi,
        provider
    );

    let [reserve0, reserve1, blockTimestamp] = await pairContract.getReserves();

    return [reserve0, reserve1];
}

export async function getTokenWeiPrice(
    TokenAddr: string,
    provider: Web3Provider
): Promise<BigNumber> {
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    let addr = getAddress(WETH, TokenAddr);
    let [reserve0, reserve1] = await getOnChainReserves(addr, provider);

    const numerator = new BigNumber(reserve0.toString());
    const denominator = new BigNumber(reserve1.toString());

    const price1eth = numerator.div(denominator);
    return price1eth.times(BONE);
}

export function calculateTotalSwapCost(
    TokenPrice: BigNumber,
    SwapCost: BigNumber,
    GasPriceWei: BigNumber
): BigNumber {
    return GasPriceWei.times(SwapCost)
        .times(TokenPrice)
        .div(BONE);
}

export async function getCostOutputToken(
    TokenAddr: string,
    TokenDecimals: number,
    GasPriceWei: BigNumber,
    SwapGasCost: BigNumber,
    Provider: Web3Provider
): Promise<BigNumber> {
    let network = await Provider.getNetwork();

    // If not mainnet return 0 as UniSwap price unlikely to be correct?
    // Provider can be used to fetch token data (i.e. Decimals) via UniSwap SDK when Ethers V5 is used
    if (network.chainId !== 1) return new BigNumber(0);

    let tokenPrice = new BigNumber(0);
    try {
        tokenPrice = await getTokenWeiPrice(TokenAddr, Provider);
    } catch (err) {
        // If no pool for provided address (or addr incorrect) then default to 0
        console.log('Error Getting Token Price. Defaulting to 0.');
    }

    let costOutputToken = calculateTotalSwapCost(
        tokenPrice,
        SwapGasCost,
        GasPriceWei
    );
    return costOutputToken;
}

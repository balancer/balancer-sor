import { getCreate2Address } from '@ethersproject/address';
import { Contract } from '@ethersproject/contracts';
import { BaseProvider } from '@ethersproject/providers';
import { keccak256, pack } from '@ethersproject/solidity';
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

    const address = getCreate2Address(
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
    provider: BaseProvider
): Promise<[BigNumber, BigNumber]> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const uniswapV2PairAbi = require('./abi/UniswapV2Pair.json');

    const pairContract = new Contract(PairAddr, uniswapV2PairAbi, provider);

    const [reserve0, reserve1] = await pairContract.getReserves();

    return [reserve0, reserve1];
}

export async function getTokenWeiPrice(
    TokenAddr: string,
    provider: BaseProvider
): Promise<BigNumber> {
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    if (TokenAddr.toLowerCase() === WETH.toLowerCase())
        return new BigNumber(BONE);

    const addr = getAddress(WETH, TokenAddr);
    const [reserve0, reserve1] = await getOnChainReserves(addr, provider);

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
    GasPriceWei: BigNumber,
    SwapGasCost: BigNumber,
    Provider: BaseProvider,
    ChainId: number = undefined
): Promise<BigNumber> {
    if (!ChainId) {
        const network = await Provider.getNetwork();
        ChainId = network.chainId;
    }
    // If not mainnet return 0 as UniSwap price unlikely to be correct?
    // Provider can be used to fetch token data (i.e. Decimals) via UniSwap SDK when Ethers V5 is used
    if (ChainId !== 1) return new BigNumber(0);
    let tokenPrice = new BigNumber(0);
    try {
        tokenPrice = await getTokenWeiPrice(TokenAddr, Provider);
    } catch (err) {
        // console.log(err)
        // If no pool for provided address (or addr incorrect) then default to 0
        console.log('Error Getting Token Price. Defaulting to 0.');
    }

    const costOutputToken = calculateTotalSwapCost(
        tokenPrice,
        SwapGasCost,
        GasPriceWei
    );

    return costOutputToken;
}

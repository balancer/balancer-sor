require('dotenv').config();

const {
    WebSocketProvider,
    JsonRpcProvider,
} = require('@ethersproject/providers');
// const { SOR } = require('@balancer-labs/sor');
const { SOR } = require('../../src');
const BigNumber = require('bignumber.js');

const APP_CHAIN_ID = parseInt(process.env.APP_CHAIN_ID);
const APP_GAS_PRICE = process.env.APP_GAS_PRICE;
const APP_MAX_POOLS = process.env.APP_MAX_POOLS;
const ALCHEMY_WS_ENDPOINT = process.env.ALCHEMY_WS_ENDPOINT;

async function calculate() {
    const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const MKR = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2';
    const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
    const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const BAL = '0xba100000625a3754423978a60c9317c58a424e3d';

    await calculateForPair(WETH, DAI, '1e18', 'swapExactOut');
    await calculateForPair(WETH, MKR, '1e18', 'swapExactIn');
    await calculateForPair(WETH, MKR, '1e18', 'swapExactOut');
    await calculateForPair(WETH, DAI, '1e18', 'swapExactIn');
    await calculateForPair(USDC, BAL, '1e18', 'swapExactOut');
    await calculateForPair(USDC, BAL, '1e17', 'swapExactOut');
    // await calculateForPair(WETH, DAI, 'swapExactOut');
    console.log(`END!!!`);
}

async function calculateForPair(tokenIn, tokenOut, amountStr, swapType) {
    console.log('Init SOR');
    const wsProvider = new WebSocketProvider(ALCHEMY_WS_ENDPOINT, APP_CHAIN_ID);
    /*
	const wsProvider = new JsonRpcProvider(
			`https://mainnet.infura.io/v3/${process.env.INFURA}`
	);
	*/
    const gasPrice = new BigNumber('30000000000');

    const sor = new SOR(
        wsProvider,
        new BigNumber(APP_GAS_PRICE),
        parseInt(APP_MAX_POOLS),
        APP_CHAIN_ID
    );

    const amount = new BigNumber(amountStr);

    console.log('Fetch pools');
    // await sor.fetchFilteredPairPools(tokenIn, tokenOut);
    await sor.fetchPools();
    console.log('Get swaps');
    // await sor.setCostOutputToken(tokenOut); // Use this to compare to UI

    const [tradeSwaps, tradeAmount] = await sor.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amount
    );
    console.log('Swaps', tradeSwaps.length, tradeAmount.toString());
}

calculate();

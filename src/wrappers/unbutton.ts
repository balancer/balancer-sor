import { BigNumber } from '@ethersproject/bignumber';
import { Provider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';
import { WeiPerEther as ONE } from '@ethersproject/constants';

// The unbutton ERC-20 wrapper is a generic wrapper which wraps any rebasing token
// into a fixed balance version.
// https://github.com/buttonwood-protocol/button-wrappers/blob/main/contracts/UnbuttonToken.sol#L18

export const TokensToUnbuttonWrapperMap = {
    Networks: [1],
    1: {
        // underlying => wrapper

        // AMPL => WAMPL
        '0xd46ba6d942050d489dbd938a2c909a5d5039a161':
            '0xedb171c18ce90b633db442f2a6f72874093b49ef',

        // aAMPL -> ubAAMPL
        '0x1e6bb68acec8fefbd87d192be09bb274170a0548':
            '0xF03387d8d0FF326ab586A58E0ab4121d106147DF',
    },
};

// Returns the current wrapper exchange rate,
// ie) number of wrapper tokens for 1e18 (ONE) underlying token
export async function getWrapperRate(
    provider: Provider,
    wrapperAddress: string
): Promise<BigNumber> {
    const ubWrapper = new Contract(
        wrapperAddress,
        [
            'function underlyingToWrapper(uint256 amount) external view returns (uint256)',
        ],
        provider
    );
    return ubWrapper.underlyingToWrapper(ONE);
}

// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/xaveFxPool.math.spec.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { expect } from 'chai';

import {
    viewRawAmount,
    viewNumeraireAmount,
} from '../src/pools/xaveFxPool/fxPoolMath';
import { BigNumber } from '@ethersproject/bignumber';
import { safeParseFixed } from '../src/utils';
import { parseFixedCurveParam } from '../src/pools/xaveFxPool/parseFixedCurveParam';

context('xaveFxPool: fxMath functions', () => {
    const tokenDecimals = 6;
    const tokenFxRateDecimals = 8;
    const rate = BigNumber.from('74376600'); // 0.743766

    it(`should correctly return 'viewRawAmount'`, async () => {
        const rawAmount = viewRawAmount(
            safeParseFixed('10000', 36),
            tokenDecimals,
            rate,
            tokenFxRateDecimals
        );
        const expected = '13445088912';
        expect(rawAmount.toString()).to.eq(expected);
    });

    it(`should correctly return large 'viewRawAmount'`, async () => {
        const rawAmount = viewRawAmount(
            safeParseFixed('10000', 45),
            tokenDecimals,
            rate,
            tokenFxRateDecimals
        );
        const expected = '13445088912372977522';
        expect(rawAmount.toString()).to.eq(expected);
    });

    it(`should correctly return 'viewNumeraireAmount' values`, async () => {
        const numerarieAmount = viewNumeraireAmount(
            safeParseFixed('13445088912', 36),
            tokenDecimals,
            rate,
            tokenFxRateDecimals
        );
        const expected = safeParseFixed('9999.999999', 36);
        expect(numerarieAmount.toString()).to.eq(expected.toString());
    });

    it('should correctly parse FXPool parameters', async () => {
        // @todo ABDK's UI (https://toolkit.abdk.consulting/math#convert-number)
        // returns 273437500000000000.867 for '0.2734375'
        expect(parseFixedCurveParam('0.2734375').toString()).to.eq(
            '273437500000000000.976'
        );
        expect(parseFixedCurveParam('0.8').toString()).to.eq(
            '800000000000000000.987'
        );
        // @todo ABDK's UI
        // returns 0.00050000000000000099 for '0.0005'
        expect(parseFixedCurveParam('0.0005').toString()).to.eq(
            '500000000000000.987'
        );
    });
});

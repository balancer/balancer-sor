// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/math.spec.ts
import { BPTForTokensZeroPriceImpact } from '../src/frontendHelpers/phantomStableHelpers';

describe('frontend helpers', () => {
    context('BPTForTokensZeroPriceImpact', () => {
        it('phantomStable', () => {
            const result = BPTForTokensZeroPriceImpact(
                ['1000000000', '1000000000', '1000000000'],
                [18, 18, 18],
                [1000000, 1000000, 1000000],
                '1000000000',
                '10',
                '100000000000000', // 0.01%
                [
                    '1100000000000000000',
                    '1000000000000000000',
                    '1000000000000000000',
                ]
            );
            console.log(result.toString());
        });
    });
});

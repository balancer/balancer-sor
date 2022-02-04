// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { expect } from 'chai';
import { BZERO } from '../src/utils/basicOperations';

import { mockWeightedPool, mockLinearPool } from './testData/mockPools';
import { poolToEvm } from './PARASWAP/utils';
import { parseFixed } from '@ethersproject/bignumber';

// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/paraswap.spec.ts
describe(`Paraswap`, () => {
    context('poolToEvm', () => {
        it(`weighted`, () => {
            const evmPool = poolToEvm(mockWeightedPool);
            expect(evmPool.address).to.eq(mockWeightedPool.address);
            expect(evmPool.amp).to.eq(BZERO);
            expect(evmPool.totalWeight).to.eq(BigInt(1e18));
            expect(evmPool.tokens[0].balance).to.eq(BigInt(2388717700457));
        });

        it(`linear`, () => {
            const evmPool = poolToEvm(mockLinearPool);
            expect(evmPool.address).to.eq(mockLinearPool.address);
            expect(evmPool.amp).to.eq(BZERO);
            expect(evmPool.totalWeight).to.eq(BZERO);
            expect(evmPool.lowerTarget.toString()).to.eq(
                parseFixed('2900000', 18).toString()
            );
        });
    });
});

import * as linear from '../src/poolsMath/linear';
import { MathSol } from '../src/poolsMath/basicOperations';
import { assert } from 'chai';

describe('poolsMathLinear', function () {
    const ERROR = 1e-14; // 1e-14

    const params = {
        fee: s(0.01),
        rate: s(1),
        lowerTarget: s(1000),
        upperTarget: s(2000),
    };

    describe('init', () => {
        it('given main in', async () => {
            params.rate = s(1);
            const mainIn = s(1);
            const mainBalance = s(0);
            const wrappedBalance = s(0);
            const bptSupply = s(0);

            const bptIn = linear._calcBptOutPerMainIn(
                mainIn,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
            verify(bptIn, s(1.010101010101010101), ERROR);
        });

        it('given BPT out', async () => {
            params.rate = s(1);
            const bptOut = s(1.010101010101010102);
            const mainBalance = s(0);
            const wrappedBalance = s(0);
            const bptSupply = s(0);

            const mainIn = linear._calcMainInPerBptOut(
                bptOut,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
            verify(mainBalance + mainIn, s(1), ERROR);
        });
    });

    describe('swap bpt & main', () => {
        it('given main in', async () => {
            params.rate = s(1);
            const mainIn = s(100);
            const mainBalance = s(1);
            const wrappedBalance = s(0);
            const bptSupply = s(1.010101010101010101);

            const bptOut = linear._calcBptOutPerMainIn(
                mainIn,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
            verify(bptSupply + bptOut, s(102.020202020202020202), ERROR);
        });

        it('given BPT out', async () => {
            params.rate = s(1.3);
            const bptOut = s(100);
            const mainBalance = s(455.990803937038319103);
            const wrappedBalance = s(138.463846384639);
            const bptSupply = s(704.587755444953);

            const mainIn = linear._calcMainInPerBptOut(
                bptOut,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
            verify(mainBalance + mainIn, s(546), ERROR);
        });

        it('given BPT in', async () => {
            params.rate = s(1.3);
            const bptIn = s(100);
            const mainBalance = s(546);
            const wrappedBalance = s(138.463846384639);
            const bptSupply = s(804.587755444953);

            const mainOut = linear._calcMainOutPerBptIn(
                bptIn,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
            verify(mainBalance - mainOut, s(455.990803937038319103), ERROR);
        });

        it('given main out', async () => {
            params.rate = s(1);
            const mainOut = s(50);
            const mainBalance = s(101);
            const wrappedBalance = s(0);
            const bptSupply = s(102.020202020202020202);

            const bptIn = linear._calcBptInPerMainOut(
                mainOut,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
            verify(bptSupply - bptIn, s(51.515151515151515151), ERROR);
        });
    });

    describe('swap main & wrapped', () => {
        it('given main out', async () => {
            params.rate = s(1);
            const mainOut = s(10);
            const mainBalance = s(51);
            const wrappedBalance = s(0);

            const wrappedIn = linear._calcWrappedInPerMainOut(
                mainOut,
                mainBalance,
                params
            );
            verify(wrappedBalance + wrappedIn, s(10.10101010101010101), ERROR);
        });

        it('given main in', async () => {
            params.rate = s(1);
            const mainIn = s(5);
            const mainBalance = s(41);
            const wrappedBalance = s(10.10101010101010101);

            const wrappedOut = linear._calcWrappedOutPerMainIn(
                mainIn,
                mainBalance,
                params
            );
            verify(wrappedBalance - wrappedOut, s(5.050505050505050505), ERROR);
        });

        it('given wrapped out', async () => {
            params.rate = s(1.3);
            const wrappedOut = s(900);
            const mainBalance = s(931.695980314809);

            const mainIn = linear._calcMainInPerWrappedOut(
                wrappedOut,
                mainBalance,
                params
            );
            verify(mainBalance + mainIn, s(2102.21812133126978788), ERROR);
        });

        it('given wrapped in', async () => {
            params.rate = s(1.3);
            const wrappedIn = s(50);
            const mainBalance = s(996.10705082304);

            const mainOut = linear._calcMainOutPerWrappedIn(
                wrappedIn,
                mainBalance,
                params
            );
            verify(mainBalance - mainOut, s(931.6959803148096), ERROR);
        });
    });

    describe('swap bpt & wrapped', () => {
        it('given wrapped in', async () => {
            params.rate = s(1);
            const wrappedIn = s(50);
            const wrappedBalance = s(0);
            const mainBalance = s(101);
            const bptSupply = s(102.020202020202);

            const bptOut = linear._calcBptOutPerWrappedIn(
                wrappedIn,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
            verify(bptSupply + bptOut, s(152.020202020202), ERROR);
        });

        it('given BPT out', async () => {
            params.rate = s(1.2);
            const bptOut = s(10);
            const mainBalance = s(101);
            const wrappedBalance = s(131);
            const bptSupply = s(242.692607692922);

            const wrappedIn = linear._calcWrappedInPerBptOut(
                bptOut,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
            verify(wrappedBalance + wrappedIn, s(139.900841153356), ERROR);
        });

        it('given BPT in', async () => {
            params.rate = s(1);
            const bptIn = s(10);
            const mainBalance = s(101);
            const wrappedBalance = s(131);
            const bptSupply = s(242.692607692922);

            const wrappedOut = linear._calcWrappedOutPerBptIn(
                bptIn,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
            verify(wrappedBalance - wrappedOut, s(121.398545541402), ERROR);
        });

        it('given wrapped out', async () => {
            params.rate = s(1.3);
            const wrappedOut = s(10);
            const wrappedBalance = s(70);
            const mainBalance = s(101);
            const bptSupply = s(172.020202020202020202);

            const bptIn = linear._calcBptInPerWrappedOut(
                wrappedOut,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
            verify(bptSupply - bptIn, s(160.434561745986), ERROR);
        });
    });
});

function s(a: number): bigint {
    return BigInt(a * 10 ** 18);
}

function verify(result: bigint, expected: bigint, error: number): void {
    assert.approximately(
        Number(MathSol.divUpFixed(result, expected)) / 10 ** 18,
        1,
        error,
        'wrong result'
    );
}

import * as linear from '../src/poolsMath/linear';
import { MathSol } from '../src/poolsMath/basicOperations';
import { assert } from 'chai';

describe('poolsMathLinear', function () {
    describe('init', () => {
        const params = {
            fee: s(0.01),
            rate: s(1),
            lowerTarget: s(0),
            upperTarget: s(200),
        };

        const mainBalance = s(0);
        const wrappedBalance = s(0);
        const bptSupply = s(0);

        it('debug given main in within lower and upper', async () => {
            const mainIn = s(5);
            const result = linear._calcBptOutPerMainIn(
                mainIn,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
            verify(result, s(5), 0);
        });

        it('debug given main in over upper', async () => {
            const mainIn = s(400);
            const result = linear._calcBptOutPerMainIn(
                mainIn,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
            verify(result, s(398), 0);
        });
    });

    const params = {
        fee: s(0.01),
        rate: s(1),
        lowerTarget: s(100),
        upperTarget: s(200),
    };

    context('with main below lower', () => {
        const mainBalance = s(35);
        const wrappedBalance = s(15.15);
        const bptSupply = s(49.5);

        context('swap bpt & main', () => {
            context('main in', () => {
                it('given main in', async () => {
                    const mainIn = s(100);
                    const result = linear._calcBptOutPerMainIn(
                        mainIn,
                        mainBalance,
                        wrappedBalance,
                        bptSupply,
                        params
                    );
                    verify(result, s(100.65), 0);
                });

                it('given BPT out', async () => {
                    const bptOut = s(100.65);
                    const result = linear._calcMainInPerBptOut(
                        bptOut,
                        mainBalance,
                        wrappedBalance,
                        bptSupply,
                        params
                    );
                    verify(result, s(100), 0);
                });
            });

            context('main out', () => {
                it('given BPT in', async () => {
                    const bptIn = s(10.1);
                    const result = linear._calcMainOutPerBptIn(
                        bptIn,
                        mainBalance,
                        wrappedBalance,
                        bptSupply,
                        params
                    );
                    verify(result, s(10), 0);
                });

                it('given main out', async () => {
                    const mainOut = s(10);
                    const result = linear._calcBptInPerMainOut(
                        mainOut,
                        mainBalance,
                        wrappedBalance,
                        bptSupply,
                        params
                    );
                    verify(result, s(10.1), 0);
                });
            });
        });

        describe('swap main & wrapped', () => {
            context('main in', () => {
                it('given main in', async () => {
                    const mainIn = s(10);

                    const result = linear._calcWrappedOutPerMainIn(
                        mainIn,
                        mainBalance,
                        params
                    );
                    verify(result, s(10.1), 0);
                });

                it('given wrapped out', async () => {
                    const wrappedOut = s(10.1);
                    const result = linear._calcMainInPerWrappedOut(
                        wrappedOut,
                        mainBalance,
                        params
                    );
                    verify(result, s(10), 0);
                });
            });

            context('main out', () => {
                it('given main out', async () => {
                    const mainOut = s(10);
                    const result = linear._calcWrappedInPerMainOut(
                        mainOut,
                        mainBalance,
                        params
                    );
                    verify(result, s(10.1), 0);
                });

                it('given wrapped in', async () => {
                    const wrappedIn = s(10.1);
                    const result = linear._calcMainOutPerWrappedIn(
                        wrappedIn,
                        mainBalance,
                        params
                    );
                    verify(result, s(10), 0);
                });
            });
        });

        describe('swap bpt & wrapped', () => {
            it('given wrapped in', async () => {
                const wrappedIn = s(5);
                const result = linear._calcBptOutPerWrappedIn(
                    wrappedIn,
                    mainBalance,
                    wrappedBalance,
                    bptSupply,
                    params
                );
                verify(result, s(5), 0);
            });

            it('given BPT out', async () => {
                const bptOut = s(5);
                const result = linear._calcWrappedInPerBptOut(
                    bptOut,
                    mainBalance,
                    wrappedBalance,
                    bptSupply,
                    params
                );
                verify(result, s(5), 0);
            });

            it('given BPT in', async () => {
                const bptIn = s(5);
                const result = linear._calcWrappedOutPerBptIn(
                    bptIn,
                    mainBalance,
                    wrappedBalance,
                    bptSupply,
                    params
                );
                verify(result, s(5), 0);
            });

            it('given wrapped out', async () => {
                const wrappedOut = s(5);
                const result = linear._calcBptInPerWrappedOut(
                    wrappedOut,
                    mainBalance,
                    wrappedBalance,
                    bptSupply,
                    params
                );
                verify(result, s(5), 0);
            });
        });
    });

    context('with main within lower and upper', () => {
        const mainBalance = s(130);
        const wrappedBalance = s(20);
        const bptSupply = s(150);

        context('swap bpt & main', () => {
            context('main in', () => {
                it('given main in', async () => {
                    const mainIn = s(100);
                    const result = linear._calcBptOutPerMainIn(
                        mainIn,
                        mainBalance,
                        wrappedBalance,
                        bptSupply,
                        params
                    );
                    verify(result, s(99.7), 0);
                });

                it('given BPT out', async () => {
                    const bptOut = s(99.7);
                    const result = linear._calcMainInPerBptOut(
                        bptOut,
                        mainBalance,
                        wrappedBalance,
                        bptSupply,
                        params
                    );
                    verify(result, s(100), 0);
                });
            });

            context('main out', () => {
                it('given BPT in', async () => {
                    const bptIn = s(100.7);
                    const result = linear._calcMainOutPerBptIn(
                        bptIn,
                        mainBalance,
                        wrappedBalance,
                        bptSupply,
                        params
                    );
                    verify(result, s(100), 0);
                });

                it('given main out', async () => {
                    const mainOut = s(100);
                    const result = linear._calcBptInPerMainOut(
                        mainOut,
                        mainBalance,
                        wrappedBalance,
                        bptSupply,
                        params
                    );
                    verify(result, s(100.7), 0);
                });
            });
        });

        describe('swap main & wrapped', () => {
            context('main in', () => {
                it('given main in', async () => {
                    const mainIn = s(20);
                    const result = linear._calcWrappedOutPerMainIn(
                        mainIn,
                        mainBalance,
                        params
                    );
                    verify(result, s(20), 0);
                });

                it('given wrapped out', async () => {
                    const wrappedOut = s(20);
                    const result = linear._calcMainInPerWrappedOut(
                        wrappedOut,
                        mainBalance,
                        params
                    );
                    verify(result, s(20), 0);
                });
            });

            context('main out', () => {
                it('given main out', async () => {
                    const mainOut = s(20);
                    const result = linear._calcWrappedInPerMainOut(
                        mainOut,
                        mainBalance,
                        params
                    );
                    verify(result, s(20), 0);
                });

                it('given wrapped in', async () => {
                    const wrappedIn = s(20);
                    const result = linear._calcMainOutPerWrappedIn(
                        wrappedIn,
                        mainBalance,
                        params
                    );
                    verify(result, s(20), 0);
                });
            });
        });

        describe('swap bpt & wrapped', () => {
            it('given wrapped in', async () => {
                const wrappedIn = s(5);
                const result = linear._calcBptOutPerWrappedIn(
                    wrappedIn,
                    mainBalance,
                    wrappedBalance,
                    bptSupply,
                    params
                );
                verify(result, s(5), 0);
            });

            it('given BPT out', async () => {
                const bptOut = s(5);
                const result = linear._calcWrappedInPerBptOut(
                    bptOut,
                    mainBalance,
                    wrappedBalance,
                    bptSupply,
                    params
                );
                verify(result, s(5), 0);
            });

            it('given BPT in', async () => {
                const bptIn = s(5);
                const result = linear._calcWrappedOutPerBptIn(
                    bptIn,
                    mainBalance,
                    wrappedBalance,
                    bptSupply,
                    params
                );
                verify(result, s(5), 0);
            });

            it('given wrapped out', async () => {
                const wrappedOut = s(5);
                const result = linear._calcBptInPerWrappedOut(
                    wrappedOut,
                    mainBalance,
                    wrappedBalance,
                    bptSupply,
                    params
                );
                verify(result, s(5), 0);
            });
        });
    });

    context('with main above upper', () => {
        const mainBalance = s(240);
        const wrappedBalance = s(59.4);
        const bptSupply = s(299);

        context('swap bpt & main', () => {
            context('main in', () => {
                it('given main in', async () => {
                    const mainIn = s(100);
                    const result = linear._calcBptOutPerMainIn(
                        mainIn,
                        mainBalance,
                        wrappedBalance,
                        bptSupply,
                        params
                    );
                    verify(result, s(99), 0);
                });

                it('given BPT out', async () => {
                    const bptOut = s(99);
                    const result = linear._calcMainInPerBptOut(
                        bptOut,
                        mainBalance,
                        wrappedBalance,
                        bptSupply,
                        params
                    );
                    verify(result, s(100), 0);
                });
            });

            context('main out', () => {
                it('given BPT in', async () => {
                    const bptIn = s(99.6);
                    const result = linear._calcMainOutPerBptIn(
                        bptIn,
                        mainBalance,
                        wrappedBalance,
                        bptSupply,
                        params
                    );
                    verify(result, s(100), 0);
                });

                it('given main out', async () => {
                    const mainOut = s(100);
                    const result = linear._calcBptInPerMainOut(
                        mainOut,
                        mainBalance,
                        wrappedBalance,
                        bptSupply,
                        params
                    );
                    verify(result, s(99.6), 0);
                });
            });
        });

        describe('swap main & wrapped', () => {
            context('main in', () => {
                it('given main in', async () => {
                    const mainIn = s(50);
                    const result = linear._calcWrappedOutPerMainIn(
                        mainIn,
                        mainBalance,
                        params
                    );
                    verify(result, s(49.5), 0);
                });

                it('given wrapped out', async () => {
                    const wrappedOut = s(49.5);
                    const result = linear._calcMainInPerWrappedOut(
                        wrappedOut,
                        mainBalance,
                        params
                    );
                    verify(result, s(50), 0);
                });
            });

            context('main out', () => {
                it('given main out', async () => {
                    const mainOut = s(55);
                    const result = linear._calcWrappedInPerMainOut(
                        mainOut,
                        mainBalance,
                        params
                    );
                    verify(result, s(54.6), 0);
                });

                it('given wrapped in', async () => {
                    const wrappedIn = s(54.6);
                    const result = linear._calcMainOutPerWrappedIn(
                        wrappedIn,
                        mainBalance,
                        params
                    );
                    verify(result, s(55), 0);
                });
            });
        });

        describe('swap bpt & wrapped', () => {
            it('given wrapped in', async () => {
                const wrappedIn = s(5);
                const result = linear._calcBptOutPerWrappedIn(
                    wrappedIn,
                    mainBalance,
                    wrappedBalance,
                    bptSupply,
                    params
                );
                verify(result, s(5), 0);
            });

            it('given BPT out', async () => {
                const bptOut = s(5);
                const result = linear._calcWrappedInPerBptOut(
                    bptOut,
                    mainBalance,
                    wrappedBalance,
                    bptSupply,
                    params
                );
                verify(result, s(5), 0);
            });

            it('given BPT in', async () => {
                const bptIn = s(5);
                const result = linear._calcWrappedOutPerBptIn(
                    bptIn,
                    mainBalance,
                    wrappedBalance,
                    bptSupply,
                    params
                );
                verify(result, s(5), 0);
            });

            it('given wrapped out', async () => {
                const wrappedOut = s(5);
                const result = linear._calcBptInPerWrappedOut(
                    wrappedOut,
                    mainBalance,
                    wrappedBalance,
                    bptSupply,
                    params
                );
                verify(result, s(5), 0);
            });
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

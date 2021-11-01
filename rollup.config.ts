import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

import pkg from './package.json';

const external = [
    '@ethersproject/abi',
    '@ethersproject/address',
    '@ethersproject/bignumber',
    '@ethersproject/constants',
    '@ethersproject/contracts',
    '@ethersproject/providers',
    'isomorphic-fetch',
];

export default [
    {
        input: 'src/index.ts',
        output: [
            { file: pkg.main, format: 'cjs', sourcemap: true },
            { file: pkg.module, format: 'es', sourcemap: true },
        ],
        plugins: [nodeResolve(), json(), commonjs(), typescript()],
        external,
    },
    {
        input: 'src/index.ts',
        output: [{ file: 'dist/index.d.ts', format: 'es' }],
        plugins: [dts()],
    },
];

import { nodeResolve } from '@rollup/plugin-node-resolve';
import { readFileSync } from 'node:fs';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import analyze from 'rollup-plugin-analyzer';
import terser from '@rollup/plugin-terser';

const pkg = JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url)).toString()
);

const external = [
    ...Object.keys(pkg.dependencies),
    ...Object.keys(pkg.peerDependencies),
];
export default [
    {
        treeshake: { moduleSideEffects: false },
        input: 'src/index.ts',
        output: [
            {
                format: 'cjs',
                sourcemap: true,
                file: 'dist/cjs/index.js',
            },
            {
                format: 'es',
                sourcemap: true,
                dir: 'dist/esm',
                preserveModules: true,
                // preserveModulesRoot is needed to be compatible with nodeResolve plugin:
                // https://github.com/rollup/rollup/issues/3684
                preserveModulesRoot: 'src',
            },
        ],
        plugins: [
            json(),
            nodeResolve(),
            commonjs(),
            typescript(),
            terser({
                compress: true,
            }),
            analyze({
                hideDeps: true,
                limit: 5,
                summaryOnly: true,
                onAnalysis,
            }),
        ],
        external,
    },
    {
        treeshake: { moduleSideEffects: false },
        input: 'src/index.ts',
        output: [{ file: 'dist/esm/index.d.ts', format: 'es' }],
        plugins: [dts()],
    },
];

const limitKB = 750;

function onAnalysis({ bundleSize }) {
    if (bundleSize / 1000 < limitKB) return;
    console.warn(`Bundle size exceeds ${limitKB} KB: ${bundleSize / 1000} KB`);
    return process.exit(1);
}

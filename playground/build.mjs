/**
 * build.mjs — Bundle the HXML parser for browser use.
 * 
 * Run: node playground/build.mjs
 * Output: playground/hxml-browser.js
 */

import * as esbuild from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

await esbuild.build({
    entryPoints: [join(__dirname, '..', 'src', 'index.ts')],
    bundle: true,
    format: 'esm',
    outfile: join(__dirname, 'hxml-browser.js'),
    target: 'es2022',
    platform: 'browser',
    // Exclude Node.js builtins — the library API doesn't use them
    external: ['fs', 'path'],
    minify: false, // Keep readable for debugging
    sourcemap: true,
});

console.log('Built playground/hxml-browser.js');

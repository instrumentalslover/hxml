import { defineConfig, type Plugin } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest plugin that resolves `.js` imports to their `.ts` source counterparts.
 * This is needed because TypeScript's NodeNext module resolution requires `.js`
 * extensions in import specifiers, but the actual source files are `.ts`.
 */
function resolveJsToTs(): Plugin {
    return {
        name: 'resolve-js-to-ts',
        enforce: 'pre',
        resolveId(id, importer) {
            if (!importer) return null;
            if (!id.endsWith('.js')) return null;
            // Only rewrite relative imports
            if (!id.startsWith('.')) return null;
            // Only rewrite for TS/JS module importers; skip HTML/virtual importers.
            if (!/\.(?:[cm]?ts|[cm]?js|tsx|jsx)(?:\?|$)/.test(importer)) return null;
            const tsPath = resolve(importer, '..', id.replace(/\.js$/, '.ts'));
            return tsPath;
        },
    };
}

export default defineConfig({
    plugins: [resolveJsToTs()],
    test: {
        include: ['test/**/*.test.ts'],
        environment: 'node',
        // vmThreads is required for ESM + NodeNext TypeScript imports to resolve
        // correctly in vitest 4.x on Windows.  The default 'forks' pool does not
        // apply Vite's module transform to the worker subprocess.
        pool: 'vmThreads',
    },
});

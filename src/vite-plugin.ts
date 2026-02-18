/**
 * vite-plugin.ts — Vite plugin for HXML.
 *
 * Transforms `.hxml` files to HTML5 during Vite builds and dev-server runs.
 *
 * Usage (vite.config.ts):
 *   import hxmlPlugin from 'hxml/vite';
 *   export default { plugins: [hxmlPlugin()] };
 *
 * Each `.hxml` file is compiled to HTML5 and exported as a default string:
 *   import html from './component.hxml';
 *   document.body.innerHTML = html;
 *
 * Diagnostics (errors/warnings) are forwarded to Vite's logger.
 */

import type { Plugin } from 'vite';
import { compile } from './index.js';
import type { EmitMode } from './emitter.js';

// ── Public API ────────────────────────────────────────────────────────────────

export interface HxmlPluginOptions {
    /**
     * Emit mode for XML-mode elements.
     * @default 'custom-elements'
     */
    mode?: EmitMode;
    /**
     * When true, warnings are treated as errors and cause the build to fail.
     * @default false
     */
    strict?: boolean;
    /**
     * File extensions to transform.
     * @default ['.hxml']
     */
    extensions?: string[];
}

export default function hxmlPlugin(options: HxmlPluginOptions = {}): Plugin {
    const mode = options.mode ?? 'custom-elements';
    const strict = options.strict ?? false;
    const extensions = options.extensions ?? ['.hxml'];

    return {
        name: 'hxml',

        transform(source, id) {
            if (!extensions.some(ext => id.endsWith(ext))) return null;

            const { html, diagnostics } = compile(source, {
                emit: { mode },
            });

            // Forward diagnostics to Vite via this.warn / this.error
            for (const diag of diagnostics) {
                const isError = diag.severity === 'error' || (strict && diag.severity === 'warning');
                const loc = diag.loc
                    ? { line: diag.loc.start.line, column: diag.loc.start.col }
                    : undefined;
                const msg = `[hxml] ${diag.code}: ${diag.message}${diag.hint ? ` (${diag.hint})` : ''}`;

                if (isError) {
                    this.error(msg, loc);
                } else {
                    this.warn(msg, loc);
                }
            }

            // Export the compiled HTML as a default string
            const escaped = JSON.stringify(html);
            return {
                code: `export default ${escaped};`,
                map: null,
            };
        },
    };
}

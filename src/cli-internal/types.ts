import type { EmitMode } from '../emitter.js';

export interface CliArgs {
    command: string;
    input: string | null;
    stdin: boolean;
    output: string | null;
    mode: EmitMode;
    sourcemap: 'none' | 'external' | 'inline';
    format: 'text' | 'json';
    indent: string;
    sortAttrs: boolean;
    preserveQuotes: boolean;
    strict: boolean;
    noValidate: boolean;
    quiet: boolean;
    watch: boolean;
}

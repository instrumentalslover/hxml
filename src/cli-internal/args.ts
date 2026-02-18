import * as fs from 'fs';
import type { EmitMode } from '../emitter.js';
import type { CliArgs } from './types.js';

const VALID_EMIT_MODES: ReadonlySet<string> = new Set([
    'custom-elements', 'data-attributes', 'passthrough', 'strip',
]);

export function printUsage(version: string): void {
    console.log(`
HXML — HTML+XML Superset Compiler  v${version}

Usage:
    hxml build <input> [options]    Compile HXML to HTML5
    hxml build "src/**/*.hxml" -o dist  Compile multiple files via glob
    hxml check <input> [options]    Parse and validate without emitting
    hxml ast <input> [options]      Print the AST as JSON
    hxml fmt <input> [options]      Format HXML source
    hxml <command> --stdin [options]  Read source from stdin instead of a file

Options:
  -o, --output <file>       Output file (default: stdout)
  -m, --mode <mode>         Emit mode: custom-elements|data-attributes|passthrough|strip
            --sourcemap [inline]  Generate source map (external .map by default; inline data URL with 'inline')
            --stdin               Read input from stdin instead of a file path
            --format <format>     Output format for 'check': text|json (default: text)
            --indent <n|tab>      Formatter indent for 'fmt' (spaces count or 'tab')
            --sort-attrs          Sort attributes alphabetically in 'fmt' output
            --preserve-quotes     Preserve original attribute quotes in 'fmt' output
      --strict              Treat warnings as errors
      --no-validate         Skip validation pass
  -q, --quiet               Suppress non-error output
  -w, --watch               Watch input file and rebuild on changes (build only)
  -h, --help                Show this help message
  -v, --version             Show version number

Exit codes:
  0  Success, no errors
  1  Completed with errors
  2  Fatal error (file not found, invalid options)
`);
}

export function parseArgs(argv: string[]): CliArgs | null {
    if (argv.length < 1) return null;

    const command = argv[0];

    if (!['build', 'check', 'ast', 'fmt'].includes(command)) return null;

    let input: string | null = null;
    let stdin = false;
    let output: string | null = null;
    let mode: EmitMode = 'custom-elements';
    let sourcemap: 'none' | 'external' | 'inline' = 'none';
    let format: 'text' | 'json' = 'text';
    let indent = '  ';
    let sortAttrs = false;
    let preserveQuotes = false;
    let strict = false;
    let noValidate = false;
    let quiet = false;
    let watch = false;

    let i = 1;
    while (i < argv.length) {
        const arg = argv[i];

        if (!arg.startsWith('-')) {
            if (!input) {
                input = arg;
                i++;
                continue;
            }
            console.error(`Unexpected extra argument: ${arg}`);
            return null;
        }

        switch (arg) {
            case '-o':
            case '--output':
                if (i + 1 >= argv.length) {
                    console.error(`Missing value for ${arg}`);
                    return null;
                }
                output = argv[++i];
                break;
            case '--stdin':
                stdin = true;
                break;
            case '-m':
            case '--mode': {
                if (i + 1 >= argv.length) {
                    console.error(`Missing value for ${arg}`);
                    return null;
                }
                const modeValue = argv[++i];
                if (!VALID_EMIT_MODES.has(modeValue)) {
                    console.error(`Invalid emit mode: "${modeValue}". Must be one of: ${[...VALID_EMIT_MODES].join(', ')}`);
                    return null;
                }
                mode = modeValue as EmitMode;
                break;
            }
            case '--sourcemap': {
                sourcemap = 'external';
                const next = argv[i + 1];
                if (next && !next.startsWith('-')) {
                    if (next === 'inline') {
                        sourcemap = 'inline';
                        i++;
                    } else {
                        console.error(`Invalid value for --sourcemap: "${next}". Use "inline" or omit the value.`);
                        return null;
                    }
                }
                break;
            }
            case '--format': {
                if (i + 1 >= argv.length) {
                    console.error(`Missing value for ${arg}`);
                    return null;
                }
                const formatValue = argv[++i];
                if (formatValue !== 'text' && formatValue !== 'json') {
                    console.error(`Invalid format: "${formatValue}". Must be one of: text, json`);
                    return null;
                }
                format = formatValue;
                break;
            }
            case '--indent': {
                if (i + 1 >= argv.length) {
                    console.error(`Missing value for ${arg}`);
                    return null;
                }
                const indentValue = argv[++i];
                if (indentValue === 'tab') {
                    indent = '\t';
                    break;
                }
                if (!/^\d+$/.test(indentValue)) {
                    console.error(`Invalid indent: "${indentValue}". Use a non-negative integer or "tab".`);
                    return null;
                }
                indent = ' '.repeat(Number(indentValue));
                break;
            }
            case '--sort-attrs':
                sortAttrs = true;
                break;
            case '--preserve-quotes':
                preserveQuotes = true;
                break;
            case '--strict':
                strict = true;
                break;
            case '--no-validate':
                noValidate = true;
                break;
            case '-q':
            case '--quiet':
                quiet = true;
                break;
            case '-w':
            case '--watch':
                watch = true;
                break;
            default:
                console.error(`Unknown option: ${arg}`);
                return null;
        }
        i++;
    }

    if (!stdin && !input) {
        console.error('Missing input file path (or use --stdin)');
        return null;
    }

    if (stdin && watch) {
        console.error('--watch cannot be used with --stdin');
        return null;
    }

    if (format !== 'text' && command !== 'check') {
        console.error('--format is only supported for the check command');
        return null;
    }

    if (sortAttrs && command !== 'fmt') {
        console.error('--sort-attrs is only supported for the fmt command');
        return null;
    }

    if (preserveQuotes && command !== 'fmt') {
        console.error('--preserve-quotes is only supported for the fmt command');
        return null;
    }

    return { command, input, stdin, output, mode, sourcemap, format, indent, sortAttrs, preserveQuotes, strict, noValidate, quiet, watch };
}

export function readVersion(): string {
    try {
        const packageJsonPath = new URL('../../package.json', import.meta.url);
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as { version?: string };
        return packageJson.version ?? '0.0.0';
    } catch {
        return '0.0.0';
    }
}

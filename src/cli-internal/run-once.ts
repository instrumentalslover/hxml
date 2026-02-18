import * as fs from 'fs';
import * as path from 'path';
import { parse } from '../parser.js';
import { validate } from '../validator.js';
import { emit } from '../emitter.js';
import { htmlToHxml } from '../converter.js';
import { formatDiagnostic, type Diagnostic } from '../utils/errors.js';
import type { CliArgs } from './types.js';

export function runOnce(args: CliArgs): number {
    let source: string;
    let sourceLabel = args.input ?? '<stdin>';
    if (args.stdin) {
        try {
            source = fs.readFileSync(0, 'utf-8');
            sourceLabel = '<stdin>';
        } catch {
            console.error('Fatal: cannot read from stdin');
            return 2;
        }
    } else {
        try {
            source = fs.readFileSync(args.input!, 'utf-8');
            sourceLabel = args.input!;
        } catch {
            console.error(`Fatal: cannot read file "${args.input}"`);
            return 2;
        }
    }

    const sourceLines = source.split('\n');

    const parseResult = parse(source);
    let diagnostics: Diagnostic[] = [...parseResult.diagnostics];

    if (!args.noValidate) {
        const validationDiags = validate(parseResult.ast);
        diagnostics.push(...validationDiags);
    }

    if (args.strict) {
        diagnostics = diagnostics.map(d =>
            d.severity === 'warning' ? { ...d, severity: 'error' as const } : d,
        );
    }

    const errors = diagnostics.filter(d => d.severity === 'error');
    const warnings = diagnostics.filter(d => d.severity === 'warning');

    const emitTextDiagnostics = !(args.command === 'check' && args.format === 'json');
    if (!args.quiet && emitTextDiagnostics) {
        for (const d of diagnostics) {
            process.stderr.write(formatDiagnostic(d, sourceLabel, sourceLines));
            process.stderr.write('\n');
        }

        if (diagnostics.length > 0) {
            const parts: string[] = [];
            if (errors.length > 0) parts.push(`${errors.length} error${errors.length === 1 ? '' : 's'}`);
            if (warnings.length > 0) parts.push(`${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
            process.stderr.write(`Found ${parts.join(' and ')}.\n`);
        }
    }

    switch (args.command) {
        case 'build': {
            if (args.sourcemap === 'external' && !args.output) {
                console.error('Fatal: --sourcemap requires --output unless using "--sourcemap inline"');
                return 2;
            }

            const result = emit(parseResult.ast, {
                mode: args.mode,
                sourceMap: args.sourcemap !== 'none',
                sourceFile: args.stdin ? 'stdin.hxml' : (args.input ?? 'input.hxml'),
            });

            let htmlOut = result.html;

            if (args.sourcemap === 'inline' && result.sourceMap) {
                const dataUrl = Buffer.from(result.sourceMap, 'utf-8').toString('base64');
                htmlOut += `\n<!--# sourceMappingURL=data:application/json;base64,${dataUrl} -->\n`;
            }

            if (args.output) {
                if (args.sourcemap === 'external' && result.sourceMap) {
                    const mapFile = `${args.output}.map`;
                    const mapRef = path.basename(mapFile);
                    htmlOut += `\n<!--# sourceMappingURL=${mapRef} -->\n`;
                    fs.writeFileSync(mapFile, result.sourceMap, 'utf-8');
                }

                fs.writeFileSync(args.output, htmlOut, 'utf-8');
                if (!args.quiet) {
                    console.log(`Wrote ${args.output}`);
                    if (args.sourcemap === 'external') {
                        console.log(`Wrote ${args.output}.map`);
                    }
                }
            } else {
                process.stdout.write(htmlOut);
            }
            break;
        }

        case 'check': {
            if (args.format === 'json') {
                const payload = {
                    file: sourceLabel,
                    diagnostics,
                    summary: {
                        errors: errors.length,
                        warnings: warnings.length,
                    },
                };
                const json = JSON.stringify(payload, null, 2);
                if (args.output) {
                    fs.writeFileSync(args.output, json + '\n', 'utf-8');
                } else {
                    process.stdout.write(json + '\n');
                }
                break;
            }
            if (!args.quiet && diagnostics.length === 0) {
                console.log('No issues found.');
            }
            break;
        }

        case 'ast': {
            const json = JSON.stringify(parseResult.ast, replacer, 2);
            if (args.output) {
                fs.writeFileSync(args.output, json, 'utf-8');
            } else {
                process.stdout.write(json + '\n');
            }
            break;
        }

        case 'fmt': {
            const { hxml: formatted } = htmlToHxml(source, {
                indent: args.indent,
                sortAttributes: args.sortAttrs,
                preserveAttributeQuotes: args.preserveQuotes,
            });
            if (args.output) {
                fs.writeFileSync(args.output, formatted, 'utf-8');
                if (!args.quiet) {
                    console.log(`Formatted ${args.output}`);
                }
            } else {
                process.stdout.write(formatted);
            }
            break;
        }
    }

    return errors.length > 0 ? 1 : 0;
}

function replacer(_key: string, value: unknown): unknown {
    if (value instanceof Map) {
        const obj: Record<string, unknown> = {};
        for (const [k, v] of value) obj[k] = v;
        return obj;
    }
    return value;
}

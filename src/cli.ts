/**
 * cli.ts — HXML command-line interface.
 *
 * Commands:
 *   hxml build <input> [options]   Compile HXML to HTML5
 *   hxml check <input> [options]   Parse and validate without emitting
 *   hxml ast <input> [options]     Print the AST as JSON
 *   hxml fmt <input> [options]     Format HXML source
 */

import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { printUsage, parseArgs, readVersion } from './cli-internal/args.js';
import { runOnce } from './cli-internal/run-once.js';
import { hasGlobPattern, normalizeGlobPattern, multiBuildOutputPath } from './cli-internal/glob.js';
import type { CliArgs } from './cli-internal/types.js';

const VERSION = readVersion();

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
    const argv = process.argv.slice(2);

    // Handle --version and --help before command parsing
    if (argv.includes('--version') || argv.includes('-v')) {
        console.log(VERSION);
        process.exit(0);
        return;
    }
    if (argv.includes('--help') || argv.includes('-h')) {
        printUsage(VERSION);
        process.exit(0);
        return;
    }

    const args = parseArgs(argv);

    if (!args) {
        printUsage(VERSION);
        process.exit(2);
        return;
    }

    if (args.command === 'build' && !args.stdin && args.input) {
        const isGlob = hasGlobPattern(args.input);
        if (isGlob && args.watch) {
            console.error('--watch is not supported with glob inputs');
            process.exit(2);
            return;
        }

        if (isGlob) {
            const pattern = normalizeGlobPattern(args.input);
            const matches = fg.sync(pattern, { onlyFiles: true, absolute: true, unique: true }).sort();
            const tasks = fg.generateTasks(pattern, { onlyFiles: true });
            const globBaseDir = tasks.length > 0 ? path.resolve(tasks[0].base) : process.cwd();
            if (matches.length === 0) {
                console.error(`Fatal: no files matched glob "${args.input}"`);
                process.exit(2);
                return;
            }

            if (matches.length > 1) {
                if (!args.output) {
                    console.error('Fatal: glob builds that match multiple files require --output <directory>');
                    process.exit(2);
                    return;
                }
                if (path.extname(args.output)) {
                    console.error('Fatal: --output must be a directory when building multiple files');
                    process.exit(2);
                    return;
                }

                fs.mkdirSync(args.output, { recursive: true });
                let overallCode = 0;

                for (const file of matches) {
                    const outFile = multiBuildOutputPath(args.output, file, globBaseDir);
                    fs.mkdirSync(path.dirname(outFile), { recursive: true });

                    const code = runOnce({
                        ...args,
                        input: file,
                        output: outFile,
                        watch: false,
                    });
                    overallCode = Math.max(overallCode, code);
                }

                process.exit(overallCode);
                return;
            }

            // Single match: continue as a normal build using the concrete file path.
            args.input = matches[0];
        }
    }

    // Run once immediately
    const exitCode = runOnce(args);

    // --watch mode: rebuild on file changes (build command only)
    if (args.watch && args.command === 'build') {
        if (!args.quiet) {
            console.log(`\nWatching ${args.input ?? '<stdin>'} for changes...`);
        }
        let debounce: ReturnType<typeof setTimeout> | null = null;
        const watcher = fs.watch(args.input!, () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => {
                const start = performance.now();
                const code = runOnce(args);
                const elapsed = (performance.now() - start).toFixed(1);
                if (!args.quiet) {
                    console.log(`\nRebuilt in ${elapsed}ms (exit code: ${code})`);
                    console.log(`Watching ${args.input ?? '<stdin>'} for changes...`);
                }
            }, 100);
        });

        const cleanup = () => {
            watcher.close();
            process.exit(0);
        };
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        return; // keep the process alive — don't call process.exit
    }

    process.exit(exitCode);
}

// Entry point
main();

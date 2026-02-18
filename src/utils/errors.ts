/**
 * errors.ts — Diagnostic types and factory helpers for HXML.
 *
 * Error code ranges:
 *   HXML001–099  Tokenizer errors
 *   HXML100–199  Parser errors
 *     HXML101  Unmatched closing tag
 *     HXML102  Unclosed XML element inside a closing tag
 *     HXML103  XML element never closed at EOF
 *     HXML104  Tag name contains more than one colon
 *     HXML105  Invalid numeric character reference
 *   HXML200–299  Validation errors
 *     HXML205  Duplicate namespace declaration on an element
 *     HXML206  Duplicate xml:id value in XML regions
 *     HXML207  XML region schema validation violation
 *   HXML300–399  Warnings
 */

import type { SourceRange } from './source-map.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type DiagnosticSeverity = 'error' | 'warning';

export interface Diagnostic {
    severity: DiagnosticSeverity;
    /** e.g. "HXML001", "HXML201" */
    code: string;
    /** Human-readable description. */
    message: string;
    /** Source location of the problem. */
    loc: SourceRange;
    /** Optional suggestion for fixing the issue. */
    hint?: string;
}

// ── Factories ────────────────────────────────────────────────────────────────

export function makeError(
    code: string,
    message: string,
    loc: SourceRange,
    hint?: string,
): Diagnostic {
    return { severity: 'error', code, message, loc, hint };
}

export function makeWarning(
    code: string,
    message: string,
    loc: SourceRange,
    hint?: string,
): Diagnostic {
    return { severity: 'warning', code, message, loc, hint };
}

// ── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format a diagnostic for terminal output, matching the format in §7.4:
 *
 *   file:14:5 error HXML201: message
 *     |
 *     | 14 |     <offending line>
 *     |
 *     hint: ...
 */
export function formatDiagnostic(
    diag: Diagnostic,
    filePath: string,
    sourceLines: string[],
): string {
    const { severity, code, message, loc, hint } = diag;
    const line = loc.start.line;
    const col = loc.start.col;

    let out = `${filePath}:${line}:${col} ${severity} ${code}: ${message}\n`;
    out += '  |\n';

    if (line >= 1 && line <= sourceLines.length) {
        const sourceLine = sourceLines[line - 1];
        out += `  | ${line} | ${sourceLine}\n`;

        // Underline the range on this line
        const startCol = loc.start.col;
        const endCol =
            loc.end.line === loc.start.line
                ? loc.end.col
                : sourceLine.length;
        const pad = ' '.repeat(String(line).length + 3 + startCol);
        const underline = '^'.repeat(Math.max(1, endCol - startCol));
        out += `  | ${pad}${underline}\n`;
    }

    out += '  |\n';
    if (hint) {
        out += `  hint: ${hint}\n`;
    }

    return out;
}

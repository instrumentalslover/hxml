import type { SourceRange } from '../utils/source-map.js';

export interface OpenTagCandidate {
    node: {
        type: string;
        name?: string;
    };
}

export function isXmlName(name: string): boolean {
    return name.includes(':');
}

export function splitName(name: string): { prefix: string | null; localName: string } {
    const idx = name.indexOf(':');
    if (idx < 0) return { prefix: null, localName: name };
    return { prefix: name.slice(0, idx), localName: name.slice(idx + 1) };
}

export function emptyRange(): SourceRange {
    const pos = { line: 1, col: 0, offset: 0 };
    return { start: pos, end: pos };
}

function levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            );
        }
    }

    return dp[m][n];
}

export function closestOpenTag(stack: OpenTagCandidate[], closeName: string, xmlExpected: boolean): string | null {
    let best: { name: string; dist: number } | null = null;
    const target = xmlExpected ? closeName : closeName.toLowerCase();

    for (let i = stack.length - 1; i > 0; i--) {
        const entry = stack[i];
        if (entry.node.type !== 'element' || !entry.node.name) continue;
        const candidate = xmlExpected ? entry.node.name : entry.node.name.toLowerCase();
        const dist = levenshtein(target, candidate);
        if (!best || dist < best.dist) {
            best = { name: entry.node.name, dist };
        }
    }

    if (best && best.dist <= 2) return best.name;
    return null;
}

import * as path from 'path';

export function hasGlobPattern(input: string): boolean {
    return /[*?{}\[\]]/.test(input);
}

export function normalizeGlobPattern(pattern: string): string {
    return pattern.replace(/\\/g, '/');
}

export function multiBuildOutputPath(outputDir: string, inputFile: string, baseDir: string): string {
    const rel = path.relative(baseDir, inputFile);
    const safeRel = rel.startsWith('..') || path.isAbsolute(rel)
        ? path.basename(inputFile)
        : rel;

    const ext = path.extname(safeRel);
    const withoutExt = ext ? safeRel.slice(0, -ext.length) : safeRel;
    return path.join(outputDir, `${withoutExt}.html`);
}

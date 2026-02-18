import type { ElementNode } from '../ast.js';
import type { SourceRange } from '../utils/source-map.js';
import { encodeVlqSegment } from '../utils/vlq.js';

export type NsContext = Map<string, string>;

export interface EmitRuntimeOptions {
    customElementPrefix: string;
    processingInstructionMode: 'comment' | 'custom-elements';
    preserveCdataAsComment: boolean;
}

export interface EmitSink {
    write(text: string, loc?: SourceRange): void;
}

/**
 * Collects {text, sourceLoc?} segments as the emitter runs, then assembles
 * both the final HTML string and a V3 source map.
 */
export class SourceMapBuilder {
    private readonly segments: Array<{ text: string; loc?: SourceRange }> = [];

    write(text: string, loc?: SourceRange): void {
        if (text) this.segments.push({ text, loc });
    }

    buildSourceMap(sourceFile: string, sourceContent?: string): string {
        let genLine = 0;
        let genCol = 0;
        let prevGenCol = 0;
        let prevSrcLine = 0;
        let prevSrcCol = 0;

        const lineGroups: string[][] = [[]];

        for (const seg of this.segments) {
            if (seg.loc) {
                const srcLine = seg.loc.start.line - 1;
                const srcCol = seg.loc.start.col;

                const encoded = encodeVlqSegment([
                    genCol - prevGenCol,
                    0,
                    srcLine - prevSrcLine,
                    srcCol - prevSrcCol,
                ]);
                lineGroups[genLine].push(encoded);

                prevGenCol = genCol;
                prevSrcLine = srcLine;
                prevSrcCol = srcCol;
            }

            for (let i = 0; i < seg.text.length; i++) {
                if (seg.text[i] === '\n') {
                    genLine++;
                    genCol = 0;
                    prevGenCol = 0;
                    if (genLine >= lineGroups.length) lineGroups.push([]);
                } else {
                    genCol++;
                }
            }
        }

        const mappings = lineGroups.map(g => g.join(',')).join(';');
        const map: Record<string, unknown> = {
            version: 3,
            sources: [sourceFile],
            names: [],
            mappings,
        };
        if (sourceContent !== undefined) {
            map['sourcesContent'] = [sourceContent];
        }
        return JSON.stringify(map);
    }
}

export function createEmitSink(writeChunk: (chunk: string) => void, smb: SourceMapBuilder | null): EmitSink {
    return {
        write(text: string, loc?: SourceRange) {
            if (!text) return;
            writeChunk(text);
            if (smb) smb.write(text, loc);
        },
    };
}

export function mergeNs(parent: NsContext, element: ElementNode): NsContext {
    if (element.namespaces.size === 0) return parent;
    const merged = new Map(parent);
    for (const [k, v] of element.namespaces) merged.set(k, v);
    return merged;
}

export function normalizeCustomElementPrefix(prefix?: string): string {
    if (!prefix) return '';
    return prefix.endsWith('-') ? prefix : `${prefix}-`;
}

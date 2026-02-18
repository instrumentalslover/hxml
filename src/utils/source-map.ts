/**
 * source-map.ts — Position tracking for the HXML tokenizer.
 *
 * Provides types for source positions / ranges and a SourceTracker utility
 * that maps byte offsets to line/column numbers via a pre-computed
 * line-start-offset table with O(log n) binary-search lookup.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** A single position in a source document. */
export interface SourcePosition {
    /** 1-indexed line number. */
    line: number;
    /** 0-indexed column number. */
    col: number;
    /** 0-indexed byte offset from start of source. */
    offset: number;
}

/** A range between two positions (inclusive start, exclusive end). */
export interface SourceRange {
    start: SourcePosition;
    end: SourcePosition;
}

// ── SourceTracker ────────────────────────────────────────────────────────────

/**
 * Pre-computes an array of line-start offsets for a given source string
 * so that any byte offset can be resolved to { line, col, offset } in
 * O(log n) time via binary search.
 */
export class SourceTracker {
    /** Byte offsets where each line begins (index 0 = line 1). */
    private readonly lineStarts: number[];

    constructor(private readonly source: string) {
        this.lineStarts = [0]; // line 1 always starts at offset 0
        for (let i = 0; i < source.length; i++) {
            if (source[i] === '\n') {
                this.lineStarts.push(i + 1);
            }
        }
    }

    /** Resolve an absolute byte offset to a SourcePosition. */
    positionAt(offset: number): SourcePosition {
        // Clamp to valid range
        if (offset <= 0) return { line: 1, col: 0, offset: 0 };
        if (offset >= this.source.length) {
            offset = this.source.length;
        }

        // Binary search for the line containing this offset
        let lo = 0;
        let hi = this.lineStarts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >>> 1;
            if (this.lineStarts[mid] <= offset) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }

        return {
            line: lo + 1, // 1-indexed
            col: offset - this.lineStarts[lo], // 0-indexed
            offset,
        };
    }

    /** Convenience: build a SourceRange from two offsets. */
    range(startOffset: number, endOffset: number): SourceRange {
        return {
            start: this.positionAt(startOffset),
            end: this.positionAt(endOffset),
        };
    }
}

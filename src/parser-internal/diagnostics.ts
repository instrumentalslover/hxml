import type { Diagnostic } from '../utils/errors.js';
import { makeError } from '../utils/errors.js';
import { decodeCharacterReferencesDetailed } from '../utils/entities.js';
import { SourceTracker, type SourceRange } from '../utils/source-map.js';

export function reportInvalidReferences(
    rawValue: string,
    tokenLoc: SourceRange,
    tracker: SourceTracker,
    diagnostics: Diagnostic[],
): string {
    const decoded = decodeCharacterReferencesDetailed(rawValue);
    for (const invalidRef of decoded.invalidNumericReferences) {
        const startOffset = tokenLoc.start.offset + invalidRef.index;
        const endOffset = startOffset + invalidRef.length;
        diagnostics.push(makeError(
            'HXML105',
            `Invalid numeric character reference ${invalidRef.raw}`,
            tracker.range(startOffset, endOffset),
            'Use a valid Unicode scalar value between U+0000 and U+10FFFF (excluding surrogates)',
        ));
    }
    return decoded.value;
}

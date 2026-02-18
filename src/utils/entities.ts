/**
 * entities.ts — Character reference decoding helpers.
 */
import { decodeHTMLStrict } from 'entities';

export interface InvalidCharacterReference {
  raw: string;
  index: number;
  length: number;
}

export interface DecodeCharacterReferencesResult {
  value: string;
  invalidNumericReferences: InvalidCharacterReference[];
}

function isValidCodePoint(codePoint: number): boolean {
  if (codePoint < 0 || codePoint > 0x10ffff) return false;
  // Surrogate range is not a valid Unicode scalar value.
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return false;
  return true;
}

/**
 * Decode numeric/XML named character references.
 * Unknown named references are left as-is.
 */
export function decodeCharacterReferencesDetailed(input: string): DecodeCharacterReferencesResult {
  const invalidNumericReferences: InvalidCharacterReference[] = [];
  const value = input.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]+);/g, (full, body: string, index: number) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const raw = isHex ? body.slice(2) : body.slice(1);
      const codePoint = Number.parseInt(raw, isHex ? 16 : 10);
      if (!Number.isFinite(codePoint) || !isValidCodePoint(codePoint)) {
        invalidNumericReferences.push({ raw: full, index, length: full.length });
        return full;
      }
      return String.fromCodePoint(codePoint);
    }

    // HTML5 named character reference support.
    return decodeHTMLStrict(full);
  });

  return { value, invalidNumericReferences };
}

export function decodeCharacterReferences(input: string): string {
  return decodeCharacterReferencesDetailed(input).value;
}

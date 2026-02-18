/**
 * vlq.ts — Base64 VLQ encoding for V3 source maps.
 *
 * A V3 source map `mappings` field encodes groups of signed integers
 * as Base64 VLQ.  Each integer is split into 5-bit groups; the low bit
 * of the last group is the sign and each non-final group has a
 * continuation bit set (bit 5).
 *
 * Reference: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k
 */

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Encode a single signed integer as Base64 VLQ. */
export function encodeVlqInt(value: number): string {
    // Convert to unsigned: the sign bit is the LSB.
    let vlq = value < 0 ? ((-value) << 1) | 1 : value << 1;
    let result = '';
    do {
        let digit = vlq & 0x1F; // take 5 bits
        vlq >>>= 5;
        if (vlq > 0) digit |= 0x20; // set continuation bit
        result += BASE64[digit];
    } while (vlq > 0);
    return result;
}

/** Encode an array of signed integers as a single Base64 VLQ segment. */
export function encodeVlqSegment(values: number[]): string {
    return values.map(encodeVlqInt).join('');
}

/**
 * escape.ts — HTML escaping and sanitization helpers for HXML output.
 */

/** Escape text content for safe inclusion in HTML. */
export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** Escape a string for safe inclusion in an HTML attribute value. */
export function escapeAttr(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Sanitize comment text so it cannot break out of an HTML comment.
 * HTML comments must not contain `--`, so we insert a space: `--` → `- -`.
 */
export function sanitizeComment(s: string): string {
    return s.replace(/--/g, '- -');
}

/**
 * Sanitize processing instruction data so it cannot break out of a PI.
 * PIs are terminated by `?>`, so we insert a space: `?>` → `? >`.
 */
export function sanitizePI(s: string): string {
    return s.replace(/\?>/g, '? >');
}

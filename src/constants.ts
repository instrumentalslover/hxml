/**
 * constants.ts — HTML5 rule tables that drive HXML parsing.
 *
 * Derived from the HTML5 specification's "optional tags" section.
 */

// ── Void elements (never have children or closing tags) ──────────────────────

export const HTML_VOID_ELEMENTS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// ── Raw text elements (contents parsed as literal text) ──────────────────────

export const HTML_RAW_TEXT_ELEMENTS = new Set([
    'script', 'style', 'textarea', 'title',
]);

// ── Elements whose closing tag is optional ───────────────────────────────────

export const HTML_OMIT_CLOSE = new Set([
    'p', 'li', 'dt', 'dd', 'option', 'optgroup',
    'rb', 'rt', 'rtc', 'rp',
    'td', 'th', 'tr', 'thead', 'tbody', 'tfoot',
    'colgroup', 'caption',
]);

// ── Auto-close-before rules ──────────────────────────────────────────────────
// Maps an element name to the set of element names whose opening tag causes
// the first element to be implicitly closed.  E.g. opening a <p> while another
// <p> is open → auto-close the first <p>.

export const HTML_AUTO_CLOSE_BEFORE: Record<string, Set<string>> = {
    p: new Set([
        'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl',
        'fieldset', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4',
        'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'nav', 'ol', 'p', 'pre',
        'section', 'summary', 'table', 'ul',
    ]),
    li: new Set(['li']),
    dt: new Set(['dt', 'dd']),
    dd: new Set(['dt', 'dd']),
    td: new Set(['td', 'th']),
    th: new Set(['td', 'th']),
    tr: new Set(['tr']),
    option: new Set(['option', 'optgroup']),
    optgroup: new Set(['optgroup']),
    rb: new Set(['rb', 'rt', 'rtc', 'rp']),
    rt: new Set(['rb', 'rt', 'rtc', 'rp']),
    rtc: new Set(['rb', 'rtc', 'rp']),
    rp: new Set(['rb', 'rt', 'rtc', 'rp']),
    thead: new Set(['tbody', 'tfoot']),
    tbody: new Set(['tbody', 'tfoot']),
    tfoot: new Set(['tbody']),
    colgroup: new Set(['colgroup']),
    caption: new Set(['caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'tr']),
    head: new Set(['body']),
};

// ── Predeclared XML namespaces ───────────────────────────────────────────────

export const PREDECLARED_NAMESPACES: ReadonlyMap<string, string> = new Map([
    ['xml', 'http://www.w3.org/XML/1998/namespace'],
    ['xmlns', 'http://www.w3.org/2000/xmlns/'],
]);

// ── Inline elements (do not trigger block layout) ────────────────────────────

export const HTML_INLINE_ELEMENTS = new Set([
    'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data',
    'dfn', 'em', 'i', 'kbd', 'mark', 'q', 'rp', 'rt', 'ruby',
    's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time',
    'u', 'var', 'wbr', 'img', 'input',
]);

// ── Foreign content namespace URIs ───────────────────────────────────────────
// Maps namespace URIs to the HTML5 foreign content parent element name.

export const FOREIGN_CONTENT_NAMESPACES: Record<string, string> = {
    'http://www.w3.org/2000/svg': 'svg',
    'http://www.w3.org/1998/Math/MathML': 'math',
};


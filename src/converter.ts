/**
 * converter.ts — HTML5 → HXML source conversion.
 *
 * Since HXML is a superset of HTML5, every HTML document is valid HXML.
 * This converter takes HTML5 source and produces formatted HXML source
 * with explicit closing tags and consistent indentation, ready to be
 * annotated with XML namespace content.
 *
 * Usage:
 *   import { htmlToHxml } from 'hxml';
 *   const { hxml } = htmlToHxml('<html><body><p>Hello</body></html>');
 *   // => properly indented HXML with explicit </p>, </body>, </html>
 */

import { parse } from './parser.js';
import type { HxmlNode, ElementNode } from './ast.js';
import { HTML_RAW_TEXT_ELEMENTS, HTML_VOID_ELEMENTS, HTML_INLINE_ELEMENTS } from './constants.js';
import { escapeAttr } from './utils/escape.js';

type QuoteStyle = '"' | "'";

// ── Public API ────────────────────────────────────────────────────────────────

export interface ConvertOptions {
    /** Indentation string.  Default: '  ' (2 spaces). */
    indent?: string;
    /**
     * If true, preserve the source document's whitespace text nodes verbatim.
     * If false (default), reformat whitespace for consistent indentation.
     */
    preserveWhitespace?: boolean;
    /** Sort attributes alphabetically by name. Default: false. */
    sortAttributes?: boolean;
    /** Preserve original attribute quote style (`'` vs `"`) when possible. */
    preserveAttributeQuotes?: boolean;
}

export interface ConvertResult {
    hxml: string;
}

/**
 * Convert an HTML5 source string into equivalent HXML source.
 *
 * The output is a valid HXML document that:
 * - Has explicit closing tags for all elements (no optional-close omissions)
 * - Is consistently indented
 * - Preserves all comments, processing instructions, and CDATA verbatim
 * - Can be safely extended with XML namespace content
 */
export function htmlToHxml(source: string, options?: ConvertOptions): ConvertResult {
    const indent = options?.indent ?? '  ';
    const preserveWhitespace = options?.preserveWhitespace ?? false;
    const sortAttributes = options?.sortAttributes ?? false;
    const preserveAttributeQuotes = options?.preserveAttributeQuotes ?? false;

    const { ast } = parse(source, { preserveWhitespace: true });
    const quoteHints = preserveAttributeQuotes ? collectAttributeQuoteHints(ast.children, source) : new Map<string, '"' | "'">();
    const hxml = serializeNodes(
        ast.children,
        indent,
        0,
        preserveWhitespace,
        sortAttributes,
        preserveAttributeQuotes,
        quoteHints,
    );

    return { hxml };
}

// ── Serialization ─────────────────────────────────────────────────────────────

function serializeNodes(
    nodes: HxmlNode[],
    indent: string,
    depth: number,
    preserveWS: boolean,
    sortAttributes: boolean,
    preserveAttributeQuotes: boolean,
    quoteHints: Map<string, QuoteStyle>,
): string {
    let out = '';
    for (const node of nodes) {
        out += serializeNode(
            node,
            indent,
            depth,
            preserveWS,
            sortAttributes,
            preserveAttributeQuotes,
            quoteHints,
        );
    }
    return out;
}

function serializeNode(
    node: HxmlNode,
    indent: string,
    depth: number,
    preserveWS: boolean,
    sortAttributes: boolean,
    preserveAttributeQuotes: boolean,
    quoteHints: Map<string, QuoteStyle>,
): string {
    switch (node.type) {
        case 'doctype':
            // Always emit the standard HTML5 DOCTYPE.
            return `<!DOCTYPE html>\n`;

        case 'text':
            // When not preserving whitespace, normalize runs of whitespace to a
            // single space so that re-serialized text doesn't carry stray newlines
            // and indentation from the original source.
            if (!preserveWS) {
                return node.value.replace(/\s+/g, ' ');
            }
            return node.value;

        case 'comment':
            return `<!--${node.value}-->`;

        case 'cdata':
            return `<![CDATA[${node.value}]]>`;

        case 'processingInstruction':
            return `<?${node.target}${node.data ? ' ' + node.data : ''}?>`;

        case 'element':
            return serializeElement(
                node,
                indent,
                depth,
                preserveWS,
                sortAttributes,
                preserveAttributeQuotes,
                quoteHints,
            );
    }
}

function serializeElement(
    element: ElementNode,
    indent: string,
    depth: number,
    preserveWS: boolean,
    sortAttributes: boolean,
    preserveAttributeQuotes: boolean,
    quoteHints: Map<string, QuoteStyle>,
): string {
    // HXML preserves HTML element names in their original case (usually lowercase).
    const tagName = element.mode === 'html' ? element.name.toLowerCase() : element.name;
    const pad = indent.repeat(depth);
    const childPad = indent.repeat(depth + 1);

    const attrs = sortAttributes
        ? [...element.attrs].sort((left, right) => left.name.localeCompare(right.name))
        : element.attrs;

    // Open tag with attributes
    let openTag = `<${tagName}`;
    for (const attr of attrs) {
        if (attr.value === null) {
            openTag += ` ${attr.name}`;
            continue;
        }

        const quoteHint = preserveAttributeQuotes ? quoteHints.get(attrKey(attr)) : undefined;
        if (quoteHint === "'") {
            openTag += ` ${attr.name}='${escapeAttrSingleQuoted(attr.value)}'`;
            continue;
        }

        openTag += ` ${attr.name}="${escapeAttr(attr.value)}"`;
    }

    // Void elements: no closing tag, no children
    if (HTML_VOID_ELEMENTS.has(tagName) || element.isVoid) {
        return `${pad}${openTag}>`;
    }

    // Raw text elements (script, style, textarea, title): preserve content verbatim
    if (HTML_RAW_TEXT_ELEMENTS.has(tagName)) {
        const content = element.children
            .map(c => (c.type === 'text' ? c.value : ''))
            .join('');
        return `${pad}${openTag}>${content}</${tagName}>`;
    }

    // No children: emit as a single line
    if (element.children.length === 0) {
        return `${pad}${openTag}></${tagName}>`;
    }

    // Check if the element has any block-level children or multi-line structure.
    // Inline-only elements are emitted on one line; block-mixed get indented.
    const shouldIndent = !preserveWS && hasBlockContent(element.children);

    if (!shouldIndent) {
        // Inline: emit open tag, children, close tag on one line.
        const innerPreserved = serializeNodes(
            element.children,
            indent,
            depth + 1,
            preserveWS,
            sortAttributes,
            preserveAttributeQuotes,
            quoteHints,
        );
        return `${pad}${openTag}>${trimInline(innerPreserved)}</${tagName}>`;
    }

    // Block: emit children indented on their own lines.
    let out = `${pad}${openTag}>\n`;
    for (const child of element.children) {
        if (child.type === 'text') {
            const raw = preserveWS ? child.value : child.value.replace(/\s+/g, ' ');
            const v = raw.trim();
            if (v) out += `${childPad}${v}\n`;
        } else if (child.type === 'element') {
            out += serializeElement(
                child,
                indent,
                depth + 1,
                preserveWS,
                sortAttributes,
                preserveAttributeQuotes,
                quoteHints,
            ) + '\n';
        } else {
            // comment, cdata, pi — preserve as-is, indented
            const chunk = serializeNode(
                child,
                indent,
                depth + 1,
                preserveWS,
                sortAttributes,
                preserveAttributeQuotes,
                quoteHints,
            ).trim();
            if (chunk) out += `${childPad}${chunk}\n`;
        }
    }
    out += `${pad}</${tagName}>`;
    return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the node list contains any element or has multi-line text
 * that indicates block-level content.
 */
function hasBlockContent(nodes: HxmlNode[]): boolean {
    for (const node of nodes) {
        if (node.type === 'element' && !HTML_INLINE_ELEMENTS.has(node.name.toLowerCase())) return true;
        if (node.type === 'text' && node.value.includes('\n')) return true;
    }
    return false;
}

/** Collapse leading/trailing whitespace in inline content. */
function trimInline(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

function escapeAttrSingleQuoted(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function attrKey(attr: { loc: { start: { offset: number }; end: { offset: number } } }): string {
    return `${attr.loc.start.offset}:${attr.loc.end.offset}`;
}

function collectAttributeQuoteHints(
    nodes: HxmlNode[],
    source: string,
    out: Map<string, QuoteStyle> = new Map(),
): Map<string, QuoteStyle> {
    for (const node of nodes) {
        if (node.type !== 'element') continue;

        for (const attr of node.attrs) {
            if (attr.value === null) continue;
            const quote = detectQuoteStyle(source, attr.loc.start.offset, attr.loc.end.offset);
            if (quote) out.set(attrKey(attr), quote);
        }

        collectAttributeQuoteHints(node.children, source, out);
    }

    return out;
}

function detectQuoteStyle(source: string, startOffset: number, endOffset: number): QuoteStyle | null {
    const raw = source.slice(startOffset, endOffset);
    const eq = raw.indexOf('=');
    if (eq < 0) return null;

    let i = eq + 1;
    while (i < raw.length && /\s/.test(raw[i])) i++;
    if (i >= raw.length) return null;

    const quote = raw[i];
    if (quote === '"' || quote === "'") return quote;
    return null;
}


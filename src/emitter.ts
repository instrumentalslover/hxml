/**
 * emitter.ts — AST → HTML5 output for HXML.
 *
 * Serializes an HXML AST back to valid HTML5.  The default emit mode
 * ("custom-elements") transforms XML-mode elements into Custom Elements
 * with hyphenated tag names.
 */

import type {
    RootNode, HxmlNode, ElementNode, Attribute,
} from './ast.js';
import { HTML_RAW_TEXT_ELEMENTS, HTML_INLINE_ELEMENTS, PREDECLARED_NAMESPACES } from './constants.js';
import type { SourceRange } from './utils/source-map.js';
import { escapeHtml, escapeAttr, sanitizeComment, sanitizePI } from './utils/escape.js';
import {
    type NsContext,
    type EmitRuntimeOptions,
    type EmitSink,
    SourceMapBuilder,
    createEmitSink,
    mergeNs,
    normalizeCustomElementPrefix,
} from './emitter-internal/runtime.js';
import { emitXmlElement as emitXmlElementByMode } from './emitter-internal/xml-modes.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type EmitMode =
    | 'custom-elements'   // prefix:local → prefix-local (Custom Elements)
    | 'data-attributes'   // XML elements → <div data-hxml-tag="...">
    | 'passthrough'       // XML elements emitted as-is
    | 'strip';            // XML elements removed, only text content kept

export interface EmitOptions {
    mode?: EmitMode;
    /** Indent string, default ''. Pass '  ' (2 spaces) for formatted output. */
    indent?: string;
    /** Whether to include the DOCTYPE.  Default true. */
    doctype?: boolean;
    /**
     * When true, generate a V3 source map alongside the HTML output.
     * The source path used in the map can be set via `sourceFile`.
     */
    sourceMap?: boolean;
    /** Source file path embedded in the source map.  Default: "input.hxml". */
    sourceFile?: string;
    /** Optional source content embedded in the source map `sourcesContent`. */
    sourceContent?: string;
    /** Prefix prepended to generated custom-element names. */
    customElementPrefix?: string;
    /** How processing instructions should be emitted. Default: "comment". */
    processingInstructionMode?: 'comment' | 'custom-elements';
    /** Preserve CDATA sections as comments instead of escaping to text. */
    preserveCdataAsComment?: boolean;
}

export interface EmitResult {
    html: string;
    /** V3 source map JSON string.  Only present when `options.sourceMap` is true. */
    sourceMap?: string;
}

export interface EmitStreamResult {
    /** V3 source map JSON string.  Only present when `options.sourceMap` is true. */
    sourceMap?: string;
}

// ── Emitter ──────────────────────────────────────────────────────────────────

export function emit(ast: RootNode, options?: EmitOptions): EmitResult {
    const mode = options?.mode ?? 'custom-elements';
    const indent = options?.indent ?? '';
    const includeDoctype = options?.doctype ?? true;
    const wantSourceMap = options?.sourceMap ?? false;
    const rootNs: NsContext = new Map(PREDECLARED_NAMESPACES);
    const runtime: EmitRuntimeOptions = {
        customElementPrefix: normalizeCustomElementPrefix(options?.customElementPrefix),
        processingInstructionMode: options?.processingInstructionMode ?? 'comment',
        preserveCdataAsComment: options?.preserveCdataAsComment ?? false,
    };

    const chunks: string[] = [];
    const smb = wantSourceMap ? new SourceMapBuilder() : null;
    const sink = createEmitSink((chunk) => chunks.push(chunk), smb);

    for (const node of ast.children) {
        emitNode(node, mode, indent, 0, includeDoctype, false, rootNs, runtime, sink);
    }

    const html = chunks.join('');

    if (wantSourceMap) {
        const sourceFile = options?.sourceFile ?? 'input.hxml';
        return { html, sourceMap: smb!.buildSourceMap(sourceFile, options?.sourceContent) };
    }

    return { html };
}

export function emitToStream(
    ast: RootNode,
    writeChunk: (chunk: string) => void,
    options?: EmitOptions,
): EmitStreamResult {
    const mode = options?.mode ?? 'custom-elements';
    const indent = options?.indent ?? '';
    const includeDoctype = options?.doctype ?? true;
    const wantSourceMap = options?.sourceMap ?? false;
    const rootNs: NsContext = new Map(PREDECLARED_NAMESPACES);
    const runtime: EmitRuntimeOptions = {
        customElementPrefix: normalizeCustomElementPrefix(options?.customElementPrefix),
        processingInstructionMode: options?.processingInstructionMode ?? 'comment',
        preserveCdataAsComment: options?.preserveCdataAsComment ?? false,
    };

    const smb = wantSourceMap ? new SourceMapBuilder() : null;
    const sink = createEmitSink(writeChunk, smb);

    for (const node of ast.children) {
        emitNode(node, mode, indent, 0, includeDoctype, false, rootNs, runtime, sink);
    }

    if (!wantSourceMap) return {};

    const sourceFile = options?.sourceFile ?? 'input.hxml';
    return { sourceMap: smb!.buildSourceMap(sourceFile, options?.sourceContent) };
}

// ── Node emission ────────────────────────────────────────────────────────────

function emitNode(
    node: HxmlNode,
    mode: EmitMode,
    indent: string,
    depth: number,
    includeDoctype: boolean,
    rawTextParent: boolean,
    nsCtx: NsContext,
    runtime: EmitRuntimeOptions,
    sink: EmitSink,
): void {
    switch (node.type) {
        case 'text':
            sink.write(rawTextParent ? node.value : escapeHtml(node.value), node.loc);
            return;

        case 'comment':
            sink.write(`<!--${sanitizeComment(node.value)}-->`, node.loc);
            return;

        case 'cdata':
            // HTML5 has no CDATA — entity-escape the content
            if (runtime.preserveCdataAsComment) {
                sink.write(`<!-- [CDATA[ ${sanitizeComment(node.value)} ] -->`, node.loc);
            } else {
                sink.write(escapeHtml(node.value), node.loc);
            }
            return;

        case 'processingInstruction':
            // XML declarations (<?xml ...?>) carry no meaning in HTML5 output.
            if (node.target === 'xml') return;
            if (runtime.processingInstructionMode === 'custom-elements') {
                let open = `<hxml-pi target="${escapeAttr(node.target)}"`;
                if (node.data) open += ` data="${escapeAttr(node.data)}"`;
                open += '></hxml-pi>';
                sink.write(open, node.loc);
            } else {
                // Default HTML5-compatible PI representation.
                sink.write(`<!--?${node.target}${node.data ? ' ' + sanitizePI(node.data) : ''}?-->`, node.loc);
            }
            return;

        case 'doctype':
            sink.write(includeDoctype ? '<!DOCTYPE html>\n' : '', node.loc);
            return;

        case 'element':
            emitElement(node, mode, indent, depth, nsCtx, runtime, sink);
            return;
    }
}

function emitElement(
    element: ElementNode,
    mode: EmitMode,
    indent: string,
    depth: number,
    nsCtx: NsContext,
    runtime: EmitRuntimeOptions,
    sink: EmitSink,
): void {
    const childNs = mergeNs(nsCtx, element);

    // XML-mode elements get transformed based on the emit mode
    if (element.mode === 'xml') {
        emitXmlElement(element, mode, indent, depth, childNs, runtime, sink);
        return;
    }

    // HTML-mode elements pass through as-is
    emitHtmlElement(element, mode, indent, depth, childNs, runtime, sink);
}

// ── HTML element emission ────────────────────────────────────────────────────

function emitHtmlElement(
    element: ElementNode,
    mode: EmitMode,
    indent: string,
    depth: number,
    nsCtx: NsContext,
    runtime: EmitRuntimeOptions,
    sink: EmitSink,
): void {
    const tagName = element.name.toLowerCase();
    const isRawText = HTML_RAW_TEXT_ELEMENTS.has(tagName);
    const openTag = appendRegularAttributes(`<${tagName}`, element.attrs);

    if (element.isVoid) {
        sink.write(`${openTag}>`, element.loc);
        return;
    }

    emitElementWithChildren(openTag, tagName, element, mode, indent, depth, nsCtx, runtime, isRawText, sink);
}

// ── XML element emission ─────────────────────────────────────────────────────

function emitXmlElement(
    element: ElementNode,
    emitMode: EmitMode,
    indent: string,
    depth: number,
    nsCtx: NsContext,
    runtime: EmitRuntimeOptions,
    sink: EmitSink,
): void {
    emitXmlElementByMode(element, emitMode, indent, depth, nsCtx, runtime, sink, {
        emitElementWithChildren,
        emitChildren,
        appendRegularAttributes,
        appendAllAttributes,
        emitAttr,
    });
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function emitChildren(
    children: HxmlNode[],
    mode: EmitMode,
    indent: string,
    depth: number,
    nsCtx: NsContext,
    runtime: EmitRuntimeOptions,
    rawTextParent: boolean,
    sink: EmitSink,
): void {
    // Raw text content is always emitted inline with no formatting
    if (rawTextParent || !indent) {
        for (const child of children) {
            emitNode(child, mode, indent, depth + 1, false, rawTextParent, nsCtx, runtime, sink);
        }
        return;
    }

    // Check if children are all inline (text/inline-elements only)
    const hasBlockChild = children.some(c =>
        c.type === 'element' && !HTML_INLINE_ELEMENTS.has(c.name.toLowerCase()),
    );

    if (!hasBlockChild) {
        // Inline-only children: emit without extra formatting
        for (const child of children) {
            emitNode(child, mode, indent, depth + 1, false, false, nsCtx, runtime, sink);
        }
        return;
    }

    // Block children: indent each child on its own line
    const pad = indent.repeat(depth + 1);
    const closePad = indent.repeat(depth);

    for (const child of children) {
        // XML declarations produce no output — skip their indentation too
        if (child.type === 'processingInstruction' && child.target === 'xml') continue;

        if (child.type === 'text') {
            // Only emit non-empty text content
            const trimmed = child.value.trim();
            if (trimmed) {
                sink.write(`\n${pad}`);
                sink.write(escapeHtml(trimmed), child.loc);
            }
        } else {
            sink.write(`\n${pad}`);
            emitNode(child, mode, indent, depth + 1, false, false, nsCtx, runtime, sink);
        }
    }
    sink.write(`\n${closePad}`);
}

function isNamespaceAttrName(name: string): boolean {
    return name.startsWith('xmlns:') || name === 'xmlns';
}

function appendRegularAttributes(baseOpenTag: string, attrs: Attribute[]): string {
    let openTag = baseOpenTag;
    for (const attr of attrs) {
        if (isNamespaceAttrName(attr.name)) continue;
        openTag += emitAttr(attr);
    }
    return openTag;
}

function appendAllAttributes(baseOpenTag: string, attrs: Attribute[]): string {
    let openTag = baseOpenTag;
    for (const attr of attrs) {
        openTag += emitAttr(attr);
    }
    return openTag;
}

function emitElementWithChildren(
    openTagBase: string,
    closingTagName: string,
    element: ElementNode,
    mode: EmitMode,
    indent: string,
    depth: number,
    nsCtx: NsContext,
    runtime: EmitRuntimeOptions,
    rawTextParent: boolean,
    sink: EmitSink,
): void {
    sink.write(`${openTagBase}>`, element.loc);
    emitChildren(element.children, mode, indent, depth, nsCtx, runtime, rawTextParent, sink);
    sink.write(`</${closingTagName}>`);
}

function emitAttr(attr: Attribute): string {
    if (attr.value === null) {
        return ` ${attr.name}`;
    }
    return ` ${attr.name}="${escapeAttr(attr.value)}"`;
}


/**
 * ast.ts — HXML AST node type definitions.
 *
 * Every node carries `type` (discriminant), `mode` (html | xml), and
 * `loc` (source range).  ElementNode additionally carries tag metadata,
 * attributes, namespace declarations, and children.
 */

import type { SourceRange } from './utils/source-map.js';

// ── Parsing mode ─────────────────────────────────────────────────────────────

export type ParsingMode = 'html' | 'xml';

// ── Attribute ────────────────────────────────────────────────────────────────

export interface Attribute {
    name: string;
    value: string | null; // null for boolean attributes (e.g. `disabled`)
    loc: SourceRange;
}

// ── Node types ───────────────────────────────────────────────────────────────

export interface RootNode {
    type: 'root';
    children: HxmlNode[];
    mode: 'html';
    loc: SourceRange;
}

export interface ElementNode {
    type: 'element';
    /** Full tag name, e.g. "data:record" or "div". */
    name: string;
    /** Namespace prefix if present, e.g. "data", otherwise null. */
    prefix: string | null;
    /** Local part after the colon, e.g. "record" or "div". */
    localName: string;
    attrs: Attribute[];
    /** Namespace declarations on this element. prefix → URI. */
    namespaces: Map<string, string>;
    /** Whether the element used `/>` syntax. */
    selfClosing: boolean;
    /** Whether this is an HTML void element or XML self-closing. */
    isVoid: boolean;
    children: HxmlNode[];
    mode: ParsingMode;
    loc: SourceRange;
}

export interface TextNode {
    type: 'text';
    value: string;
    mode: ParsingMode;
    loc: SourceRange;
}

export interface CommentNode {
    type: 'comment';
    value: string;
    mode: ParsingMode;
    loc: SourceRange;
}

export interface CDataNode {
    type: 'cdata';
    value: string;
    mode: ParsingMode;
    loc: SourceRange;
}

export interface ProcessingInstNode {
    type: 'processingInstruction';
    /** e.g. "xml" or "myapp" */
    target: string;
    /** The data after the target, e.g. 'version="1.0"' */
    data: string;
    mode: ParsingMode;
    loc: SourceRange;
}

export interface DoctypeNode {
    type: 'doctype';
    value: string;
    mode: 'html';
    loc: SourceRange;
}

// ── Union ────────────────────────────────────────────────────────────────────

export type HxmlNode =
    | ElementNode
    | TextNode
    | CommentNode
    | CDataNode
    | ProcessingInstNode
    | DoctypeNode;

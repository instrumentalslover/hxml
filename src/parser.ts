/**
 * parser.ts — Token stream → AST tree builder for HXML.
 *
 * Consumes tokens from the tokenizer and builds the AST.  Handles:
 * - Mode switching (colon in tag name → XML mode)
 * - HTML auto-close rules
 * - Hierarchical namespace scope chain
 * - Error recovery (always produces a complete AST)
 */

import type {
    RootNode, ElementNode, HxmlNode, ParsingMode, Attribute,
} from './ast.js';
import { Tokenizer, type Token } from './tokenizer.js';
import {
    HTML_VOID_ELEMENTS,
    HTML_AUTO_CLOSE_BEFORE,
    PREDECLARED_NAMESPACES,
} from './constants.js';
import { SourceTracker } from './utils/source-map.js';
import { makeError, type Diagnostic } from './utils/errors.js';
import { ensureHtmlOptionalContainers as ensureHtmlOptionalContainersImpl } from './parser-internal/html-normalization.js';
import { isXmlName, splitName, emptyRange, closestOpenTag } from './parser-internal/helpers.js';
import { reportInvalidReferences } from './parser-internal/diagnostics.js';
import { createImpliedHtmlElement } from './parser-internal/implied-elements.js';
import {
    autoCloseBefore,
    consumeImplicitHtmlClosure,
    rememberImplicitHtmlClosures,
} from './parser-internal/html-recovery.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParseResult {
    ast: RootNode;
    diagnostics: Diagnostic[];
}

export interface ParseOptions {
    /** If true, don't discard whitespace-only text nodes in HTML mode. */
    preserveWhitespace?: boolean;
    /** If true, parse as a fragment and skip implicit html/head/body wrapping. */
    fragment?: boolean;
}

// ── Stack entry ──────────────────────────────────────────────────────────────

interface StackEntry {
    node: ElementNode | RootNode;
    mode: ParsingMode;
    /** Namespace declarations on this element.  prefix → URI. */
    namespaces: Map<string, string>;
    /** True when inside an explicit <xml> mode-switch region. */
    xmlRegion: boolean;
}

const EMPTY_CHILDREN: HxmlNode[] = [];
const HTML_MODE_SWITCH_TAG = 'xml';
const ADOPTION_FORMATTING_TAGS = new Set(['b', 'i', 'em', 'strong']);

// ── Parser ───────────────────────────────────────────────────────────────────

export function parse(source: string, options?: ParseOptions): ParseResult {
    const tokenizer = new Tokenizer(source);
    const tokens = tokenizer.tokenize();
    const diagnostics: Diagnostic[] = [...tokenizer.diagnostics];
    const preserveWhitespace = options?.preserveWhitespace ?? false;
    const fragment = options?.fragment ?? false;
    const tracker = new SourceTracker(source);

    // Root node
    const root: RootNode = {
        type: 'root',
        children: EMPTY_CHILDREN,
        mode: 'html',
        loc: emptyRange(),
    };

    // Element stack — tracks nesting and namespace scope
    const stack: StackEntry[] = [{
        node: root,
        mode: 'html',
        namespaces: new Map(PREDECLARED_NAMESPACES),
        xmlRegion: false,
    }];

    const current = (): StackEntry => stack[stack.length - 1];
    const recentlyImplicitlyClosedHtml: string[] = [];

    function appendChild(parent: RootNode | ElementNode, child: HxmlNode): void {
        if (parent.children === EMPTY_CHILDREN) {
            parent.children = [];
        }
        parent.children.push(child);
    }

    function ensureHtmlOptionalContainers(): void {
        ensureHtmlOptionalContainersImpl(root, emptyRange);
    }

    // ── Process tokens ─────────────────────────────────────────────────────

    for (const token of tokens) {
        switch (token.type) {
            case 'TEXT': {
                const parentMode = current().mode;
                // In HTML mode, skip whitespace-only text nodes (unless preserved)
                if (!preserveWhitespace && parentMode === 'html' && !token.value.trim()) {
                    continue;
                }
                const textNode: HxmlNode = {
                    type: 'text',
                    value: reportInvalidReferences(token.value, token.loc, tracker, diagnostics),
                    mode: parentMode,
                    loc: token.loc,
                };
                appendChild(current().node, textNode);
                break;
            }

            case 'COMMENT': {
                const commentNode: HxmlNode = {
                    type: 'comment',
                    value: token.value,
                    mode: current().mode,
                    loc: token.loc,
                };
                appendChild(current().node, commentNode);
                break;
            }

            case 'CDATA': {
                const cdataNode: HxmlNode = {
                    type: 'cdata',
                    value: token.value,
                    mode: current().mode,
                    loc: token.loc,
                };
                appendChild(current().node, cdataNode);
                break;
            }

            case 'PI': {
                const piNode: HxmlNode = {
                    type: 'processingInstruction',
                    target: token.target,
                    data: token.data,
                    mode: current().mode,
                    loc: token.loc,
                };
                appendChild(current().node, piNode);
                break;
            }

            case 'DOCTYPE': {
                const doctypeNode: HxmlNode = {
                    type: 'doctype',
                    value: token.value,
                    mode: 'html',
                    loc: token.loc,
                };
                // DOCTYPE always goes on root
                appendChild(root, doctypeNode);
                break;
            }

            case 'OPEN_TAG': {
                const modeSwitchXml = token.name.toLowerCase() === HTML_MODE_SWITCH_TAG && current().mode === 'html';
                const xmlMode = isXmlName(token.name) || modeSwitchXml || current().xmlRegion;
                const mode: ParsingMode = xmlMode ? 'xml' : 'html';
                const { prefix, localName } = splitName(token.name);

                // Multiple colons in a tag name (e.g. <a:b:c>) are not valid in
                // either XML or HTML.  Emit a diagnostic but continue parsing
                // using the first colon as the prefix boundary.
                if (xmlMode && localName.includes(':')) {
                    diagnostics.push(makeError(
                        'HXML104',
                        `Tag name "${token.name}" contains more than one colon`,
                        token.loc,
                        'XML tag names may have at most one colon separating prefix and local name',
                    ));
                }

                // Collect namespace declarations from attributes
                const nsDecls = new Map<string, string>();
                for (const attr of token.attrs) {
                    if (attr.name.startsWith('xmlns:')) {
                        const nsPrefix = attr.name.slice(6);
                        nsDecls.set(nsPrefix, attr.value ?? '');
                    } else if (attr.name === 'xmlns') {
                        nsDecls.set('#default', attr.value ?? '');
                    }
                }

                // HTML auto-close rules — only for HTML-mode elements
                if (!xmlMode) {
                    autoCloseBefore(token.name, stack, HTML_AUTO_CLOSE_BEFORE);
                }

                if (!xmlMode && token.name.toLowerCase() === 'col') {
                    const parent = current().node;
                    if (
                        parent.type === 'element' &&
                        parent.mode === 'html' &&
                        parent.name.toLowerCase() === 'table'
                    ) {
                        const impliedColgroup = createImpliedHtmlElement('colgroup', EMPTY_CHILDREN, emptyRange);
                        appendChild(parent, impliedColgroup);
                        stack.push({
                            node: impliedColgroup,
                            mode: 'html',
                            namespaces: new Map(),
                            xmlRegion: current().xmlRegion,
                        });
                    }
                }

                // Convert token attributes to AST attributes
                const attrs: Attribute[] = token.attrs.map(a => ({
                    name: a.name,
                    value: a.value === null ? null : reportInvalidReferences(a.value, a.loc, tracker, diagnostics),
                    loc: a.loc,
                }));

                const lo = token.name.toLowerCase();
                const isVoid = (!xmlMode && HTML_VOID_ELEMENTS.has(lo)) || token.selfClosing;

                // Build the element node
                const element: ElementNode = {
                    type: 'element',
                    name: token.name,
                    prefix,
                    localName,
                    attrs,
                    namespaces: nsDecls,
                    selfClosing: token.selfClosing,
                    isVoid,
                    children: EMPTY_CHILDREN,
                    mode,
                    loc: token.loc,
                };

                // Append to current parent
                appendChild(current().node, element);

                // Push onto stack if not void/self-closing
                if (!isVoid) {
                    stack.push({
                        node: element,
                        mode,
                        namespaces: nsDecls,
                        xmlRegion: current().xmlRegion || modeSwitchXml,
                    });
                }
                break;
            }

            case 'CLOSE_TAG': {
                const xmlExpected = isXmlName(token.name);

                // Find matching open element on the stack
                let found = -1;
                for (let i = stack.length - 1; i > 0; i--) {
                    const entry = stack[i];
                    if (entry.node.type !== 'element') continue;
                    const stackName = entry.node.name;

                    // XML: exact match.  HTML: case-insensitive match.
                    if (xmlExpected) {
                        if (stackName === token.name) { found = i; break; }
                    } else {
                        if (stackName.toLowerCase() === token.name.toLowerCase()) { found = i; break; }
                    }
                }

                if (found < 0) {
                    if (!xmlExpected && consumeImplicitHtmlClosure(token.name, recentlyImplicitlyClosedHtml, ADOPTION_FORMATTING_TAGS)) {
                        continue;
                    }
                    const suggestion = closestOpenTag(stack, token.name, xmlExpected);
                    diagnostics.push(makeError(
                        'HXML101',
                        `Unmatched closing tag </${token.name}>`,
                        token.loc,
                        suggestion ? `Did you mean </${suggestion}>?` : undefined,
                    ));
                    continue;
                }

                // If there are unclosed elements between the match and stack top,
                // that's an error for XML-mode elements but normal for HTML.
                if (found < stack.length - 1) {
                    const unclosed = stack.slice(found + 1);
                    rememberImplicitHtmlClosures(unclosed, recentlyImplicitlyClosedHtml);
                    for (const entry of unclosed) {
                        if (entry.mode === 'xml' && entry.node.type === 'element') {
                            diagnostics.push(makeError(
                                'HXML102',
                                `Unclosed XML element <${entry.node.name}> inside <${token.name}>`,
                                entry.node.loc,
                                `Add </${entry.node.name}> before </${token.name}>`,
                            ));
                        }
                    }
                }

                // Pop the stack down to and including the found element
                stack.splice(found);
                break;
            }
        }
    }

    // ── Check for unclosed elements at end of input ────────────────────────

    for (let i = 1; i < stack.length; i++) {
        const entry = stack[i];
        if (entry.mode === 'xml' && entry.node.type === 'element') {
            diagnostics.push(makeError(
                'HXML103',
                `XML element <${entry.node.name}> was never closed`,
                entry.node.loc,
                `Add </${entry.node.name}>`,
            ));
        }
    }

    // Update root loc
    if (tokens.length > 0) {
        root.loc = {
            start: tokens[0].loc.start,
            end: tokens[tokens.length - 1].loc.end,
        };
    }

    if (!fragment) {
        ensureHtmlOptionalContainers();
    }

    return { ast: root, diagnostics };
}

/**
 * validator.ts — Post-parse AST validation for HXML.
 *
 * Walks the completed AST and performs checks that require whole-tree context:
 * - Namespace coherence (every prefix is declared in scope)
 * - Attribute uniqueness in XML mode
 * - CDATA placement (only inside XML-mode elements)
 * - Deprecated patterns
 */

import type { RootNode, HxmlNode, ElementNode } from './ast.js';
import { PREDECLARED_NAMESPACES } from './constants.js';
import type { Diagnostic } from './utils/errors.js';
import { makeError, makeWarning } from './utils/errors.js';

// ── Public API ───────────────────────────────────────────────────────────────

export interface XmlRegionSchema {
    /** Full child names allowed under this element (e.g. data:name). */
    allowedChildren?: string[];
    /** Child names that must appear at least once under this element. */
    requiredChildren?: string[];
    /** Attributes that must exist on this element. */
    requiredAttributes?: string[];
}

export interface ValidateOptions {
    /** Enable xml:id uniqueness checks across the full document. Default: true. */
    enforceXmlIdUniqueness?: boolean;
    /** Optional schema map keyed by XML element full name (e.g. data:record). */
    schema?: Record<string, XmlRegionSchema>;
}

export function validate(ast: RootNode, options?: ValidateOptions): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const scopeStack: Map<string, string>[] = [new Map(PREDECLARED_NAMESPACES)];
    const seenXmlIds = new Set<string>();
    const validateOptions: ValidateOptions = {
        enforceXmlIdUniqueness: options?.enforceXmlIdUniqueness ?? true,
        schema: options?.schema,
    };

    walkChildren(ast.children, diagnostics, scopeStack, 'html', seenXmlIds, validateOptions);

    return diagnostics;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolvePrefix(
    stack: Map<string, string>[],
    cache: Map<string, string | null>,
    prefix: string,
): string | null {
    const cached = cache.get(prefix);
    if (cached !== undefined) return cached;

    for (let i = stack.length - 1; i >= 0; i--) {
        const uri = stack[i].get(prefix);
        if (uri !== undefined) {
            cache.set(prefix, uri);
            return uri;
        }
    }

    cache.set(prefix, null);
    return null;
}

function walkChildren(
    children: HxmlNode[],
    diagnostics: Diagnostic[],
    scopeStack: Map<string, string>[],
    parentMode: 'html' | 'xml',
    seenXmlIds: Set<string>,
    options: ValidateOptions,
): void {
    for (const node of children) {
        switch (node.type) {
            case 'element':
                validateElement(node, diagnostics, scopeStack, seenXmlIds, options);
                break;

            case 'cdata':
                // CDATA is only valid inside XML-mode elements
                if (parentMode === 'html') {
                    diagnostics.push(makeWarning(
                        'HXML301',
                        'CDATA section inside HTML-mode element',
                        node.loc,
                        'CDATA is only meaningful inside XML-mode elements',
                    ));
                }
                break;

            case 'doctype':
                // Check for legacy DOCTYPE
                if (node.value.toLowerCase() !== 'html') {
                    diagnostics.push(makeWarning(
                        'HXML302',
                        `Legacy DOCTYPE: "${node.value}"`,
                        node.loc,
                        'Use <!DOCTYPE html> for HXML documents',
                    ));
                }
                break;

            // text, comment, pi — no validation needed
            default:
                break;
        }
    }
}

function validateElement(
    element: ElementNode,
    diagnostics: Diagnostic[],
    scopeStack: Map<string, string>[],
    seenXmlIds: Set<string>,
    options: ValidateOptions,
): void {
    // Push this element's namespace declarations onto the scope stack
    scopeStack.push(element.namespaces);
    const resolveCache = new Map<string, string | null>();

    // ── Namespace prefix validation ──────────────────────────────────────
    if (element.prefix) {
        const uri = resolvePrefix(scopeStack, resolveCache, element.prefix);
        if (!uri) {
            diagnostics.push(makeError(
                'HXML201',
                `Namespace prefix "${element.prefix}" is not declared on <${element.name}>`,
                element.loc,
                `Add xmlns:${element.prefix}="..." to this element or an ancestor`,
            ));
        }
    }

    // ── Namespace declaration uniqueness ────────────────────────────────
    const seenNsDecls = new Set<string>();
    for (const attr of element.attrs) {
        let key: string | null = null;

        if (attr.name === 'xmlns') {
            key = '#default';
        } else if (attr.name.startsWith('xmlns:')) {
            key = attr.name.slice(6);
        }

        if (!key) continue;

        if (seenNsDecls.has(key)) {
            diagnostics.push(makeError(
                'HXML205',
                `Duplicate namespace declaration for prefix "${key === '#default' ? '(default)' : key}" on <${element.name}>`,
                attr.loc,
                'Remove the duplicate xmlns declaration or keep only one value',
            ));
            continue;
        }

        seenNsDecls.add(key);
    }

    // ── Attribute uniqueness in XML mode ─────────────────────────────────
    if (element.mode === 'xml') {
        const seen = new Set<string>();
        for (const attr of element.attrs) {
            if (seen.has(attr.name)) {
                diagnostics.push(makeError(
                    'HXML202',
                    `Duplicate attribute "${attr.name}" on XML element <${element.name}>`,
                    attr.loc,
                    'Remove the duplicate attribute',
                ));
            }
            seen.add(attr.name);
        }

        // XML attributes must have values (no boolean attributes)
        for (const attr of element.attrs) {
            if (attr.value === null && !attr.name.startsWith('xmlns')) {
                diagnostics.push(makeError(
                    'HXML203',
                    `Attribute "${attr.name}" on XML element <${element.name}> must have a value`,
                    attr.loc,
                    `Use ${attr.name}="${attr.name}" for boolean attributes in XML mode`,
                ));
            }
        }

        if (options.enforceXmlIdUniqueness) {
            for (const attr of element.attrs) {
                if (attr.name !== 'xml:id' || attr.value === null) continue;
                if (seenXmlIds.has(attr.value)) {
                    diagnostics.push(makeError(
                        'HXML206',
                        `Duplicate xml:id value "${attr.value}"`,
                        attr.loc,
                        'Ensure every xml:id value is unique across XML-mode elements',
                    ));
                } else {
                    seenXmlIds.add(attr.value);
                }
            }
        }

        const schema = options.schema?.[element.name] ?? options.schema?.[element.localName];
        if (schema) {
            if (schema.requiredAttributes) {
                const attrNames = new Set(element.attrs.map(a => a.name));
                for (const requiredAttr of schema.requiredAttributes) {
                    if (!attrNames.has(requiredAttr)) {
                        diagnostics.push(makeError(
                            'HXML207',
                            `Schema violation on <${element.name}>: missing required attribute "${requiredAttr}"`,
                            element.loc,
                            `Add attribute ${requiredAttr}="..."`,
                        ));
                    }
                }
            }

            const childNames = element.children
                .filter((child): child is ElementNode => child.type === 'element' && child.mode === 'xml')
                .map(child => child.name);

            if (schema.allowedChildren) {
                const allowed = new Set(schema.allowedChildren);
                for (const childName of childNames) {
                    if (!allowed.has(childName)) {
                        diagnostics.push(makeError(
                            'HXML207',
                            `Schema violation on <${element.name}>: child <${childName}> is not allowed`,
                            element.loc,
                            `Allowed children: ${schema.allowedChildren.join(', ')}`,
                        ));
                    }
                }
            }

            if (schema.requiredChildren) {
                const present = new Set(childNames);
                for (const requiredChild of schema.requiredChildren) {
                    if (!present.has(requiredChild)) {
                        diagnostics.push(makeError(
                            'HXML207',
                            `Schema violation on <${element.name}>: missing required child <${requiredChild}>`,
                            element.loc,
                            `Add <${requiredChild}>...</${requiredChild}> inside <${element.name}>`,
                        ));
                    }
                }
            }
        }
    }

    // ── Validate prefixed attributes ─────────────────────────────────────
    for (const attr of element.attrs) {
        if (attr.name.includes(':') && !attr.name.startsWith('xmlns:') && !attr.name.startsWith('xml:')) {
            const attrPrefix = attr.name.split(':')[0];
            const uri = resolvePrefix(scopeStack, resolveCache, attrPrefix);
            if (!uri) {
                diagnostics.push(makeError(
                    'HXML204',
                    `Namespace prefix "${attrPrefix}" used in attribute "${attr.name}" is not declared`,
                    attr.loc,
                    `Add xmlns:${attrPrefix}="..." to this element or an ancestor`,
                ));
            }
        }
    }

    // ── Recurse into children ────────────────────────────────────────────
    walkChildren(element.children, diagnostics, scopeStack, element.mode, seenXmlIds, options);

    // Pop this element's namespace scope
    scopeStack.pop();
}

import type { Attribute, ElementNode, HxmlNode } from '../ast.js';
import { FOREIGN_CONTENT_NAMESPACES } from '../constants.js';
import { escapeAttr } from '../utils/escape.js';
import type { EmitMode } from '../emitter.js';
import type { EmitRuntimeOptions, EmitSink, NsContext } from './runtime.js';

interface XmlModeDeps {
    emitElementWithChildren: (
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
    ) => void;
    emitChildren: (
        children: HxmlNode[],
        mode: EmitMode,
        indent: string,
        depth: number,
        nsCtx: NsContext,
        runtime: EmitRuntimeOptions,
        rawTextParent: boolean,
        sink: EmitSink,
    ) => void;
    appendRegularAttributes: (baseOpenTag: string, attrs: Attribute[]) => string;
    appendAllAttributes: (baseOpenTag: string, attrs: Attribute[]) => string;
    emitAttr: (attr: Attribute) => string;
}

export function emitXmlElement(
    element: ElementNode,
    emitMode: EmitMode,
    indent: string,
    depth: number,
    nsCtx: NsContext,
    runtime: EmitRuntimeOptions,
    sink: EmitSink,
    deps: XmlModeDeps,
): void {
    switch (emitMode) {
        case 'custom-elements':
            emitAsCustomElement(element, emitMode, indent, depth, nsCtx, runtime, sink, deps);
            return;
        case 'data-attributes':
            emitAsDataAttributes(element, emitMode, indent, depth, nsCtx, runtime, sink, deps);
            return;
        case 'passthrough':
            emitAsPassthrough(element, emitMode, indent, depth, nsCtx, runtime, sink, deps);
            return;
        case 'strip':
            emitAsStripped(element, emitMode, indent, depth, nsCtx, runtime, sink, deps);
            return;
    }
}

function emitAsCustomElement(
    element: ElementNode,
    emitMode: EmitMode,
    indent: string,
    depth: number,
    nsCtx: NsContext,
    runtime: EmitRuntimeOptions,
    sink: EmitSink,
    deps: XmlModeDeps,
): void {
    const nsUri = resolveElementNamespaceUri(element, nsCtx);
    if (nsUri && nsUri in FOREIGN_CONTENT_NAMESPACES) {
        emitAsForeignContent(element, emitMode, indent, depth, nsCtx, runtime, nsUri, sink, deps);
        return;
    }

    const baseTag = element.prefix
        ? `${element.prefix}-${element.localName}`
        : element.localName;
    const customTag = `${runtime.customElementPrefix}${baseTag}`;

    let openTag = `<${customTag}`;

    for (const attr of element.attrs) {
        if (attr.name.startsWith('xmlns:')) {
            const prefix = attr.name.slice(6);
            openTag += ` data-xmlns-${prefix}="${escapeAttr(attr.value ?? '')}"`;
        } else if (attr.name === 'xmlns') {
            openTag += ` data-xmlns="${escapeAttr(attr.value ?? '')}"`;
        } else {
            openTag += deps.emitAttr(attr);
        }
    }

    if (element.isVoid && element.children.length === 0) {
        openTag += `></${customTag}>`;
        sink.write(openTag, element.loc);
        return;
    }

    deps.emitElementWithChildren(openTag, customTag, element, emitMode, indent, depth, nsCtx, runtime, false, sink);
}

function emitAsForeignContent(
    element: ElementNode,
    emitMode: EmitMode,
    indent: string,
    depth: number,
    nsCtx: NsContext,
    runtime: EmitRuntimeOptions,
    _nsUri: string,
    sink: EmitSink,
    deps: XmlModeDeps,
): void {
    const tagName = element.localName;
    const openTag = deps.appendRegularAttributes(`<${tagName}`, element.attrs);

    if (element.isVoid && element.children.length === 0) {
        sink.write(`${openTag}/>`, element.loc);
        return;
    }

    deps.emitElementWithChildren(openTag, tagName, element, emitMode, indent, depth, nsCtx, runtime, false, sink);
}

function emitAsDataAttributes(
    element: ElementNode,
    emitMode: EmitMode,
    indent: string,
    depth: number,
    nsCtx: NsContext,
    runtime: EmitRuntimeOptions,
    sink: EmitSink,
    deps: XmlModeDeps,
): void {
    const wrapper = 'div';
    let openTag = `<${wrapper} data-hxml-tag="${escapeAttr(element.name)}"`;

    for (const attr of element.attrs) {
        if (attr.name.startsWith('xmlns:') || attr.name === 'xmlns') {
            const dataName = attr.name === 'xmlns'
                ? 'data-xmlns'
                : `data-xmlns-${attr.name.slice(6)}`;
            openTag += ` ${dataName}="${escapeAttr(attr.value ?? '')}"`;
        } else if (attr.value === null) {
            openTag += ` data-${attr.name}`;
        } else {
            openTag += ` data-${attr.name}="${escapeAttr(attr.value)}"`;
        }
    }

    openTag += '>';
    sink.write(openTag, element.loc);
    deps.emitChildren(element.children, emitMode, indent, depth, nsCtx, runtime, false, sink);
    sink.write(`</${wrapper}>`);
}

function emitAsPassthrough(
    element: ElementNode,
    emitMode: EmitMode,
    indent: string,
    depth: number,
    nsCtx: NsContext,
    runtime: EmitRuntimeOptions,
    sink: EmitSink,
    deps: XmlModeDeps,
): void {
    const openTag = deps.appendAllAttributes(`<${element.name}`, element.attrs);

    if (element.isVoid && element.children.length === 0) {
        sink.write(`${openTag}/>`, element.loc);
        return;
    }

    deps.emitElementWithChildren(openTag, element.name, element, emitMode, indent, depth, nsCtx, runtime, false, sink);
}

function emitAsStripped(
    element: ElementNode,
    emitMode: EmitMode,
    indent: string,
    depth: number,
    nsCtx: NsContext,
    runtime: EmitRuntimeOptions,
    sink: EmitSink,
    deps: XmlModeDeps,
): void {
    deps.emitChildren(element.children, emitMode, indent, depth, nsCtx, runtime, false, sink);
}

function resolveElementNamespaceUri(element: ElementNode, nsCtx: NsContext): string | undefined {
    if (element.prefix === null || element.prefix === '') {
        return nsCtx.get('#default');
    }
    return nsCtx.get(element.prefix);
}

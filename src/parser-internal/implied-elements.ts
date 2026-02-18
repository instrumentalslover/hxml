import type { ElementNode, HxmlNode } from '../ast.js';
import type { SourceRange } from '../utils/source-map.js';

export function createImpliedHtmlElement(
    name: string,
    children: HxmlNode[],
    emptyRange: () => SourceRange,
): ElementNode {
    const loc = children.length > 0
        ? { start: children[0].loc.start, end: children[children.length - 1].loc.end }
        : emptyRange();

    return {
        type: 'element',
        name,
        prefix: null,
        localName: name,
        attrs: [],
        namespaces: new Map(),
        selfClosing: false,
        isVoid: false,
        children,
        mode: 'html',
        loc,
    };
}

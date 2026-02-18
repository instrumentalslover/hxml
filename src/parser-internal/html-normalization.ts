import type { ElementNode, HxmlNode, RootNode } from '../ast.js';
import type { SourceRange } from '../utils/source-map.js';
import { createImpliedHtmlElement } from './implied-elements.js';

const HTML_HEAD_ONLY_TAGS = new Set([
    'base', 'link', 'meta', 'noscript', 'script', 'style', 'template', 'title',
]);

const HTML_DOCUMENT_HINT_TAGS = new Set(['html', 'head', 'body', 'title', 'meta', 'link', 'base']);

function splitHeadBody(nodes: HxmlNode[]): { head: HxmlNode[]; body: HxmlNode[] } {
    const head: HxmlNode[] = [];
    const body: HxmlNode[] = [];
    let inBody = false;

    for (const node of nodes) {
        const isHeadElement =
            node.type === 'element' &&
            node.mode === 'html' &&
            HTML_HEAD_ONLY_TAGS.has(node.name.toLowerCase());

        if (!inBody && isHeadElement) {
            head.push(node);
        } else {
            inBody = true;
            body.push(node);
        }
    }

    return { head, body };
}

export function ensureHtmlOptionalContainers(root: RootNode, emptyRange: () => SourceRange): void {
    const currentChildren = [...root.children];
    const doctypes = currentChildren.filter(n => n.type === 'doctype');
    const contentNodes = currentChildren.filter(n => n.type !== 'doctype');

    if (contentNodes.length === 0) return;

    const shouldNormalize = doctypes.length > 0 || contentNodes.some(node => {
        if (node.type !== 'element' || node.mode !== 'html') return false;
        const name = node.name.toLowerCase();
        return HTML_DOCUMENT_HINT_TAGS.has(name);
    });

    if (!shouldNormalize) return;

    const existingHtml = contentNodes.find(
        (n): n is ElementNode =>
            n.type === 'element' &&
            n.mode === 'html' &&
            n.name.toLowerCase() === 'html',
    );

    if (!existingHtml) {
        const { head, body } = splitHeadBody(contentNodes);
        const htmlChildren: HxmlNode[] = [];
        htmlChildren.push(createImpliedHtmlElement('head', head, emptyRange));
        htmlChildren.push(createImpliedHtmlElement('body', body, emptyRange));
        const html = createImpliedHtmlElement('html', htmlChildren, emptyRange);
        root.children = [...doctypes, html];
        return;
    }

    const hasHead = existingHtml.children.some(
        c => c.type === 'element' && c.mode === 'html' && c.name.toLowerCase() === 'head',
    );
    const hasBody = existingHtml.children.some(
        c => c.type === 'element' && c.mode === 'html' && c.name.toLowerCase() === 'body',
    );

    if (hasHead && hasBody) return;

    if (!hasHead && !hasBody) {
        const { head, body } = splitHeadBody(existingHtml.children);
        existingHtml.children = [
            createImpliedHtmlElement('head', head, emptyRange),
            createImpliedHtmlElement('body', body, emptyRange),
        ];
        return;
    }

    if (hasHead && !hasBody) {
        const headNode = existingHtml.children.find(
            c => c.type === 'element' && c.mode === 'html' && c.name.toLowerCase() === 'head',
        ) as ElementNode;
        const bodyNodes = existingHtml.children.filter(c => c !== headNode);
        existingHtml.children = [headNode, createImpliedHtmlElement('body', bodyNodes, emptyRange)];
        return;
    }

    if (!hasHead && hasBody) {
        const bodyNode = existingHtml.children.find(
            c => c.type === 'element' && c.mode === 'html' && c.name.toLowerCase() === 'body',
        ) as ElementNode;
        const beforeBody: HxmlNode[] = [];
        for (const child of existingHtml.children) {
            if (child === bodyNode) break;
            beforeBody.push(child);
        }
        const { head } = splitHeadBody(beforeBody);
        existingHtml.children = [createImpliedHtmlElement('head', head, emptyRange), bodyNode];
    }
}

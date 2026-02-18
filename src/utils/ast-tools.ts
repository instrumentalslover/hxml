import type { RootNode, HxmlNode, ElementNode, Attribute } from '../ast.js';

export type AstNode = RootNode | HxmlNode;

export interface WalkContext {
    parent: RootNode | ElementNode | null;
    index: number;
    depth: number;
}

export type WalkVisitor = (node: AstNode, ctx: WalkContext) => void;

/**
 * Depth-first AST traversal utility.
 */
export function walk(ast: RootNode, visitor: WalkVisitor): void {
    function visit(node: AstNode, parent: RootNode | ElementNode | null, index: number, depth: number): void {
        visitor(node, { parent, index, depth });

        if (node.type === 'root') {
            for (let i = 0; i < node.children.length; i++) {
                visit(node.children[i], node, i, depth + 1);
            }
            return;
        }

        if (node.type === 'element') {
            for (let i = 0; i < node.children.length; i++) {
                visit(node.children[i], node, i, depth + 1);
            }
        }
    }

    visit(ast, null, -1, 0);
}

export interface TransformContext {
    parent: RootNode | ElementNode | null;
    index: number;
    depth: number;
}

export type TransformVisitor = (node: AstNode, ctx: TransformContext) => AstNode;

/**
 * Creates a transformed copy of the AST by applying a visitor to each node.
 */
export function transform(ast: RootNode, visitor: TransformVisitor): RootNode {
    function cloneAttrs(attrs: Attribute[]): Attribute[] {
        return attrs.map(attr => ({
            name: attr.name,
            value: attr.value,
            loc: {
                start: { ...attr.loc.start },
                end: { ...attr.loc.end },
            },
        }));
    }

    function tx(node: AstNode, parent: RootNode | ElementNode | null, index: number, depth: number): AstNode {
        if (node.type === 'root') {
            const base: RootNode = {
                type: 'root',
                mode: 'html',
                loc: {
                    start: { ...node.loc.start },
                    end: { ...node.loc.end },
                },
                children: node.children.map((child, childIndex) => tx(child, node, childIndex, depth + 1) as HxmlNode),
            };
            const out = visitor(base, { parent, index, depth });
            if (out.type !== 'root') {
                throw new Error('transform(): root visitor must return a RootNode');
            }
            return out;
        }

        let base: HxmlNode;
        switch (node.type) {
            case 'element':
                base = {
                    type: 'element',
                    name: node.name,
                    prefix: node.prefix,
                    localName: node.localName,
                    attrs: cloneAttrs(node.attrs),
                    namespaces: new Map(node.namespaces),
                    selfClosing: node.selfClosing,
                    isVoid: node.isVoid,
                    mode: node.mode,
                    loc: {
                        start: { ...node.loc.start },
                        end: { ...node.loc.end },
                    },
                    children: node.children.map((child, childIndex) => tx(child, node, childIndex, depth + 1) as HxmlNode),
                };
                break;

            case 'text':
                base = {
                    ...node,
                    loc: {
                        start: { ...node.loc.start },
                        end: { ...node.loc.end },
                    },
                };
                break;

            case 'comment':
                base = {
                    ...node,
                    loc: {
                        start: { ...node.loc.start },
                        end: { ...node.loc.end },
                    },
                };
                break;

            case 'cdata':
                base = {
                    ...node,
                    loc: {
                        start: { ...node.loc.start },
                        end: { ...node.loc.end },
                    },
                };
                break;

            case 'processingInstruction':
                base = {
                    ...node,
                    loc: {
                        start: { ...node.loc.start },
                        end: { ...node.loc.end },
                    },
                };
                break;

            case 'doctype':
                base = {
                    ...node,
                    loc: {
                        start: { ...node.loc.start },
                        end: { ...node.loc.end },
                    },
                };
                break;
        }

        return visitor(base, { parent, index, depth }) as HxmlNode;
    }

    return tx(ast, null, -1, 0) as RootNode;
}

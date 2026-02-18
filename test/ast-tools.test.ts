import { describe, it, expect } from 'vitest';
import { parse, walk, transform, Tokenizer } from '../src/index.js';

describe('AST tools', () => {
  it('walk visits nodes depth-first', () => {
    const { ast } = parse('<div><p>Hello</p><span>World</span></div>');
    const visited: string[] = [];

    walk(ast, (node) => {
      if (node.type === 'root') visited.push('root');
      else if (node.type === 'element') visited.push(`el:${node.name}`);
      else if (node.type === 'text') visited.push(`text:${node.value.trim()}`);
    });

    expect(visited[0]).toBe('root');
    expect(visited).toContain('el:div');
    expect(visited).toContain('el:p');
    expect(visited).toContain('el:span');
    expect(visited).toContain('text:Hello');
    expect(visited).toContain('text:World');
  });

  it('transform can rewrite text nodes without mutating original AST', () => {
    const { ast } = parse('<div><p>Hello</p><p>World</p></div>');
    const transformed = transform(ast, node => {
      if (node.type === 'text') {
        return { ...node, value: node.value.toUpperCase() };
      }
      return node;
    });

    const originalP = ast.children.find(n => n.type === 'element' && n.name === 'div');
    const transformedP = transformed.children.find(n => n.type === 'element' && n.name === 'div');

    expect(JSON.stringify(ast)).not.toContain('HELLO');
    expect(JSON.stringify(transformed)).toContain('HELLO');
    expect(originalP).toBeDefined();
    expect(transformedP).toBeDefined();
  });

  it('re-exports Tokenizer from public API', () => {
    const tokenizer = new Tokenizer('<div>x</div>');
    const tokens = tokenizer.tokenize();
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.some(t => t.type === 'OPEN_TAG')).toBe(true);
  });
});

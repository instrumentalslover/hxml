import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { validate } from '../src/validator.js';
import type { ElementNode, HxmlNode } from '../src/ast.js';
import * as fs from 'fs';
import * as path from 'path';

/** Helper to find elements by name in a flat list of children. */
function findElement(children: HxmlNode[], name: string): ElementNode | undefined {
  for (const node of children) {
    if (node.type === 'element' && node.name.toLowerCase() === name.toLowerCase()) {
      return node;
    }
  }
  return undefined;
}

/** Recursively find the first element matching a name. */
function findDeep(children: HxmlNode[], name: string): ElementNode | undefined {
  for (const node of children) {
    if (node.type === 'element') {
      if (node.name.toLowerCase() === name.toLowerCase()) return node;
      const found = findDeep(node.children, name);
      if (found) return found;
    }
  }
  return undefined;
}

describe('Parser', () => {
  describe('basic HTML parsing', () => {
    it('parses a simple document', () => {
      const { ast, diagnostics } = parse('<div><p>Hello</p></div>');
      expect(ast.type).toBe('root');
      expect(diagnostics).toHaveLength(0);

      const div = findElement(ast.children, 'div');
      expect(div).toBeDefined();
      expect(div!.mode).toBe('html');
    });

    it('handles void elements', () => {
      const { ast } = parse('<br><hr><img src="x">');
      const children = ast.children.filter(n => n.type === 'element') as ElementNode[];
      expect(children).toHaveLength(3);
      expect(children[0].isVoid).toBe(true);
      expect(children[1].isVoid).toBe(true);
      expect(children[2].isVoid).toBe(true);
    });

    it('auto-closes <p> before block elements', () => {
      const { ast, diagnostics } = parse('<p>First<p>Second');
      expect(diagnostics).toHaveLength(0);
      // Both <p> elements should be at the same level (root children)
      const paragraphs = ast.children.filter(
        n => n.type === 'element' && n.name === 'p'
      );
      expect(paragraphs).toHaveLength(2);
    });

    it('auto-closes <li> before another <li>', () => {
      const { ast } = parse('<ul><li>One<li>Two<li>Three</ul>');
      const ul = findElement(ast.children, 'ul');
      expect(ul).toBeDefined();
      const lis = ul!.children.filter(
        n => n.type === 'element' && n.name === 'li'
      );
      expect(lis).toHaveLength(3);
    });
  });

  describe('XML mode', () => {
    it('detects XML mode for prefixed elements', () => {
      const { ast } = parse('<data:record xmlns:data="urn:app">content</data:record>');
      const record = findElement(ast.children, 'data:record');
      expect(record).toBeDefined();
      expect(record!.mode).toBe('xml');
      expect(record!.prefix).toBe('data');
      expect(record!.localName).toBe('record');
    });

    it('requires closing tags for XML elements', () => {
      const { ast, diagnostics } = parse('<data:item xmlns:data="urn:app">text');
      // Should report an error for unclosed XML element
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some(d => d.code === 'HXML103')).toBe(true);
    });

    it('handles self-closing XML elements', () => {
      const { ast, diagnostics } = parse('<data:sep xmlns:data="urn:app"/>');
      const sep = findElement(ast.children, 'data:sep');
      expect(sep).toBeDefined();
      expect(sep!.isVoid).toBe(true);
      expect(sep!.selfClosing).toBe(true);
    });

    it('reports undeclared namespace prefix', () => {
      const { ast } = parse('<data:record>text</data:record>');
      const diagnostics = validate(ast);
      expect(diagnostics.some(d => d.code === 'HXML201')).toBe(true);
    });
  });

  describe('mixed mode nesting', () => {
    it('allows HTML inside XML', () => {
      const { ast } = parse(
        '<data:cell xmlns:data="urn:app"><strong>bold</strong></data:cell>'
      );
      const cell = findElement(ast.children, 'data:cell');
      expect(cell).toBeDefined();
      expect(cell!.mode).toBe('xml');

      const strong = findElement(cell!.children, 'strong');
      expect(strong).toBeDefined();
      expect(strong!.mode).toBe('html');
    });

    it('allows XML inside HTML', () => {
      const { ast } = parse(
        '<div><data:item xmlns:data="urn:app">text</data:item></div>'
      );
      const div = findElement(ast.children, 'div');
      expect(div).toBeDefined();

      const item = findElement(div!.children, 'data:item');
      expect(item).toBeDefined();
      expect(item!.mode).toBe('xml');
    });
  });

  describe('namespace scoping', () => {
    it('inherits namespace declarations from ancestors', () => {
      const { ast, diagnostics } = parse(
        '<div xmlns:data="urn:app"><data:child>text</data:child></div>'
      );
      // data: prefix should be valid because it's declared on the div
      const nsErrors = diagnostics.filter(d => d.code === 'HXML201');
      expect(nsErrors).toHaveLength(0);
    });

    it('does not leak namespace across siblings', () => {
      const { ast } = parse(`
        <div xmlns:data="urn:app">
          <data:item>text</data:item>
        </div>
        <data:other>text</data:other>
      `);
      // data:other should fail — the xmlns:data scope ended with </div>
      const valDiags = validate(ast);
      const nsErrors = valDiags.filter(d => d.code === 'HXML201');
      expect(nsErrors.length).toBeGreaterThan(0);
    });
  });

  describe('special constructs', () => {
    it('parses DOCTYPE', () => {
      const { ast } = parse('<!DOCTYPE html><p>Hi</p>');
      const doctype = ast.children.find(n => n.type === 'doctype');
      expect(doctype).toBeDefined();
    });

    it('parses comments', () => {
      const { ast } = parse('<!-- comment --><p>Hi</p>');
      const comment = ast.children.find(n => n.type === 'comment');
      expect(comment).toBeDefined();
      if (comment?.type === 'comment') {
        expect(comment.value).toBe(' comment ');
      }
    });

    it('parses processing instructions', () => {
      const { ast } = parse('<?myapp data="test"?>');
      const pi = ast.children.find(n => n.type === 'processingInstruction');
      expect(pi).toBeDefined();
      if (pi?.type === 'processingInstruction') {
        expect(pi.target).toBe('myapp');
      }
    });

    it('parses CDATA sections', () => {
      const { ast } = parse(
        '<root:el xmlns:root="urn:r"><![CDATA[<raw> & text]]></root:el>'
      );
      const el = findElement(ast.children, 'root:el');
      expect(el).toBeDefined();
      const cdata = el!.children.find(n => n.type === 'cdata');
      expect(cdata).toBeDefined();
      if (cdata?.type === 'cdata') {
        expect(cdata.value).toBe('<raw> & text');
      }
    });

    it('decodes numeric and XML named character references in text', () => {
      const { ast } = parse('<p>&amp; &#60; &#x3C;</p>');
      const p = findElement(ast.children, 'p');
      expect(p).toBeDefined();
      const text = p!.children.find(n => n.type === 'text');
      expect(text).toBeDefined();
      if (text?.type === 'text') {
        expect(text.value).toBe('& < <');
      }
    });

    it('decodes character references in attribute values', () => {
      const { ast } = parse('<div title="A &amp; B &#x3C;"></div>');
      const div = findElement(ast.children, 'div');
      expect(div).toBeDefined();
      const title = div!.attrs.find(a => a.name === 'title');
      expect(title?.value).toBe('A & B <');
    });

    it('decodes HTML5 named character references beyond XML core set', () => {
      const { ast } = parse('<p>&copy; &nbsp; &euro;</p><div title="x &trade; y"></div>');

      const p = findElement(ast.children, 'p');
      expect(p).toBeDefined();
      const text = p!.children.find(n => n.type === 'text');
      expect(text).toBeDefined();
      if (text?.type === 'text') {
        expect(text.value).toContain('©');
        expect(text.value).toContain('\u00a0');
        expect(text.value).toContain('€');
      }

      const div = findElement(ast.children, 'div');
      expect(div).toBeDefined();
      const title = div!.attrs.find(a => a.name === 'title');
      expect(title?.value).toBe('x ™ y');
    });

    it('emits HXML105 for invalid numeric references in text', () => {
      const { diagnostics } = parse('<p>&#x110000; ok</p>');
      const invalid = diagnostics.find(d => d.code === 'HXML105');
      expect(invalid).toBeDefined();
      expect(invalid?.message).toContain('&#x110000;');
    });

    it('emits HXML105 for invalid numeric references in attributes', () => {
      const { diagnostics, ast } = parse('<div title="bad: &#55296;"></div>');
      const invalid = diagnostics.find(d => d.code === 'HXML105');
      expect(invalid).toBeDefined();

      const div = findElement(ast.children, 'div');
      const title = div?.attrs.find(a => a.name === 'title');
      expect(title?.value).toContain('&#55296;');
    });

    it('treats XML-like tags inside raw text elements as plain text', () => {
      const source = '<script>const x = "<data:record xmlns:data=\\"urn:app\\">";</SCRIPT>';
      const { ast, diagnostics } = parse(source);
      const script = findElement(ast.children, 'script');
      expect(script).toBeDefined();
      const text = script!.children.find(n => n.type === 'text');
      expect(text).toBeDefined();
      if (text?.type === 'text') {
        expect(text.value).toContain('<data:record');
      }
      // No XML-prefix validation errors should be emitted for raw-text content.
      const valDiags = validate(ast);
      expect(valDiags.some(d => d.code === 'HXML201')).toBe(false);
      expect(diagnostics.some(d => d.severity === 'error')).toBe(false);
    });

    it('emits HXML105 for invalid numeric references in text and attributes', () => {
      const { diagnostics } = parse('<p>&#x110000;</p><div title="bad: &#55296;"></div>');
      const invalidRefDiags = diagnostics.filter(d => d.code === 'HXML105');
      expect(invalidRefDiags).toHaveLength(2);
      expect(invalidRefDiags[0].message).toContain('&#x110000;');
      expect(invalidRefDiags[1].message).toContain('&#55296;');
    });
  });

  describe('error recovery', () => {
    it('handles unmatched close tags gracefully', () => {
      const { ast, diagnostics } = parse('<div>text</span></div>');
      expect(diagnostics.some(d => d.code === 'HXML101')).toBe(true);
      // Parser should still produce a complete AST
      expect(ast.type).toBe('root');
    });

    it('adds close-tag typo hint when a near match exists', () => {
      const { diagnostics } = parse('<div>text</dvi>');
      const diag = diagnostics.find(d => d.code === 'HXML101');
      expect(diag).toBeDefined();
      expect(diag?.hint).toContain('</div>');
    });

    it('always produces an AST even with errors', () => {
      const { ast } = parse('<<<>>>');
      expect(ast.type).toBe('root');
    });

    it('emits HXML104 for tag names with multiple colons', () => {
      const { ast, diagnostics } = parse('<a:b:c xmlns:a="urn:a">text</a:b:c>');
      expect(diagnostics.some(d => d.code === 'HXML104')).toBe(true);
      // Parser still produces an element — prefix is 'a', localName is 'b:c'
      expect(ast.type).toBe('root');
      const el = ast.children.find(n => n.type === 'element') as ElementNode | undefined;
      expect(el).toBeDefined();
      expect(el!.prefix).toBe('a');
    });
  });

  describe('fixture files', () => {
    const fixtureDir = path.join(__dirname, 'fixtures');

    it('parses basic.hxml without errors', () => {
      const source = fs.readFileSync(path.join(fixtureDir, 'basic.hxml'), 'utf-8');
      const { ast, diagnostics } = parse(source);
      expect(ast.type).toBe('root');
      expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });

    it('parses mixed-modes.hxml with expected structure', () => {
      const source = fs.readFileSync(path.join(fixtureDir, 'mixed-modes.hxml'), 'utf-8');
      const { ast } = parse(source);
      expect(ast.type).toBe('root');

      // Should find XML elements
      const records = findDeep(ast.children, 'data:records');
      expect(records).toBeDefined();
      expect(records!.mode).toBe('xml');
    });

    it('parses xml-errors.hxml with expected errors', () => {
      const source = fs.readFileSync(path.join(fixtureDir, 'xml-errors.hxml'), 'utf-8');
      const { diagnostics } = parse(source);
      // Should have errors for unclosed XML, unmatched close, etc.
      expect(diagnostics.filter(d => d.severity === 'error').length).toBeGreaterThan(0);
    });

    it('parses edge-cases.hxml without crashing', () => {
      const source = fs.readFileSync(path.join(fixtureDir, 'edge-cases.hxml'), 'utf-8');
      const { ast } = parse(source);
      expect(ast.type).toBe('root');
      expect(ast.children.length).toBeGreaterThan(0);
    });
  });
});

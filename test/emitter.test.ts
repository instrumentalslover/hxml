import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { emit, emitToStream } from '../src/emitter.js';
import type { RootNode } from '../src/ast.js';

function normalizeNode(node: unknown): unknown {
  if (!node || typeof node !== 'object') return node;
  const n = node as Record<string, unknown>;
  if (n.type === 'root') {
    return {
      type: 'root',
      children: ((n.children as unknown[]) ?? []).map(normalizeNode),
    };
  }
  if (n.type === 'element') {
    return {
      type: 'element',
      name: n.name,
      mode: n.mode,
      attrs: ((n.attrs as Array<{ name: string; value: string | null }>) ?? []).map(a => ({ name: a.name, value: a.value })),
      children: ((n.children as unknown[]) ?? []).map(normalizeNode),
    };
  }
  if (n.type === 'text') return { type: 'text', value: n.value };
  if (n.type === 'comment') return { type: 'comment', value: n.value };
  if (n.type === 'cdata') return { type: 'cdata', value: n.value };
  if (n.type === 'processingInstruction') return { type: 'processingInstruction', target: n.target, data: n.data };
  if (n.type === 'doctype') return { type: 'doctype', value: n.value };
  return n;
}

function decodeMappings(mappings: string): number[][][] {
  const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const decodeBase64 = (ch: string) => BASE64.indexOf(ch);

  function decodeVlq(str: string, start: number): { value: number; next: number } {
    let result = 0;
    let shift = 0;
    let pos = start;
    while (pos < str.length) {
      const digit = decodeBase64(str[pos]);
      pos++;
      const continuation = (digit & 32) !== 0;
      const chunk = digit & 31;
      result += chunk << shift;
      shift += 5;
      if (!continuation) break;
    }
    const negative = (result & 1) === 1;
    const magnitude = result >> 1;
    return { value: negative ? -magnitude : magnitude, next: pos };
  }

  const lines = mappings.split(';');
  const decoded: number[][][] = [];
  let prevGenCol = 0;
  let prevSrc = 0;
  let prevSrcLine = 0;
  let prevSrcCol = 0;

  for (const line of lines) {
    const segments = line ? line.split(',') : [];
    const outLine: number[][] = [];
    prevGenCol = 0;

    for (const seg of segments) {
      let pos = 0;
      const fields: number[] = [];
      while (pos < seg.length) {
        const decodedVal = decodeVlq(seg, pos);
        fields.push(decodedVal.value);
        pos = decodedVal.next;
      }

      if (fields.length >= 4) {
        prevGenCol += fields[0];
        prevSrc += fields[1];
        prevSrcLine += fields[2];
        prevSrcCol += fields[3];
        outLine.push([prevGenCol, prevSrc, prevSrcLine, prevSrcCol]);
      }
    }

    decoded.push(outLine);
  }

  return decoded;
}

describe('Emitter', () => {
  function at(offset = 0) {
    return {
      line: 1,
      col: 0,
      offset,
    };
  }

  function range() {
    return { start: at(0), end: at(0) };
  }

  /** Parse + emit shorthand. */
  function compile(source: string, mode?: 'custom-elements' | 'data-attributes' | 'passthrough' | 'strip') {
    const { ast } = parse(source);
    return emit(ast, { mode: mode ?? 'custom-elements' }).html;
  }

  describe('custom-elements mode (default)', () => {
    it('passes HTML elements through unchanged', () => {
      const html = compile('<div><p>Hello</p></div>');
      expect(html).toContain('<div>');
      expect(html).toContain('<p>');
      expect(html).toContain('Hello');
      expect(html).toContain('</p>');
      expect(html).toContain('</div>');
    });

    it('transforms XML elements to custom elements', () => {
      const html = compile('<data:record xmlns:data="urn:app">text</data:record>');
      expect(html).toContain('<data-record');
      expect(html).toContain('</data-record>');
      expect(html).toContain('text');
    });

    it('transforms xmlns attributes to data-xmlns', () => {
      const html = compile('<data:el xmlns:data="urn:app">text</data:el>');
      expect(html).toContain('data-xmlns-data="urn:app"');
    });

    it('handles void HTML elements', () => {
      const html = compile('<br><hr><img src="photo.jpg">');
      expect(html).toContain('<br>');
      expect(html).toContain('<hr>');
      expect(html).toContain('<img src="photo.jpg">');
    });

    it('handles self-closing XML elements', () => {
      const html = compile('<data:sep xmlns:data="urn:app"/>');
      expect(html).toContain('<data-sep');
      expect(html).toContain('</data-sep>');
    });

    it('emits DOCTYPE as <!DOCTYPE html>', () => {
      const html = compile('<!DOCTYPE html><p>Hi</p>');
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('emits PIs as HTML comments', () => {
      const html = compile('<?myapp render-mode="fancy"?>');
      expect(html).toContain('<!--?myapp render-mode="fancy"?-->');
    });

    it('emits comments unchanged', () => {
      const html = compile('<!-- test comment -->');
      expect(html).toContain('<!-- test comment -->');
    });

    it('entity-escapes CDATA content', () => {
      const html = compile(
        '<data:el xmlns:data="urn:app"><![CDATA[<raw> & text]]></data:el>'
      );
      expect(html).toContain('&lt;raw&gt;');
      expect(html).toContain('&amp;');
    });

    it('uses configured custom-element prefix', () => {
      const { ast } = parse('<data:record xmlns:data="urn:app">text</data:record>');
      const html = emit(ast, {
        mode: 'custom-elements',
        customElementPrefix: 'x',
      }).html;
      expect(html).toContain('<x-data-record');
      expect(html).toContain('</x-data-record>');
    });

    it('treats default-namespace SVG XML nodes as native foreign content', () => {
      const ast: RootNode = {
        type: 'root',
        mode: 'html',
        loc: range(),
        children: [
          {
            type: 'element',
            name: 'svg',
            prefix: null,
            localName: 'svg',
            attrs: [{ name: 'viewBox', value: '0 0 10 10', loc: range() }],
            namespaces: new Map([['#default', 'http://www.w3.org/2000/svg']]),
            selfClosing: false,
            isVoid: false,
            children: [],
            mode: 'xml',
            loc: range(),
          },
        ],
      };

      const html = emit(ast, { mode: 'custom-elements', doctype: false }).html;
      expect(html).toBe('<svg viewBox="0 0 10 10"></svg>');
    });

    it('can emit processing instructions as custom elements', () => {
      const { ast } = parse('<?myapp render-mode="fancy"?>');
      const html = emit(ast, {
        mode: 'custom-elements',
        processingInstructionMode: 'custom-elements',
        doctype: false,
      }).html;
      expect(html).toContain('<hxml-pi target="myapp" data="render-mode=&quot;fancy&quot;"></hxml-pi>');
    });

    it('can preserve CDATA payload as a comment', () => {
      const { ast } = parse('<data:el xmlns:data="urn:app"><![CDATA[<raw>]]></data:el>');
      const html = emit(ast, {
        mode: 'custom-elements',
        preserveCdataAsComment: true,
      }).html;
      expect(html).toContain('<!-- [CDATA[ <raw> ] -->');
    });
  });

  describe('data-attributes mode', () => {
    it('wraps XML elements in divs with data attributes', () => {
      const html = compile(
        '<data:record xmlns:data="urn:app" id="1">text</data:record>',
        'data-attributes',
      );
      expect(html).toContain('<div data-hxml-tag="data:record"');
      expect(html).toContain('data-id="1"');
      expect(html).toContain('text');
      expect(html).toContain('</div>');
    });
  });

  describe('passthrough mode', () => {
    it('emits XML elements with original tag names', () => {
      const html = compile(
        '<data:record xmlns:data="urn:app">text</data:record>',
        'passthrough',
      );
      expect(html).toContain('<data:record');
      expect(html).toContain('xmlns:data="urn:app"');
      expect(html).toContain('</data:record>');
    });
  });

  describe('strip mode', () => {
    it('strips XML elements, keeping text content', () => {
      const html = compile(
        '<data:record xmlns:data="urn:app">Hello World</data:record>',
        'strip',
      );
      expect(html).toContain('Hello World');
      expect(html).not.toContain('data:record');
      expect(html).not.toContain('data-record');
    });
  });

  describe('mixed mode documents', () => {
    it('correctly transforms a mixed HTML+XML document', () => {
      const source = `<!DOCTYPE html>
<html lang="en">
<body>
  <h1>Title</h1>
  <p>Text
  <data:user xmlns:data="urn:app" id="1">
    <data:name>Alice</data:name>
  </data:user>
</body>
</html>`;
      const html = compile(source);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<h1>Title</h1>');
      expect(html).toContain('<data-user');
      expect(html).toContain('<data-name>Alice</data-name>');
    });
  });

  describe('raw text element escaping', () => {
    it('does not double-escape textarea content', () => {
      const html = compile('<textarea>a < b & c</textarea>');
      expect(html).toContain('<textarea>');
      expect(html).toContain('a < b & c');
      expect(html).not.toContain('&lt;');
      expect(html).not.toContain('&amp;');
    });

    it('does not double-escape title content', () => {
      const html = compile('<title>Title with <angle> brackets</title>');
      expect(html).toContain('<title>');
      expect(html).toContain('Title with <angle> brackets');
      expect(html).not.toContain('&lt;angle&gt;');
    });

    it('does not escape script content', () => {
      const html = compile('<script>if (a < b && c > d) {}</script>');
      expect(html).toContain('if (a < b && c > d) {}');
    });

    it('still escapes normal text nodes', () => {
      const html = compile('<p>a < b & c</p>');
      expect(html).toContain('&lt;');
      expect(html).toContain('&amp;');
    });
  });

  describe('pretty-printing', () => {
    function pretty(source: string, indent = '  ') {
      const { ast } = parse(source);
      return emit(ast, { mode: 'custom-elements', indent, doctype: false }).html;
    }

    it('indents block children', () => {
      const out = pretty('<div><p>Hello</p><p>World</p></div>');
      expect(out).toContain('\n');
      expect(out).toContain('  <p>');
    });

    it('keeps inline content inline', () => {
      const out = pretty('<p><strong>bold</strong> text</p>');
      // Inline children should not introduce extra newlines inside <p>
      expect(out).toContain('<strong>bold</strong>');
    });

    it('does not indent when indent is empty', () => {
      const out = pretty('<div><p>Hello</p></div>', '');
      expect(out).toBe('<div><p>Hello</p></div>');
    });

    it('does not indent raw text elements', () => {
      const out = pretty('<script>var x = 1;</script>');
      expect(out).toContain('<script>var x = 1;</script>');
    });
  });

  describe('source maps', () => {
    it('returns a sourceMap string when requested', () => {
      const { ast } = parse('<div>hello</div>');
      const result = emit(ast, { sourceMap: true, sourceFile: 'test.hxml' });
      expect(result.sourceMap).toBeDefined();
      const map = JSON.parse(result.sourceMap!);
      expect(map.version).toBe(3);
      expect(map.sources).toEqual(['test.hxml']);
      expect(typeof map.mappings).toBe('string');
    });

    it('does not return sourceMap when not requested', () => {
      const { ast } = parse('<div>hello</div>');
      const result = emit(ast, {});
      expect(result.sourceMap).toBeUndefined();
    });

    it('generates non-empty mappings for a document with elements', () => {
      const source = '<!DOCTYPE html>\n<html><body><p>Hi</p></body></html>';
      const { ast } = parse(source);
      const result = emit(ast, { sourceMap: true, sourceFile: 'input.hxml' });
      const map = JSON.parse(result.sourceMap!);
      // Should have at least one mapping (DOCTYPE and html element)
      expect(map.mappings.length).toBeGreaterThan(0);
    });

    it('includes mapping that points to first source position', () => {
      const source = '<div>Hello</div>';
      const { ast } = parse(source);
      const result = emit(ast, { sourceMap: true, sourceFile: 'input.hxml' });
      const map = JSON.parse(result.sourceMap!);
      const decoded = decodeMappings(map.mappings);

      const firstMapped = decoded.flat().find(seg => seg.length === 4);
      expect(firstMapped).toBeDefined();
      // [generatedCol, sourceIndex, sourceLineZeroBased, sourceColZeroBased]
      expect(firstMapped![2]).toBe(0);
      expect(firstMapped![3]).toBe(0);
    });

    it('tracks multi-line source locations', () => {
      const source = '<div>\n  <span>line2</span>\n</div>';
      const { ast } = parse(source, { preserveWhitespace: true });
      const result = emit(ast, {
        sourceMap: true,
        sourceFile: 'input.hxml',
        indent: '  ',
      });
      const map = JSON.parse(result.sourceMap!);
      const decoded = decodeMappings(map.mappings).flat();
      const maxSrcLine = decoded.reduce((max, seg) => Math.max(max, seg[2] ?? 0), 0);

      // 0-based line index > 0 means at least one mapping points to a later source line.
      expect(maxSrcLine).toBeGreaterThan(0);
    });

    it('includes sourcesContent when provided', () => {
      const source = '<div>with-source-content</div>';
      const { ast } = parse(source);
      const result = emit(ast, {
        sourceMap: true,
        sourceFile: 'input.hxml',
        sourceContent: source,
      });
      const map = JSON.parse(result.sourceMap!);
      expect(map.sourcesContent).toEqual([source]);
    });

    it('supports streaming emission with source maps', () => {
      const source = '<div>streamed</div>';
      const { ast } = parse(source);
      const chunks: string[] = [];
      const streamed = emitToStream(ast, (chunk) => chunks.push(chunk), {
        sourceMap: true,
        sourceFile: 'input.hxml',
      });
      expect(chunks.join('')).toBe('<div>streamed</div>');
      expect(streamed.sourceMap).toBeDefined();
      expect(JSON.parse(streamed.sourceMap!).version).toBe(3);
    });
  });

  describe('streaming API', () => {
    it('emitToStream output matches emit html output', () => {
      const source = '<div><p>Hello</p><data:item xmlns:data="urn:app">x</data:item></div>';
      const { ast } = parse(source);

      const direct = emit(ast, { mode: 'custom-elements' }).html;
      const chunks: string[] = [];
      emitToStream(ast, (chunk) => chunks.push(chunk), { mode: 'custom-elements' });

      expect(chunks.join('')).toBe(direct);
    });
  });

  describe('round-trip', () => {
    it('parse → emit(passthrough) → parse preserves AST shape', () => {
      const source = '<div><data:record xmlns:data="urn:app" id="1"><p>Hi</p></data:record></div>';
      const first = parse(source);
      const emitted = emit(first.ast, { mode: 'passthrough', doctype: false }).html;
      const second = parse(emitted);

      expect(normalizeNode(second.ast)).toEqual(normalizeNode(first.ast));
    });
  });
});

import { describe, it, expect } from 'vitest';
import { htmlToHxml, compile } from '../src/index.js';

describe('htmlToHxml', () => {
    it('converts a simple HTML document to HXML', () => {
        const result = htmlToHxml('<div><p>Hello</p></div>');
        expect(result.hxml).toContain('<div>');
        expect(result.hxml).toContain('</div>');
        expect(result.hxml).toContain('<p>Hello</p>');
    });

    it('adds explicit closing tags for optional-close elements', () => {
        // <p> and <li> auto-close in HTML, converter should add explicit close tags
        const result = htmlToHxml('<ul><li>One<li>Two</ul>');
        // Both li elements should have explicit closing tags in the output
        const matches = result.hxml.match(/<\/li>/g);
        expect(matches?.length).toBe(2);
    });

    it('preserves void elements without closing tags', () => {
        const result = htmlToHxml('<div><br><hr><img src="a.jpg" alt=""></div>');
        expect(result.hxml).toContain('<br>');
        expect(result.hxml).toContain('<hr>');
        expect(result.hxml).toContain('<img');
        expect(result.hxml).not.toContain('</br>');
        expect(result.hxml).not.toContain('</hr>');
        expect(result.hxml).not.toContain('</img>');
    });

    it('preserves boolean attributes', () => {
        const result = htmlToHxml('<input type="checkbox" disabled>');
        expect(result.hxml).toContain('disabled');
        expect(result.hxml).not.toContain('disabled="disabled"');
    });

    it('preserves attribute values', () => {
        const result = htmlToHxml('<a href="https://example.com" class="link">text</a>');
        expect(result.hxml).toContain('href="https://example.com"');
        expect(result.hxml).toContain('class="link"');
    });

    it('preserves mixed quote styles when preserveAttributeQuotes is enabled', () => {
        const result = htmlToHxml(`<div a='x' b="y"></div>`, { preserveAttributeQuotes: true });
        expect(result.hxml).toContain(`a='x'`);
        expect(result.hxml).toContain(`b="y"`);
    });

    it('preserves DOCTYPE', () => {
        const result = htmlToHxml('<!DOCTYPE html><html><body>hi</body></html>');
        expect(result.hxml).toContain('<!DOCTYPE html>');
    });

    it('preserves comments', () => {
        const result = htmlToHxml('<div><!-- a comment --></div>');
        expect(result.hxml).toContain('<!-- a comment -->');
    });

    it('preserves raw text element content verbatim', () => {
        const result = htmlToHxml('<script>var x = a < b && c > d;</script>');
        expect(result.hxml).toContain('var x = a < b && c > d;');
    });

    it('preserves style element content verbatim', () => {
        const result = htmlToHxml('<style>body { color: red; }</style>');
        expect(result.hxml).toContain('body { color: red; }');
    });

    it('indents block content', () => {
        const result = htmlToHxml('<div><p>one</p><p>two</p></div>');
        // Both p elements should be indented inside div
        expect(result.hxml).toMatch(/\n\s+<p>/);
    });

    it('respects custom indent string', () => {
        const result = htmlToHxml('<div><p>Hello</p></div>', { indent: '\t' });
        expect(result.hxml).toContain('\t<p>');
    });

    it('round-trips a full HTML document without losing content', () => {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test</title>
</head>
<body>
  <h1>Hello World</h1>
  <p>A paragraph</p>
  <ul>
    <li>Item one</li>
    <li>Item two</li>
  </ul>
</body>
</html>`;
        const { hxml } = htmlToHxml(html);
        // Key content should be preserved
        expect(hxml).toContain('Hello World');
        expect(hxml).toContain('A paragraph');
        expect(hxml).toContain('Item one');
        expect(hxml).toContain('Item two');
        // Explicit closing tags
        expect(hxml).toContain('</h1>');
        expect(hxml).toContain('</p>');
        expect(hxml).toContain('</li>');
        expect(hxml).toContain('</ul>');
    });

    it('escapes attribute values that contain quotes', () => {
        const result = htmlToHxml('<div title="say &quot;hello&quot;">x</div>');
        expect(result.hxml).toContain('<div');
        expect(result.hxml).toContain('</div>');
    });

    it('keeps inline elements on the same line as surrounding text', () => {
        const result = htmlToHxml('<p>text <strong>bold</strong> more text</p>');
        // Inline elements inside a paragraph should not trigger block layout
        expect(result.hxml).toContain('<strong>bold</strong>');
        expect(result.hxml).not.toMatch(/<p>\s*\n\s*text/);
    });

    it('keeps multiple inline siblings inline', () => {
        const result = htmlToHxml('<p>See <a href="#">link</a> and <code>code</code> here</p>');
        expect(result.hxml).toContain('<a');
        expect(result.hxml).toContain('<code>');
        expect(result.hxml).not.toMatch(/\n\s+<a/);
        expect(result.hxml).not.toMatch(/\n\s+<code>/);
    });

    it('normalizes whitespace in text nodes when preserveWhitespace is false', () => {
        // Text with multiple spaces/newlines should be collapsed to single spaces.
        // The output still has indentation (e.g. "  hello world foo"), but the
        // text content itself should not have multiple consecutive spaces.
        const result = htmlToHxml('<p>hello   world\n\n  foo</p>');
        // The text content should be "hello world foo" (normalized), not
        // "hello   world\n\n  foo" (raw).  Check that the raw multi-space
        // sequence from the source does not appear in the output.
        expect(result.hxml).not.toContain('hello   world');
        expect(result.hxml).toContain('hello world foo');
    });

    it('round-trips HTML → HXML → compile and preserves key content', () => {
        const html = '<!DOCTYPE html><html><body><h1>Title</h1><ul><li>One</li><li>Two</li></ul></body></html>';
        const { hxml } = htmlToHxml(html);
        const compiled = compile(hxml, { emit: { mode: 'custom-elements' } });

        expect(compiled.html).toContain('<h1>Title</h1>');
        expect(compiled.html).toContain('<li>One</li>');
        expect(compiled.html).toContain('<li>Two</li>');
        expect(compiled.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    });
});

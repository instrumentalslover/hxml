import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compile, parse, parseFragment, validate, emit } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, 'fixtures');

describe('compile() integration', () => {
    it('chains parse → validate → emit for a simple document', () => {
        const result = compile('<div><p>Hello</p></div>');
        expect(result.html).toContain('<div>');
        expect(result.html).toContain('Hello');
        expect(result.diagnostics).toEqual([]);
    });

    it('recovers gracefully from unclosed elements', () => {
        const result = compile('<div><span>');
        // Should still produce HTML output (parser auto-closes at EOF)
        expect(result.html).toBeTruthy();
        expect(result.html).toContain('<div>');
    });

    it('includes validator diagnostics for undeclared namespaces', () => {
        const result = compile('<data:record>text</data:record>');
        // Validator should flag undeclared 'data' prefix
        const nsErrors = result.diagnostics.filter(d => d.code === 'HXML201');
        expect(nsErrors.length).toBeGreaterThan(0);
        // But output should still be produced
        expect(result.html).toBeTruthy();
    });

    it('respects emit mode option', () => {
        const source = '<data:record xmlns:data="urn:app">text</data:record>';
        
        const customEl = compile(source, { emit: { mode: 'custom-elements' } });
        expect(customEl.html).toContain('data-record');

        const dataAttr = compile(source, { emit: { mode: 'data-attributes' } });
        expect(dataAttr.html).toContain('data-hxml-tag');

        const passthrough = compile(source, { emit: { mode: 'passthrough' } });
        expect(passthrough.html).toContain('data:record');

        const strip = compile(source, { emit: { mode: 'strip' } });
        expect(strip.html).toContain('text');
        expect(strip.html).not.toContain('data:record');
    });

    it('produces the same result as manual parse → validate → emit', () => {
        const source = '<div><data:cell xmlns:data="urn:app">Hello</data:cell></div>';
        
        const { ast, diagnostics: parseDiags } = parse(source);
        const valDiags = validate(ast);
        const { html } = emit(ast, { mode: 'custom-elements' });

        const compiled = compile(source, { emit: { mode: 'custom-elements' } });

        expect(compiled.html).toBe(html);
        expect(compiled.diagnostics).toEqual([...parseDiags, ...valDiags]);
    });

    it('handles empty input', () => {
        const result = compile('');
        expect(result.html).toBe('');
        expect(result.diagnostics).toEqual([]);
    });

    it('handles DOCTYPE', () => {
        const result = compile('<!DOCTYPE html><html><body>Hi</body></html>');
        expect(result.html).toContain('<!DOCTYPE html>');
    });

    it('SVG foreign content emits natively in custom-elements mode', () => {
        const result = compile(
            '<svg:circle xmlns:svg="http://www.w3.org/2000/svg" r="50"/>',
            { emit: { mode: 'custom-elements' } },
        );
        // Should use native SVG element name, not svg-circle
        expect(result.html).toContain('<circle');
        expect(result.html).not.toContain('svg-circle');
    });

    it('returns sourceMap when compile emit sourceMap is enabled', () => {
        const result = compile('<div>m</div>', {
            emit: { sourceMap: true, sourceFile: 'in.hxml' },
        });
        expect(result.sourceMap).toBeDefined();
        const map = JSON.parse(result.sourceMap!);
        expect(map.version).toBe(3);
        expect(map.sources).toEqual(['in.hxml']);
    });

    it('includes sourcesContent when includeSourceContent is true', () => {
        const source = '<div>source-content</div>';
        const result = compile(source, {
            emit: { sourceMap: true, sourceFile: 'in.hxml' },
            includeSourceContent: true,
        });
        const map = JSON.parse(result.sourceMap!);
        expect(map.sourcesContent).toEqual([source]);
    });

    it('supports xml:lang, xml:space, xml:base attributes in XML mode', () => {
        const result = compile(
            '<data:note xmlns:data="urn:app" xml:lang="en" xml:space="preserve" xml:base="/root">x</data:note>',
            { emit: { mode: 'passthrough' } },
        );
        expect(result.diagnostics.some(d => d.code === 'HXML204')).toBe(false);
        expect(result.html).toContain('xml:lang="en"');
        expect(result.html).toContain('xml:space="preserve"');
        expect(result.html).toContain('xml:base="/root"');
    });

    it('does not double-encode decoded attribute character references', () => {
        const source = '<data:record xmlns:data="urn:app" title="A &amp; B &#x3C;">x</data:record>';
        const result = compile(source, { emit: { mode: 'custom-elements' } });
        expect(result.html).toContain('title="A &amp; B &lt;"');
        expect(result.html).not.toContain('&amp;amp;');
    });

    it('passes validator schema options through compile()', () => {
        const source = '<data:record xmlns:data="urn:app"><data:extra/></data:record>';
        const result = compile(source, {
            validate: {
                schema: {
                    'data:record': {
                        allowedChildren: ['data:name'],
                    },
                },
            },
        });
        expect(result.diagnostics.some(d => d.code === 'HXML207')).toBe(true);
    });
});

describe('edge cases', () => {
    it('empty document produces empty output', () => {
        const result = compile('');
        expect(result.html).toBe('');
        expect(result.diagnostics).toEqual([]);
    });

    it('whitespace-only document produces empty output (whitespace stripped)', () => {
        const result = compile('   \n\t\n   ');
        // HTML-mode whitespace-only text nodes are discarded by the parser
        expect(result.html).toBe('');
        expect(result.diagnostics).toEqual([]);
    });

    it('comments-only document preserves comments in output', () => {
        const result = compile('<!-- a --><!-- b -->');
        expect(result.html).toContain('<!-- a -->');
        expect(result.html).toContain('<!-- b -->');
        expect(result.diagnostics).toEqual([]);
    });

    it('<script> close tag matched case-insensitively', () => {
        // HTML5 spec: script close tag is case-insensitive
        const result = compile('<script>var x = 1;</SCRIPT>');
        expect(result.html).toContain('var x = 1;');
        // Should not have unclosed-element diagnostics
        const errors = result.diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
    });

    it('<style> content preserved with case-insensitive close', () => {
        const result = compile('<style>body { color: red; }</STYLE>');
        expect(result.html).toContain('body { color: red; }');
    });

    it('<textarea> content preserved verbatim', () => {
        const result = compile('<textarea>Hello <world></textarea>');
        expect(result.html).toContain('Hello <world>');
    });

    it('document with only a DOCTYPE', () => {
        const result = compile('<!DOCTYPE html>');
        expect(result.html).toContain('<!DOCTYPE html>');
        expect(result.diagnostics).toEqual([]);
    });

    it('unrecognised markup declaration emits HXML003', () => {
        const result = compile('<!bogus><div>text</div>');
        expect(result.diagnostics.some(d => d.code === 'HXML003')).toBe(true);
        // Output should still contain the div content
        expect(result.html).toContain('<div>');
    });

    it('data-attributes mode: boolean attr emits bare data attribute without empty value', () => {
        const { ast } = parse('<ui:btn xmlns:ui="urn:ui" disabled>x</ui:btn>');
        const { html } = emit(ast, { mode: 'data-attributes' });
        expect(html).toContain('data-disabled');
        expect(html).not.toContain('data-disabled=""');
    });

    it('parseFragment skips implicit html/head/body wrapper insertion', () => {
        const { ast } = parseFragment('<title>T</title><p>Body</p>');
        expect(ast.children.some(n => n.type === 'element' && n.name.toLowerCase() === 'html')).toBe(false);
        expect(ast.children.some(n => n.type === 'element' && n.name.toLowerCase() === 'title')).toBe(true);
        expect(ast.children.some(n => n.type === 'element' && n.name.toLowerCase() === 'p')).toBe(true);
    });
});

describe('fixture snapshots', () => {
    it('basic.hxml compiles to expected HTML (custom-elements mode)', () => {
        const source = readFileSync(join(fixtureDir, 'basic.hxml'), 'utf8');
        const expected = readFileSync(join(fixtureDir, 'basic.expected.html'), 'utf8');
        const result = compile(source, { emit: { mode: 'custom-elements' } });
        expect(result.html).toBe(expected);
        expect(result.diagnostics).toEqual([]);
    });

    it('mixed-modes.hxml compiles to expected HTML (custom-elements mode)', () => {
        const source = readFileSync(join(fixtureDir, 'mixed-modes.hxml'), 'utf8');
        const expected = readFileSync(join(fixtureDir, 'mixed-modes.expected.html'), 'utf8');
        const result = compile(source, { emit: { mode: 'custom-elements' } });
        expect(result.html).toBe(expected);
        expect(result.diagnostics).toEqual([]);
    });
});

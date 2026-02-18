import { describe, it, expect } from 'vitest';
import { Tokenizer } from '../src/tokenizer.js';
import { parse } from '../src/parser.js';

describe('Tokenizer edge cases (hardening)', () => {
    function tokenize(src: string) {
        const t = new Tokenizer(src);
        const tokens = t.tokenize();
        return { tokens, diagnostics: t.diagnostics };
    }

    describe('unterminated attribute values', () => {
        it('stops at newline for unterminated double-quoted attribute', () => {
            const { tokens, diagnostics } = tokenize('<div class="foo\n<p>bar</p>');
            // Should NOT consume the entire document as a single attribute value
            expect(diagnostics.some(d => d.code === 'HXML002')).toBe(true);
            // Should still produce tokens after the malformed tag
            expect(tokens.length).toBeGreaterThan(1);
        });

        it('stops at newline for unterminated single-quoted attribute', () => {
            const { tokens, diagnostics } = tokenize("<div class='foo\n<p>bar</p>");
            expect(diagnostics.some(d => d.code === 'HXML002')).toBe(true);
            expect(tokens.length).toBeGreaterThan(1);
        });

        it('stops at EOF for unterminated quoted attribute at end of input', () => {
            const { tokens, diagnostics } = tokenize('<div class="foo');
            expect(diagnostics.some(d => d.code === 'HXML002')).toBe(true);
            expect(tokens.length).toBeGreaterThan(0);
        });

        it('does not trigger on properly quoted attributes', () => {
            const { tokens, diagnostics } = tokenize('<div class="foo">text</div>');
            const unterminatedErrors = diagnostics.filter(d => d.code === 'HXML002');
            expect(unterminatedErrors).toHaveLength(0);
            expect(tokens).toHaveLength(3); // OPEN_TAG, TEXT, CLOSE_TAG
        });
    });

    describe('deeply nested tags', () => {
        it('handles 500 levels of nesting without crashing', () => {
            const open = '<div>'.repeat(500);
            const close = '</div>'.repeat(500);
            const { tokens } = tokenize(open + 'text' + close);
            // Should produce 500 open tags + 1 text + 500 close tags
            expect(tokens.length).toBe(1001);
        });

        it('parser handles deep nesting without stack overflow', () => {
            const open = '<div>'.repeat(200);
            const close = '</div>'.repeat(200);
            const { ast } = parse(open + 'text' + close);
            expect(ast.type).toBe('root');
        });
    });

    describe('empty and near-empty tags', () => {
        it('handles bare < followed by space as text', () => {
            const { tokens } = tokenize('< >');
            // Bare < with no tag name should produce TEXT
            const textTokens = tokens.filter(t => t.type === 'TEXT');
            expect(textTokens.length).toBeGreaterThan(0);
        });

        it('handles bare < at EOF', () => {
            const { tokens } = tokenize('hello<');
            expect(tokens.length).toBeGreaterThanOrEqual(1);
        });

        it('handles bare </ at EOF', () => {
            const { tokens } = tokenize('hello</');
            expect(tokens.length).toBeGreaterThanOrEqual(1);
        });

        it('handles <> as text', () => {
            const { tokens } = tokenize('a<>b');
            // Should not crash; < with no name should be text
            expect(tokens.length).toBeGreaterThan(0);
        });
    });

    describe('input entirely of special characters', () => {
        it('handles input of only < characters', () => {
            const { tokens } = tokenize('<<<<<<');
            expect(tokens.length).toBeGreaterThan(0);
        });

        it('handles input of only > characters', () => {
            const { tokens } = tokenize('>>>>>>');
            expect(tokens).toHaveLength(1);
            expect(tokens[0].type).toBe('TEXT');
        });

        it('handles mixed angle brackets', () => {
            const { tokens } = tokenize('><><><<>');
            expect(tokens.length).toBeGreaterThan(0);
        });
    });

    describe('very long content', () => {
        it('handles very long attribute values', () => {
            const longValue = 'x'.repeat(50000);
            const { tokens } = tokenize(`<div class="${longValue}">text</div>`);
            expect(tokens.length).toBeGreaterThanOrEqual(3);
            if (tokens[0].type === 'OPEN_TAG') {
                expect(tokens[0].attrs[0].value).toBe(longValue);
            }
        });

        it('handles very long text content', () => {
            const longText = 'hello '.repeat(10000);
            const { tokens } = tokenize(`<div>${longText}</div>`);
            expect(tokens.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('malformed constructs', () => {
        it('handles unterminated comment', () => {
            const { tokens } = tokenize('<!-- unterminated comment');
            expect(tokens).toHaveLength(1);
            expect(tokens[0].type).toBe('COMMENT');
        });

        it('handles unterminated CDATA', () => {
            const { tokens } = tokenize('<![CDATA[unterminated cdata');
            expect(tokens).toHaveLength(1);
            expect(tokens[0].type).toBe('CDATA');
        });

        it('handles unterminated PI', () => {
            const { tokens } = tokenize('<?xml version="1.0"');
            expect(tokens).toHaveLength(1);
            expect(tokens[0].type).toBe('PI');
        });

        it('handles tag name with only numbers', () => {
            const { tokens } = tokenize('<123>');
            expect(tokens.length).toBeGreaterThan(0);
        });

        it('handles multiple equals in attribute', () => {
            const { tokens } = tokenize('<div class=="foo">');
            expect(tokens.length).toBeGreaterThan(0);
        });

        it('handles close tag with attributes (illegal but should not crash)', () => {
            const { tokens } = tokenize('</div class="foo">');
            expect(tokens.length).toBeGreaterThan(0);
        });
    });

    describe('matchCI optimization correctness', () => {
        it('matches DOCTYPE case-insensitively after optimization', () => {
            const variants = [
                '<!DOCTYPE html>',
                '<!doctype html>',
                '<!Doctype html>',
                '<!dOcTyPe html>',
            ];
            for (const variant of variants) {
                const { tokens } = tokenize(variant);
                expect(tokens).toHaveLength(1);
                expect(tokens[0].type).toBe('DOCTYPE');
            }
        });
    });

    describe('unrecognised markup declarations (HXML003)', () => {
        it('emits HXML003 for <!foo> bogus construct', () => {
            const { diagnostics } = tokenize('<!foo>');
            expect(diagnostics.some(d => d.code === 'HXML003')).toBe(true);
        });

        it('emits HXML003 for DTD-like syntax', () => {
            const { diagnostics } = tokenize('<!ELEMENT div (p|br)*>');
            expect(diagnostics.some(d => d.code === 'HXML003')).toBe(true);
        });

        it('consumes to > so subsequent tokens are still produced', () => {
            const { tokens } = tokenize('<!bogus><div>text</div>');
            const divTag = tokens.find(t => t.type === 'OPEN_TAG' && (t as { name: string }).name === 'div');
            expect(divTag).toBeDefined();
        });

        it('does not emit HXML003 for a valid comment', () => {
            const { diagnostics } = tokenize('<!-- valid comment -->');
            expect(diagnostics.some(d => d.code === 'HXML003')).toBe(false);
        });

        it('does not emit HXML003 for valid CDATA', () => {
            const { diagnostics } = tokenize('<![CDATA[content]]>');
            expect(diagnostics.some(d => d.code === 'HXML003')).toBe(false);
        });

        it('does not emit HXML003 for valid DOCTYPE', () => {
            const { diagnostics } = tokenize('<!DOCTYPE html>');
            expect(diagnostics.some(d => d.code === 'HXML003')).toBe(false);
        });
    });
});

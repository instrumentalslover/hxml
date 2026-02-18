/**
 * fuzz.test.ts — Property-based fuzz tests for the HXML pipeline.
 *
 * Validates the core invariant: parse() + validate() + emit() never throw,
 * regardless of input. The parser always produces a complete AST.
 *
 * Uses a seeded PRNG for reproducible results. No extra dependencies.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { validate } from '../src/validator.js';
import { emit } from '../src/emitter.js';

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────

function makePrng(seed: number): () => number {
    let s = seed;
    return function () {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
}

// ── String generators ─────────────────────────────────────────────────────────

const CHARSET_ASCII = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CHARSET_MARKUP = '<>/="\':! \n\t\r';
const CHARSET_HXML_SPECIAL = '<>/="\':!-_ \n\t\r#.;xmlns:data:foo:bar:abc:';
const CHARSET_ALL = CHARSET_ASCII + CHARSET_MARKUP + '&;{}[]|^~`@$%';

function randomString(rand: () => number, charset: string, minLen: number, maxLen: number): string {
    const len = Math.floor(rand() * (maxLen - minLen + 1)) + minLen;
    let s = '';
    for (let i = 0; i < len; i++) {
        s += charset[Math.floor(rand() * charset.length)];
    }
    return s;
}

// ── Pipeline runner ───────────────────────────────────────────────────────────

function runPipeline(source: string): void {
    const { ast, diagnostics: parseDiags } = parse(source);
    // Parser must return structured result
    expect(ast).toBeDefined();
    expect(ast.type).toBe('root');
    expect(Array.isArray(ast.children)).toBe(true);
    expect(Array.isArray(parseDiags)).toBe(true);

    // Validator must not throw
    const valDiags = validate(ast);
    expect(Array.isArray(valDiags)).toBe(true);

    // Emitter must produce a string for all four modes
    for (const mode of ['custom-elements', 'data-attributes', 'passthrough', 'strip'] as const) {
        const result = emit(ast, { mode });
        expect(typeof result.html).toBe('string');
    }
}

// ── Fuzz tests ────────────────────────────────────────────────────────────────

describe('Fuzz: parse → validate → emit never throws', () => {
    it('handles 500 random ASCII strings', () => {
        const rand = makePrng(0xdeadbeef);
        for (let i = 0; i < 500; i++) {
            const input = randomString(rand, CHARSET_ASCII, 0, 120);
            expect(() => runPipeline(input)).not.toThrow();
        }
    });

    it('handles 500 random markup-heavy strings', () => {
        const rand = makePrng(0xcafebabe);
        for (let i = 0; i < 500; i++) {
            const input = randomString(rand, CHARSET_MARKUP, 1, 80);
            expect(() => runPipeline(input)).not.toThrow();
        }
    });

    it('handles 500 random HXML-like strings', () => {
        const rand = makePrng(0x1234abcd);
        for (let i = 0; i < 500; i++) {
            const input = randomString(rand, CHARSET_HXML_SPECIAL, 1, 200);
            expect(() => runPipeline(input)).not.toThrow();
        }
    });

    it('handles 200 random strings from the full character set', () => {
        const rand = makePrng(0xfeedface);
        for (let i = 0; i < 200; i++) {
            const input = randomString(rand, CHARSET_ALL, 0, 300);
            expect(() => runPipeline(input)).not.toThrow();
        }
    });

    // ── Known adversarial patterns ────────────────────────────────────────────

    it('handles empty string', () => {
        expect(() => runPipeline('')).not.toThrow();
    });

    it('handles lone angle brackets', () => {
        for (const s of ['<', '>', '<<', '>>', '<>', '><', '< >', '< />', '</>', '</>']) {
            expect(() => runPipeline(s)).not.toThrow();
        }
    });

    it('handles unclosed tags', () => {
        for (const s of ['<div', '<div ', '<div attr', '<p><div', '<a><b><c>']) {
            expect(() => runPipeline(s)).not.toThrow();
        }
    });

    it('handles deeply nested tags', () => {
        const deep = '<div>'.repeat(200) + 'text' + '</div>'.repeat(200);
        expect(() => runPipeline(deep)).not.toThrow();
    });

    it('handles deeply nested XML tags', () => {
        const open = '<a:x xmlns:a="urn:a">';
        const close = '</a:x>';
        const deep = open.repeat(100) + 'text' + close.repeat(100);
        expect(() => runPipeline(deep)).not.toThrow();
    });

    it('handles mismatched tags', () => {
        for (const s of [
            '</div>',
            '<div></span>',
            '<a:x xmlns:a="urn:a"></b:y>',
            '<div></div></div>',
        ]) {
            expect(() => runPipeline(s)).not.toThrow();
        }
    });

    it('handles CDATA in various positions', () => {
        for (const s of [
            '<![CDATA[]]>',
            '<![CDATA[text]]>',
            '<![CDATA[<<>>]]>',
            '<div><![CDATA[raw]]></div>',
            '<a:x xmlns:a="urn:a"><![CDATA[raw]]></a:x>',
        ]) {
            expect(() => runPipeline(s)).not.toThrow();
        }
    });

    it('handles comments in various positions', () => {
        for (const s of [
            '<!---->',
            '<!-- comment -->',
            '<!-- -- -->',
            '<div><!-- comment --></div>',
            '<!-- comment <div> inside -->',
            '<!-->',
            '<!--->',
        ]) {
            expect(() => runPipeline(s)).not.toThrow();
        }
    });

    it('handles processing instructions', () => {
        for (const s of [
            '<?xml version="1.0"?>',
            '<?foo bar baz?>',
            '<??>',
            '<div><?pi data?></div>',
        ]) {
            expect(() => runPipeline(s)).not.toThrow();
        }
    });

    it('handles attribute edge cases', () => {
        for (const s of [
            '<div attr>',
            '<div attr="">',
            '<div attr=\'val\'>',
            '<div attr=unquoted>',
            '<div "attr">',
            '<div =val>',
            '<div attr="no-close',
            '<div attr=\'no-close',
        ]) {
            expect(() => runPipeline(s)).not.toThrow();
        }
    });

    it('handles namespace edge cases', () => {
        for (const s of [
            '<:x>',
            '<a:>',
            '<a:b:c>',
            '<a:b xmlns:a="">',
            '<a:b xmlns:a="urn:a" xmlns:a="urn:b">',
            '<a:b xmlns:a="urn:a"><c:d xmlns:c="urn:c"/></a:b>',
        ]) {
            expect(() => runPipeline(s)).not.toThrow();
        }
    });

    it('handles DOCTYPE variants', () => {
        for (const s of [
            '<!DOCTYPE html>',
            '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN">',
            '<!DOCTYPE>',
            '<!doctype html>',
        ]) {
            expect(() => runPipeline(s)).not.toThrow();
        }
    });

    it('handles long attribute values', () => {
        const longAttr = '<div class="' + 'x'.repeat(10000) + '">text</div>';
        expect(() => runPipeline(longAttr)).not.toThrow();
    });

    it('handles raw text elements with tricky content', () => {
        for (const s of [
            '<script></script>',
            '<script>var a = 1 < 2 && 3 > 0;</script>',
            '<script>/* </script> */</script>',
            '<style>body { color: red; }</style>',
            '<textarea>Some <text> here</textarea>',
        ]) {
            expect(() => runPipeline(s)).not.toThrow();
        }
    });

    it('handles null bytes and control characters', () => {
        for (const s of [
            '\x00',
            '\x00<div>\x00</div>\x00',
            '\x01\x02\x03',
            '\r\n\t',
            '<div>\x00</div>',
        ]) {
            expect(() => runPipeline(s)).not.toThrow();
        }
    });

    it('handles source map generation without throw', () => {
        const rand = makePrng(0xabcd1234);
        for (let i = 0; i < 100; i++) {
            const input = randomString(rand, CHARSET_HXML_SPECIAL, 1, 150);
            expect(() => {
                const { ast } = parse(input);
                emit(ast, { mode: 'custom-elements', sourceMap: true });
            }).not.toThrow();
        }
    });
});

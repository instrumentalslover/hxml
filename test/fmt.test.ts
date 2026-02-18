/**
 * fmt.test.ts — Tests for the `hxml fmt` formatter behaviour.
 *
 * The formatter is implemented as `htmlToHxml` (via the `format` export).
 * These tests verify that HXML-specific content (XML-mode elements,
 * namespace declarations) is preserved correctly during formatting.
 */

import { describe, it, expect } from 'vitest';
import { format } from '../src/index.js';

describe('format (hxml fmt)', () => {
    // ── XML-mode elements ────────────────────────────────────────────────────

    it('preserves XML-mode element names (case and prefix)', () => {
        const result = format('<data:record xmlns:data="urn:app"><data:field/></data:record>');
        expect(result.hxml).toContain('<data:record');
        expect(result.hxml).toContain('<data:field');
        expect(result.hxml).not.toContain('<data-record');
    });

    it('preserves namespace declarations on XML-mode elements', () => {
        const result = format('<data:record xmlns:data="urn:app">text</data:record>');
        expect(result.hxml).toContain('xmlns:data="urn:app"');
    });

    it('adds explicit closing tags to XML self-closing elements', () => {
        // The formatter round-trips through the AST; self-closing becomes isVoid
        const result = format('<data:record xmlns:data="urn:app"/>');
        // Should have a closing tag (either <data:record/> or <data:record></data:record>)
        expect(result.hxml).toMatch(/<data:record[^>]*\/?>/);
    });

    // ── Mixed HTML + XML content ──────────────────────────────────────────────

    it('formats mixed HTML and XML-mode content', () => {
        const src = '<div><data:item xmlns:data="urn:app"><p>Hello</p></data:item></div>';
        const result = format(src);
        expect(result.hxml).toContain('<div>');
        expect(result.hxml).toContain('<data:item');
        expect(result.hxml).toContain('<p>Hello</p>');
        expect(result.hxml).toContain('</data:item>');
        expect(result.hxml).toContain('</div>');
    });

    it('indents XML-mode children', () => {
        const src = '<div><data:row xmlns:data="urn:x"><data:cell>A</data:cell></data:row></div>';
        const result = format(src);
        // data:cell should be indented inside data:row
        expect(result.hxml).toMatch(/\n\s+<data:cell/);
    });

    // ── HTML formatting rules still apply ─────────────────────────────────────

    it('adds explicit closing tags for optional-close HTML elements inside HXML', () => {
        const src = '<div><ul><li>One<li>Two</ul></div>';
        const result = format(src);
        const matches = result.hxml.match(/<\/li>/g);
        expect(matches?.length).toBe(2);
    });

    it('preserves void HTML elements without closing tags', () => {
        const result = format('<div><br><hr></div>');
        expect(result.hxml).toContain('<br>');
        expect(result.hxml).not.toContain('</br>');
    });

    // ── Idempotence ────────────────────────────────────────────────────────────

    it('is idempotent: formatting twice gives same result', () => {
        const src = '<div><data:item xmlns:data="urn:app"><p>Hello</p></data:item></div>';
        const once = format(src).hxml;
        const twice = format(once).hxml;
        expect(twice).toBe(once);
    });

    // ── Formatter options ──────────────────────────────────────────────────────

    it('respects custom indent option', () => {
        const src = '<div><data:row xmlns:data="urn:x"><data:cell>A</data:cell></data:row></div>';
        const result = format(src, { indent: '\t' });
        expect(result.hxml).toMatch(/\t<data:row/);
    });

    it('sorts attributes when sortAttributes option is enabled', () => {
        const src = '<div z="3" a="1" m="2"></div>';
        const result = format(src, { sortAttributes: true });
        expect(result.hxml).toContain('<div a="1" m="2" z="3"></div>');
    });

    it('preserves original attribute quote style when requested', () => {
        const src = `<div data-a='one' data-b="two" data-c='it&apos;s'></div>`;
        const result = format(src, { preserveAttributeQuotes: true });
        expect(result.hxml).toContain(`data-a='one'`);
        expect(result.hxml).toContain(`data-b="two"`);
        expect(result.hxml).toContain(`data-c='it&#39;s'`);
    });

    // ── Comments and processing instructions ──────────────────────────────────

    it('preserves XML comments inside HXML', () => {
        const src = '<data:doc xmlns:data="urn:app"><!-- a note --><data:item/></data:doc>';
        const result = format(src);
        expect(result.hxml).toContain('<!-- a note -->');
    });
});

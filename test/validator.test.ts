import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { validate } from '../src/validator.js';

describe('Validator', () => {
  /** Parse then validate shorthand. */
  function check(source: string) {
    const { ast } = parse(source);
    return validate(ast);
  }

  describe('namespace validation', () => {
    it('reports undeclared namespace prefix', () => {
      const diags = check('<data:record id="1">text</data:record>');
      expect(diags.some(d => d.code === 'HXML201')).toBe(true);
    });

    it('accepts declared namespace prefix', () => {
      const diags = check('<data:record xmlns:data="urn:app">text</data:record>');
      const nsErrors = diags.filter(d => d.code === 'HXML201');
      expect(nsErrors).toHaveLength(0);
    });

    it('accepts predeclared xml: prefix', () => {
      const diags = check('<root:el xmlns:root="urn:r" xml:lang="en">text</root:el>');
      const nsErrors = diags.filter(d => d.code === 'HXML204');
      expect(nsErrors).toHaveLength(0);
    });

    it('reports duplicate prefixed namespace declaration on same element', () => {
      const diags = check('<data:record xmlns:data="urn:a" xmlns:data="urn:b"></data:record>');
      expect(diags.some(d => d.code === 'HXML205')).toBe(true);
    });

    it('reports duplicate default namespace declaration on same element', () => {
      const diags = check('<data:record xmlns:data="urn:data" xmlns="urn:a" xmlns="urn:b"></data:record>');
      expect(diags.some(d => d.code === 'HXML205')).toBe(true);
    });
  });

  describe('attribute validation', () => {
    it('reports duplicate attributes on XML elements', () => {
      const diags = check(
        '<cfg:setting xmlns:cfg="urn:cfg" key="a" key="b">val</cfg:setting>'
      );
      expect(diags.some(d => d.code === 'HXML202')).toBe(true);
    });

    it('does not report duplicate attributes on HTML elements', () => {
      const diags = check('<div class="a" class="b">text</div>');
      const dupErrors = diags.filter(d => d.code === 'HXML202');
      expect(dupErrors).toHaveLength(0);
    });

    it('reports boolean attributes in XML mode', () => {
      const diags = check(
        '<ui:input xmlns:ui="urn:ui" disabled>text</ui:input>'
      );
      expect(diags.some(d => d.code === 'HXML203')).toBe(true);
    });
  });

  describe('CDATA validation', () => {
    it('warns about CDATA in HTML mode', () => {
      const diags = check('<div><![CDATA[text]]></div>');
      expect(diags.some(d => d.code === 'HXML301')).toBe(true);
    });

    it('does not warn about CDATA in XML mode', () => {
      const diags = check(
        '<data:el xmlns:data="urn:app"><![CDATA[text]]></data:el>'
      );
      const cdataWarnings = diags.filter(d => d.code === 'HXML301');
      expect(cdataWarnings).toHaveLength(0);
    });
  });

  describe('DOCTYPE validation', () => {
    it('warns about legacy DOCTYPE', () => {
      const diags = check('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0//EN">');
      expect(diags.some(d => d.code === 'HXML302')).toBe(true);
    });

    it('does not warn about standard DOCTYPE', () => {
      const diags = check('<!DOCTYPE html>');
      const doctypeWarnings = diags.filter(d => d.code === 'HXML302');
      expect(doctypeWarnings).toHaveLength(0);
    });
  });

  describe('prefixed attributes', () => {
    it('reports undeclared prefix on attributes', () => {
      const diags = check(
        '<div foo:bar="test">text</div>'
      );
      expect(diags.some(d => d.code === 'HXML204')).toBe(true);
    });

    it('accepts declared prefix on attributes', () => {
      const diags = check(
        '<div xmlns:foo="urn:foo" foo:bar="test">text</div>'
      );
      const nsErrors = diags.filter(d => d.code === 'HXML204');
      expect(nsErrors).toHaveLength(0);
    });
  });

  describe('namespace undeclaration (xmlns:foo="")', () => {
    it('treats xmlns:prefix="" as undeclaration — inner usage errors', () => {
      // ancestor declares data, child undeclares it, grandchild uses it → error
      const diags = check(
        '<outer xmlns:data="urn:app">' +
          '<inner xmlns:data="">' +
            '<data:record/>' +
          '</inner>' +
        '</outer>',
      );
      expect(diags.some(d => d.code === 'HXML201')).toBe(true);
    });

    it('prefix is back in scope after the undeclaring element closes', () => {
      // data is declared on outer, undeclared on inner (sibling), then used
      // on data:record which is a sibling of inner — data should be in scope
      const diags = check(
        '<outer xmlns:data="urn:app">' +
          '<inner xmlns:data=""></inner>' +
          '<data:record/>' +
        '</outer>',
      );
      const nsErrors = diags.filter(d => d.code === 'HXML201');
      expect(nsErrors).toHaveLength(0);
    });

    it('using undeclared prefix on the same element as undeclaration is an error', () => {
      // xmlns:data="" on the same element as data: usage — cannot use and undeclare simultaneously
      const diags = check('<data:record xmlns:data=""/>');
      expect(diags.some(d => d.code === 'HXML201')).toBe(true);
    });

    it('undeclared prefix on attribute inside scope of undeclaration errors', () => {
      const diags = check(
        '<outer xmlns:data="urn:app">' +
          '<inner xmlns:data="">' +
            '<div data:attr="x">text</div>' +
          '</inner>' +
        '</outer>',
      );
      expect(diags.some(d => d.code === 'HXML204')).toBe(true);
    });
  });

  describe('xml:id uniqueness', () => {
    it('reports duplicate xml:id values in XML regions', () => {
      const { ast } = parse(
        '<data:root xmlns:data="urn:app">' +
          '<data:item xml:id="dup"/>' +
          '<data:item xml:id="dup"/>' +
        '</data:root>'
      );
      const diags = validate(ast);
      expect(diags.some(d => d.code === 'HXML206')).toBe(true);
    });

    it('can disable xml:id uniqueness checks', () => {
      const { ast } = parse(
        '<data:root xmlns:data="urn:app">' +
          '<data:item xml:id="dup"/>' +
          '<data:item xml:id="dup"/>' +
        '</data:root>'
      );
      const diags = validate(ast, { enforceXmlIdUniqueness: false });
      expect(diags.some(d => d.code === 'HXML206')).toBe(false);
    });
  });

  describe('schema validation', () => {
    it('reports schema violations for missing required child/attr and disallowed child', () => {
      const { ast } = parse(
        '<data:record xmlns:data="urn:app">' +
          '<data:extra/>' +
        '</data:record>'
      );
      const diags = validate(ast, {
        schema: {
          'data:record': {
            requiredAttributes: ['id'],
            requiredChildren: ['data:name'],
            allowedChildren: ['data:name'],
          },
        },
      });

      expect(diags.filter(d => d.code === 'HXML207').length).toBeGreaterThanOrEqual(3);
    });
  });
});

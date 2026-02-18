import { describe, it, expect } from 'vitest';
import { Tokenizer } from '../src/tokenizer.js';

describe('Tokenizer', () => {
  function tokenize(src: string) {
    return new Tokenizer(src).tokenize();
  }

  describe('text tokens', () => {
    it('emits a text token for plain text', () => {
      const tokens = tokenize('Hello world');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('TEXT');
      if (tokens[0].type === 'TEXT') {
        expect(tokens[0].value).toBe('Hello world');
      }
    });

    it('handles empty input', () => {
      const tokens = tokenize('');
      expect(tokens).toHaveLength(0);
    });
  });

  describe('open tags', () => {
    it('tokenizes a simple open tag', () => {
      const tokens = tokenize('<div>');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('OPEN_TAG');
      if (tokens[0].type === 'OPEN_TAG') {
        expect(tokens[0].name).toBe('div');
        expect(tokens[0].selfClosing).toBe(false);
        expect(tokens[0].attrs).toHaveLength(0);
      }
    });

    it('tokenizes attributes with double quotes', () => {
      const tokens = tokenize('<div class="main" id="content">');
      expect(tokens).toHaveLength(1);
      if (tokens[0].type === 'OPEN_TAG') {
        expect(tokens[0].attrs).toHaveLength(2);
        expect(tokens[0].attrs[0].name).toBe('class');
        expect(tokens[0].attrs[0].value).toBe('main');
        expect(tokens[0].attrs[1].name).toBe('id');
        expect(tokens[0].attrs[1].value).toBe('content');
      }
    });

    it('tokenizes attributes with single quotes', () => {
      const tokens = tokenize("<div class='main'>");
      expect(tokens).toHaveLength(1);
      if (tokens[0].type === 'OPEN_TAG') {
        expect(tokens[0].attrs[0].value).toBe('main');
      }
    });

    it('tokenizes unquoted attribute values', () => {
      const tokens = tokenize('<div class=main>');
      expect(tokens).toHaveLength(1);
      if (tokens[0].type === 'OPEN_TAG') {
        expect(tokens[0].attrs[0].value).toBe('main');
      }
    });

    it('tokenizes boolean attributes', () => {
      const tokens = tokenize('<input disabled checked>');
      expect(tokens).toHaveLength(1);
      if (tokens[0].type === 'OPEN_TAG') {
        expect(tokens[0].attrs).toHaveLength(2);
        expect(tokens[0].attrs[0].name).toBe('disabled');
        expect(tokens[0].attrs[0].value).toBeNull();
        expect(tokens[0].attrs[1].name).toBe('checked');
        expect(tokens[0].attrs[1].value).toBeNull();
      }
    });

    it('tokenizes self-closing tags', () => {
      const tokens = tokenize('<br/>');
      expect(tokens).toHaveLength(1);
      if (tokens[0].type === 'OPEN_TAG') {
        expect(tokens[0].name).toBe('br');
        expect(tokens[0].selfClosing).toBe(true);
      }
    });

    it('tokenizes self-closing with space', () => {
      const tokens = tokenize('<br />');
      expect(tokens).toHaveLength(1);
      if (tokens[0].type === 'OPEN_TAG') {
        expect(tokens[0].name).toBe('br');
        expect(tokens[0].selfClosing).toBe(true);
      }
    });

    it('tokenizes namespaced tags', () => {
      const tokens = tokenize('<data:record xmlns:data="urn:app" id="1">');
      expect(tokens).toHaveLength(1);
      if (tokens[0].type === 'OPEN_TAG') {
        expect(tokens[0].name).toBe('data:record');
        expect(tokens[0].attrs).toHaveLength(2);
      }
    });
  });

  describe('close tags', () => {
    it('tokenizes a close tag', () => {
      const tokens = tokenize('</div>');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('CLOSE_TAG');
      if (tokens[0].type === 'CLOSE_TAG') {
        expect(tokens[0].name).toBe('div');
      }
    });

    it('tokenizes a namespaced close tag', () => {
      const tokens = tokenize('</data:record>');
      expect(tokens).toHaveLength(1);
      if (tokens[0].type === 'CLOSE_TAG') {
        expect(tokens[0].name).toBe('data:record');
      }
    });
  });

  describe('comments', () => {
    it('tokenizes a comment', () => {
      const tokens = tokenize('<!-- hello world -->');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('COMMENT');
      if (tokens[0].type === 'COMMENT') {
        expect(tokens[0].value).toBe(' hello world ');
      }
    });
  });

  describe('CDATA', () => {
    it('tokenizes CDATA sections', () => {
      const tokens = tokenize('<![CDATA[some <raw> & text]]>');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('CDATA');
      if (tokens[0].type === 'CDATA') {
        expect(tokens[0].value).toBe('some <raw> & text');
      }
    });
  });

  describe('DOCTYPE', () => {
    it('tokenizes HTML5 doctype', () => {
      const tokens = tokenize('<!DOCTYPE html>');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('DOCTYPE');
      if (tokens[0].type === 'DOCTYPE') {
        expect(tokens[0].value).toBe('html');
      }
    });

    it('tokenizes case-insensitive doctype', () => {
      const tokens = tokenize('<!doctype html>');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('DOCTYPE');
    });
  });

  describe('processing instructions', () => {
    it('tokenizes XML declaration', () => {
      const tokens = tokenize('<?xml version="1.0"?>');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('PI');
      if (tokens[0].type === 'PI') {
        expect(tokens[0].target).toBe('xml');
        expect(tokens[0].data).toBe('version="1.0"');
      }
    });

    it('tokenizes custom PI', () => {
      const tokens = tokenize('<?myapp render-mode="fancy"?>');
      expect(tokens).toHaveLength(1);
      if (tokens[0].type === 'PI') {
        expect(tokens[0].target).toBe('myapp');
        expect(tokens[0].data).toBe('render-mode="fancy"');
      }
    });
  });

  describe('raw text elements', () => {
    it('handles script content as raw text', () => {
      const tokens = tokenize('<script>var x = a < b;</script>');
      // OPEN_TAG(script) + TEXT(raw) + CLOSE_TAG(script)
      expect(tokens.length).toBeGreaterThanOrEqual(2);
      const openTag = tokens.find(t => t.type === 'OPEN_TAG');
      const text = tokens.find(t => t.type === 'TEXT');
      expect(openTag).toBeDefined();
      if (openTag?.type === 'OPEN_TAG') {
        expect(openTag.name).toBe('script');
      }
      expect(text).toBeDefined();
      if (text?.type === 'TEXT') {
        expect(text.value).toBe('var x = a < b;');
      }
    });

    it('handles style content as raw text', () => {
      const tokens = tokenize('<style>.foo > .bar { color: red; }</style>');
      const text = tokens.find(t => t.type === 'TEXT');
      expect(text).toBeDefined();
      if (text?.type === 'TEXT') {
        expect(text.value).toBe('.foo > .bar { color: red; }');
      }
    });
  });

  describe('position tracking', () => {
    it('tracks line and column for tokens', () => {
      const tokens = tokenize('hello\n<div>');
      expect(tokens).toHaveLength(2);
      // First token: text "hello\n"
      expect(tokens[0].loc.start.line).toBe(1);
      expect(tokens[0].loc.start.col).toBe(0);
      // Second token: <div> at line 2
      expect(tokens[1].loc.start.line).toBe(2);
      expect(tokens[1].loc.start.col).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles bare < as text', () => {
      const tokens = tokenize('a < b');
      // The < is followed by space, so readWhile for tag name returns empty → TEXT '<'
      // Then 'b' is another TEXT (or combined)
      const allText = tokens.filter(t => t.type === 'TEXT').map(t => {
        if (t.type === 'TEXT') return t.value;
        return '';
      }).join('');
      expect(allText).toContain('<');
    });

    it('handles multiple tokens in sequence', () => {
      const tokens = tokenize('<div>hello</div>');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].type).toBe('OPEN_TAG');
      expect(tokens[1].type).toBe('TEXT');
      expect(tokens[2].type).toBe('CLOSE_TAG');
    });
  });

  describe('streaming API', () => {
    it('tokenizeStream yields the same sequence as tokenize', () => {
      const src = '<div><p>Hello</p><p>World</p></div>';
      const tokenizerA = new Tokenizer(src);
      const tokenizerB = new Tokenizer(src);

      const arrayTokens = tokenizerA.tokenize();
      const streamTokens = [...tokenizerB.tokenizeStream()];

      expect(streamTokens).toEqual(arrayTokens);
    });

    it('supports incremental consumption via iterator.next()', () => {
      const tokenizer = new Tokenizer('<div>hello</div>');
      const stream = tokenizer.tokenizeStream();

      const first = stream.next();
      const second = stream.next();
      const third = stream.next();
      const fourth = stream.next();

      expect(first.done).toBe(false);
      expect(first.value?.type).toBe('OPEN_TAG');
      expect(second.done).toBe(false);
      expect(second.value?.type).toBe('TEXT');
      expect(third.done).toBe(false);
      expect(third.value?.type).toBe('CLOSE_TAG');
      expect(fourth.done).toBe(true);
    });
  });
});

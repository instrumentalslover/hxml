/**
 * tokenizer.ts — Character stream → token stream for HXML.
 *
 * A hand-written state machine that reads the source string character by
 * character and emits a stream of tokens.  Tracks line, column, and byte
 * offset for every token via SourceTracker.
 *
 * The tokenizer is intentionally "dumb" — it does not know about HTML mode
 * vs XML mode and does not do tree construction.  The one exception is
 * raw text elements (script, style, textarea, title): after emitting an
 * OPEN_TAG for one of these, the tokenizer switches to raw-text mode and
 * consumes everything as a single TEXT token until the matching close tag.
 */

import { SourceTracker, type SourceRange } from './utils/source-map.js';
import { HTML_RAW_TEXT_ELEMENTS } from './constants.js';
import type { Diagnostic } from './utils/errors.js';
import { makeError } from './utils/errors.js';
import type { Token, TokenAttribute, OpenTagToken } from './tokenizer-internal/types.js';
export type {
    Token,
    TokenAttribute,
    TextToken,
    OpenTagToken,
    CloseTagToken,
    CommentToken,
    CDataToken,
    PIToken,
    DoctypeToken,
} from './tokenizer-internal/types.js';

// ── Tokenizer ────────────────────────────────────────────────────────────────

export class Tokenizer {
    private pos = 0;
    private readonly src: string;
    private readonly tracker: SourceTracker;
    readonly diagnostics: Diagnostic[] = [];

    constructor(source: string) {
        this.src = source;
        this.tracker = new SourceTracker(source);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private eof(): boolean {
        return this.pos >= this.src.length;
    }

    private peek(n = 0): string {
        return this.src[this.pos + n] ?? '';
    }

    private consume(n = 1): string {
        const s = this.src.slice(this.pos, this.pos + n);
        this.pos += n;
        return s;
    }

    private match(str: string): boolean {
        return this.src.startsWith(str, this.pos);
    }

    private matchCI(str: string): boolean {
        if (this.pos + str.length > this.src.length) return false;
        for (let i = 0; i < str.length; i++) {
            const a = this.src.charCodeAt(this.pos + i);
            const b = str.charCodeAt(i);
            // Fast case-insensitive compare: if not equal, try flipping bit 5
            // (works for ASCII letters where 'a' ^ 'A' === 32)
            if (a === b) continue;
            // Check if both are ASCII letters and differ only by case
            const aLower = a | 0x20;
            const bLower = b | 0x20;
            if (aLower !== bLower || aLower < 0x61 || aLower > 0x7A) return false;
        }
        return true;
    }

    private skipWS(): void {
        while (!this.eof()) {
            const c = this.src.charCodeAt(this.pos);
            // space, tab, LF, CR, FF
            if (c !== 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D && c !== 0x0C) break;
            this.pos++;
        }
    }

    private readUntil(terminator: string): string {
        const i = this.src.indexOf(terminator, this.pos);
        if (i < 0) {
            const s = this.src.slice(this.pos);
            this.pos = this.src.length;
            return s;
        }
        const s = this.src.slice(this.pos, i);
        this.pos = i + terminator.length;
        return s;
    }

    private readWhile(fn: (ch: string) => boolean): string {
        const start = this.pos;
        while (!this.eof() && fn(this.src[this.pos])) {
            this.pos++;
        }
        return this.src.slice(start, this.pos);
    }

    private readTextUntilLt(): string {
        const start = this.pos;
        const idx = this.src.indexOf('<', this.pos);
        if (idx < 0) {
            this.pos = this.src.length;
            return this.src.slice(start);
        }
        this.pos = idx;
        return this.src.slice(start, idx);
    }

    private readTagName(): string {
        const start = this.pos;
        while (!this.eof()) {
            const c = this.src.charCodeAt(this.pos);
            if (c === 0x20 || c === 0x09 || c === 0x0A || c === 0x0D || c === 0x3E || c === 0x2F || c === 0x3C) break;
            this.pos++;
        }
        return this.src.slice(start, this.pos);
    }

    private readCloseTagName(): string {
        const start = this.pos;
        while (!this.eof()) {
            const c = this.src.charCodeAt(this.pos);
            if (c === 0x20 || c === 0x09 || c === 0x0A || c === 0x0D || c === 0x3E) break;
            this.pos++;
        }
        return this.src.slice(start, this.pos);
    }

    private readAttrName(): string {
        const start = this.pos;
        while (!this.eof()) {
            const c = this.src.charCodeAt(this.pos);
            if (
                c === 0x20 || c === 0x09 || c === 0x0A || c === 0x0D || // whitespace
                c === 0x3D || c === 0x3E || c === 0x2F || // = > /
                c === 0x22 || c === 0x27 // quotes
            ) {
                break;
            }
            this.pos++;
        }
        return this.src.slice(start, this.pos);
    }

    private readUnquotedAttrValue(): string {
        const start = this.pos;
        while (!this.eof()) {
            const c = this.src.charCodeAt(this.pos);
            if (c === 0x20 || c === 0x09 || c === 0x0A || c === 0x0D || c === 0x3E || c === 0x2F) break;
            this.pos++;
        }
        return this.src.slice(start, this.pos);
    }

    // ── Attribute parsing ────────────────────────────────────────────────────

    private readAttrValue(): string {
        const q = this.peek();
        if (q === '"' || q === "'") {
            const quoteStart = this.pos;
            this.pos++; // opening quote
            // Read until closing quote, but stop at newlines to avoid
            // consuming the entire document on an unterminated attribute.
            const valStart = this.pos;
            while (!this.eof()) {
                const ch = this.src[this.pos];
                if (ch === q) {
                    const val = this.src.slice(valStart, this.pos);
                    this.pos++; // closing quote
                    return val;
                }
                if (ch === '\n' || ch === '\r') {
                    // Unterminated quoted attribute — stop here
                    const val = this.src.slice(valStart, this.pos);
                    this.diagnostics.push(makeError(
                        'HXML002',
                        `Unterminated attribute value (missing closing ${q})`,
                        this.tracker.range(quoteStart, this.pos),
                        'Add a closing quote to the attribute value',
                    ));
                    return val;
                }
                this.pos++;
            }
            // EOF without closing quote
            const val = this.src.slice(valStart, this.pos);
            this.diagnostics.push(makeError(
                'HXML002',
                `Unterminated attribute value (missing closing ${q})`,
                this.tracker.range(quoteStart, this.pos),
                'Add a closing quote to the attribute value',
            ));
            return val;
        }
        // Unquoted attribute value
        return this.readUnquotedAttrValue();
    }

    private readAttrs(): TokenAttribute[] {
        const attrs: TokenAttribute[] = [];
        while (!this.eof()) {
            this.skipWS();
            if (this.peek() === '>' || this.match('/>')) break;

            const attrStart = this.pos;
            const name = this.readAttrName();
            if (!name) break;

            let value: string | null = null;
            this.skipWS();
            if (this.peek() === '=') {
                this.consume(); // =
                this.skipWS();
                value = this.readAttrValue();
            }
            const attrEnd = this.pos;

            attrs.push({
                name,
                value,
                loc: this.tracker.range(attrStart, attrEnd),
            });
        }
        return attrs;
    }

    // ── Raw text mode ────────────────────────────────────────────────────────

    /**
     * After an open tag for a raw text element (script, style, textarea, title),
     * consume everything as a single TEXT token until the matching close tag.
     */
    private readRawText(tagName: string): Token | null {
        const start = this.pos;
        const closeTag = `</${tagName.toLowerCase()}`;

        // Scan for the close tag using case-insensitive matching without
        // allocating a full lowercased copy of the source.
        while (this.pos < this.src.length) {
            // Find the next '<' character as a quick scan
            const ltIdx = this.src.indexOf('<', this.pos);
            if (ltIdx < 0) break;

            // Check if this '<' begins our close tag (case-insensitive)
            this.pos = ltIdx;
            if (this.pos + closeTag.length <= this.src.length && this.matchCI(closeTag)) {
                // Check that what follows the close tag name is whitespace or >
                const afterTag = this.src[this.pos + closeTag.length];
                if (afterTag === '>' || afterTag === ' ' || afterTag === '\t' ||
                    afterTag === '\n' || afterTag === '\r' || afterTag === undefined) {
                    const text = this.src.slice(start, ltIdx);
                    this.pos = ltIdx; // position at the start of the close tag
                    if (text) {
                        return {
                            type: 'TEXT',
                            value: text,
                            loc: this.tracker.range(start, ltIdx),
                        };
                    }
                    return null;
                }
            }

            // False positive — skip past this '<'
            this.pos = ltIdx + 1;
        }

        // No matching close tag — consume everything
        this.pos = this.src.length;
        const text = this.src.slice(start);
        if (text) {
            return {
                type: 'TEXT',
                value: text,
                loc: this.tracker.range(start, this.pos),
            };
        }
        return null;
    }

    // Pending token for raw-text-element content
    private _pending: Token | null = null;

    // ── Main tokenization ───────────────────────────────────────────────────

    nextToken(): Token | null {
        if (this._pending) {
            const t = this._pending;
            this._pending = null;
            return t;
        }
        if (this.eof()) return null;

        const start = this.pos;

        // ── Comment: <!-- ... -->
        if (this.match('<!--')) {
            this.consume(4);
            const value = this.readUntil('-->');
            return {
                type: 'COMMENT',
                value,
                loc: this.tracker.range(start, this.pos),
            };
        }

        // ── CDATA: <![CDATA[ ... ]]>
        if (this.match('<![CDATA[')) {
            this.consume(9);
            const value = this.readUntil(']]>');
            return {
                type: 'CDATA',
                value,
                loc: this.tracker.range(start, this.pos),
            };
        }

        // ── DOCTYPE: <!DOCTYPE ...>
        if (this.match('<!') && this.matchCI('<!DOCTYPE')) {
            this.consume(9); // <!DOCTYPE
            this.skipWS();
            const value = this.readUntil('>').trim();
            return {
                type: 'DOCTYPE',
                value,
                loc: this.tracker.range(start, this.pos),
            };
        }

        // ── Unknown markup declaration: <!something that isn't DOCTYPE, --, or [CDATA[
        // In HTML5 this is a "bogus comment". Consume to '>' and emit a diagnostic.
        if (this.match('<!')) {
            this.consume(2); // <!
            const body = this.readUntil('>');
            this.diagnostics.push(makeError(
                'HXML003',
                `Unrecognised markup declaration: "<!${body.trimEnd()}"`,
                this.tracker.range(start, this.pos),
                'Valid markup declarations are <!--comment-->, <![CDATA[...]]>, or <!DOCTYPE ...>',
            ));
            // Return an empty text token — the bogus content is discarded.
            return {
                type: 'TEXT',
                value: '',
                loc: this.tracker.range(start, this.pos),
            };
        }

        // ── Processing Instruction: <? ... ?>
        if (this.match('<?')) {
            this.consume(2);
            const raw = this.readUntil('?>').trim();
            // Split target from data
            const spaceIdx = raw.search(/\s/);
            const target = spaceIdx < 0 ? raw : raw.slice(0, spaceIdx);
            const data = spaceIdx < 0 ? '' : raw.slice(spaceIdx).trim();
            return {
                type: 'PI',
                target,
                data,
                loc: this.tracker.range(start, this.pos),
            };
        }

        // ── Tags
        if (this.peek() === '<') {
            this.consume(); // <

            // ── Close tag: </name>
            if (this.peek() === '/') {
                this.consume(); // /
                const name = this.readCloseTagName();
                this.skipWS();
                if (this.peek() === '>') this.consume();
                return {
                    type: 'CLOSE_TAG',
                    name,
                    loc: this.tracker.range(start, this.pos),
                };
            }

            // ── Open tag: <name attrs... > or <name attrs... />
            const name = this.readTagName();
            if (!name) {
                // Bare `<` that's not a tag — emit as text
                return {
                    type: 'TEXT',
                    value: '<',
                    loc: this.tracker.range(start, this.pos),
                };
            }

            const attrs = this.readAttrs();
            this.skipWS();
            const selfClosing = this.match('/>');
            if (selfClosing) {
                this.consume(2);
            } else if (this.peek() === '>') {
                this.consume();
            }

            const token: OpenTagToken = {
                type: 'OPEN_TAG',
                name,
                attrs,
                selfClosing,
                loc: this.tracker.range(start, this.pos),
            };

            // If this is a raw text element (HTML, no prefix), enter raw text mode
            const lo = name.toLowerCase();
            if (!name.includes(':') && HTML_RAW_TEXT_ELEMENTS.has(lo)) {
                // We return the open tag token now.  The *next* call to nextToken()
                // should return raw text.  We handle this by peeking ahead.
                // Actually, we emit the open tag and queue the raw text.
                // Simpler: stash raw-text token if available.
                const rawToken = this.readRawText(name);
                if (rawToken) {
                    this._pending = rawToken;
                }
            }

            return token;
        }

        // ── Text content
        const text = this.readTextUntilLt();
        return {
            type: 'TEXT',
            value: text,
            loc: this.tracker.range(start, this.pos),
        };
    }

    /** Tokenize the entire source into an array of tokens. */
    tokenize(): Token[] {
        const tokens: Token[] = [];
        let tok: Token | null;
        while ((tok = this.nextToken()) !== null) {
            tokens.push(tok);
        }
        return tokens;
    }

    /**
     * Incrementally tokenize the source as a generator.
     *
     * This avoids materializing a full token array up-front and is useful
     * for large inputs or streaming-style consumers.
     */
    *tokenizeStream(): Generator<Token, void, undefined> {
        let tok: Token | null;
        while ((tok = this.nextToken()) !== null) {
            yield tok;
        }
    }
}

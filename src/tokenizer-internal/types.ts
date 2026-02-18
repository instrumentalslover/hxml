import type { SourceRange } from '../utils/source-map.js';

export interface TokenAttribute {
    name: string;
    value: string | null;
    loc: SourceRange;
}

export interface TextToken {
    type: 'TEXT';
    value: string;
    loc: SourceRange;
}

export interface OpenTagToken {
    type: 'OPEN_TAG';
    name: string;
    attrs: TokenAttribute[];
    selfClosing: boolean;
    loc: SourceRange;
}

export interface CloseTagToken {
    type: 'CLOSE_TAG';
    name: string;
    loc: SourceRange;
}

export interface CommentToken {
    type: 'COMMENT';
    value: string;
    loc: SourceRange;
}

export interface CDataToken {
    type: 'CDATA';
    value: string;
    loc: SourceRange;
}

export interface PIToken {
    type: 'PI';
    target: string;
    data: string;
    loc: SourceRange;
}

export interface DoctypeToken {
    type: 'DOCTYPE';
    value: string;
    loc: SourceRange;
}

export type Token =
    | TextToken
    | OpenTagToken
    | CloseTagToken
    | CommentToken
    | CDataToken
    | PIToken
    | DoctypeToken;

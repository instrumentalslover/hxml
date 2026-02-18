/**
 * index.ts — Public API for the HXML parser and compiler.
 *
 * Exports the main functions: parse, emit, validate, compile.
 */

import { parse as parseImpl, type ParseResult, type ParseOptions } from './parser.js';
import {
  emit as emitImpl,
  emitToStream as emitToStreamImpl,
  type EmitResult,
  type EmitStreamResult,
  type EmitOptions,
  type EmitMode,
} from './emitter.js';
import {
  validate as validateImpl,
  type ValidateOptions,
  type XmlRegionSchema,
} from './validator.js';
import { Tokenizer, type Token, type TokenAttribute } from './tokenizer.js';
import { htmlToHxml as htmlToHxmlImpl, type ConvertOptions, type ConvertResult } from './converter.js';
import { walk, transform, type WalkVisitor, type WalkContext, type TransformVisitor, type TransformContext } from './utils/ast-tools.js';
import type { RootNode, HxmlNode, ElementNode, TextNode, CommentNode, CDataNode, ProcessingInstNode, DoctypeNode, ParsingMode, Attribute } from './ast.js';
import type { Diagnostic, DiagnosticSeverity } from './utils/errors.js';
import type { SourcePosition, SourceRange } from './utils/source-map.js';

// ── Re-exports ───────────────────────────────────────────────────────────────

export type {
  // AST
  RootNode, HxmlNode, ElementNode, TextNode, CommentNode, CDataNode,
  ProcessingInstNode, DoctypeNode, ParsingMode, Attribute,
  // Diagnostics
  Diagnostic, DiagnosticSeverity,
  // Source locations
  SourcePosition, SourceRange,
  // Options & results
  ParseResult, ParseOptions,
  EmitResult, EmitOptions, EmitMode,
  EmitStreamResult,
  ConvertOptions, ConvertResult,
  ValidateOptions, XmlRegionSchema,
  Token, TokenAttribute,
  WalkVisitor, WalkContext,
  TransformVisitor, TransformContext,
};

export { Tokenizer, walk, transform };

// ── Main API ─────────────────────────────────────────────────────────────────

/**
 * Parse an HXML source string into an AST.
 */
export function parse(source: string, options?: ParseOptions): ParseResult {
  return parseImpl(source, options);
}

/**
 * Parse an HXML fragment (skips implicit html/head/body wrapping).
 */
export function parseFragment(source: string, options?: Omit<ParseOptions, 'fragment'>): ParseResult {
  return parseImpl(source, { ...options, fragment: true });
}

/**
 * Emit an HXML AST as HTML5.
 */
export function emit(ast: RootNode, options?: EmitOptions): EmitResult {
  return emitImpl(ast, options);
}

/**
 * Emit an HXML AST to a streaming chunk callback.
 */
export function emitToStream(
  ast: RootNode,
  writeChunk: (chunk: string) => void,
  options?: EmitOptions,
): EmitStreamResult {
  return emitToStreamImpl(ast, writeChunk, options);
}

/**
 * Validate an HXML AST and return diagnostics.
 */
export function validate(ast: RootNode, options?: ValidateOptions): Diagnostic[] {
  return validateImpl(ast, options);
}

/**
 * Convert an HTML5 source string into equivalent HXML source.
 *
 * Every HTML document is already valid HXML — this function adds explicit
 * closing tags, consistent indentation, and readies the document for
 * XML namespace extensions.
 */
export function htmlToHxml(source: string, options?: ConvertOptions): ConvertResult {
  return htmlToHxmlImpl(source, options);
}

/**
 * Format an HXML source string with consistent indentation and explicit
 * closing tags. This is the canonical HXML formatter used by `hxml fmt`.
 *
 * Since HXML is a superset of HTML, this function accepts any valid HXML
 * document (including pure HTML) and returns properly formatted HXML.
 */
export function format(source: string, options?: ConvertOptions): ConvertResult {
  return htmlToHxmlImpl(source, options);
}

// ── Compile (convenience) ────────────────────────────────────────────────────

export interface CompileOptions {
  parse?: ParseOptions;
  emit?: EmitOptions;
  validate?: ValidateOptions;
  /** Include original source in source map `sourcesContent` when source maps are enabled. */
  includeSourceContent?: boolean;
  /** If true, skip the validation pass. */
  noValidate?: boolean;
}

export interface CompileResult {
  html: string;
  ast: RootNode;
  diagnostics: Diagnostic[];
  sourceMap?: string;
}

/**
 * Compile HXML source to HTML5 in one step.
 * Chains: parse → validate → emit.
 */
export function compile(source: string, options?: CompileOptions): CompileResult {
  const parseResult = parseImpl(source, options?.parse);
  const diagnostics = [...parseResult.diagnostics];

  if (!options?.noValidate) {
    const validationDiags = validateImpl(parseResult.ast, options?.validate);
    diagnostics.push(...validationDiags);
  }

  const emitOptions: EmitOptions | undefined = options?.emit
    ? {
        ...options.emit,
        sourceContent:
          options.emit.sourceMap && options.includeSourceContent
            ? (options.emit.sourceContent ?? source)
            : options.emit.sourceContent,
      }
    : undefined;

  const emitResult = emitImpl(parseResult.ast, emitOptions);

  return {
    html: emitResult.html,
    ast: parseResult.ast,
    diagnostics,
    sourceMap: emitResult.sourceMap,
  };
}

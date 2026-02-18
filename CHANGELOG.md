# Changelog

## Unreleased

- Docs: substantially reduced `docs/guide.md` to a concise practical guide
- Docs: replaced long-form `docs/design.md` with short maintainer design notes
- Packaging: switched npm package name to scoped `@instrumentalslover/hxml` (unscoped `hxml` unavailable)
- Docs: updated README install/badge links for scoped npm package
- Docs: added low-typing usage patterns (`npm i -D` + `npx hxml`, global install)
- Packaging: added `publishConfig.access=public` for scoped npm publish
- Maintenance: moved spec docs from root into `docs/spec/` (`grammar.md`, `decisions.md`)
- Maintenance: moved legal docs from root into `docs/legal/`
- Maintenance: moved maintainer backlog from root `TODO.md` into `docs/project/roadmap.md`
- Docs: updated README, contributing guide, PR template, and docs index for the new layout
- Docs: restored and substantially shortened root `README.md` with focused quickstart + links
- Docs: added `docs/README.md` as a documentation index/hub
- Maintenance: moved project logo from repository root to `docs/assets/HXML.png`
- Packaging: included `docs/assets/HXML.png` in npm published files to keep README image paths valid

## 0.2.0 - 2026-02-18

- CLI: version output now reads from `package.json` instead of a hardcoded constant
- CLI: added `--sourcemap` support for external `.map` files
- CLI: added `--sourcemap inline` support (data URL source map comment)
- CLI: added `--stdin` input mode for all commands
- CLI: added `check --format json` for machine-readable diagnostics
- CLI: added `fmt --indent <n|tab>` for configurable formatter indentation
- Validator: added `HXML205` for duplicate namespace declarations on the same element
- Testing: added source-map mapping accuracy tests (including multi-line source coverage)
- Testing: added parser edge-case coverage for XML-like markup inside raw-text elements
- Testing: added CLI integration tests (spawn process + exit/output assertions)
- API: `compile()` now returns `sourceMap` when emit source maps are enabled
- API: `compile(..., { includeSourceContent: true })` supports source map `sourcesContent`
- API: exported `Tokenizer` class, `walk(ast, visitor)`, and `transform(ast, visitor)` utilities
- Parser: decodes XML named and numeric character references in text/attributes
- Parser: adds close-tag typo hinting for unmatched close tags (`HXML101`)
- Tooling: fixed Vitest resolver so playground `.js` imports in HTML are not rewritten to missing `.ts` files
- Maintenance: synchronized `package-lock.json` root version metadata with `package.json`
- Docs: refreshed README links/options and TODO completion status
- Docs: added dedicated error-code reference (`docs/error-codes.md`)
- Docs: added migration guides for XHTML and JSX users
- Docs: added `examples/` directory with sample `.hxml` documents
- Testing: added emitter round-trip parse/emit/parse AST-shape coverage
- Testing: added converter round-trip HTML → HXML → compile coverage
- Testing: added AST utility tests (`walk`, `transform`, public `Tokenizer` export)
- Testing: added CLI watch mode integration test and `fmt --sort-attrs` CLI coverage
- Features: added `fmt --sort-attrs` option
- Emitter: fixed default `xmlns` resolution for prefix-less XML elements in `custom-elements` mode (foreign-content detection now respects default namespace)
- Emitter: added `customElementPrefix` option for configurable custom-element naming
- Emitter: added `processingInstructionMode` option (`comment` | `custom-elements`)
- Emitter: added `preserveCdataAsComment` option for CDATA serialization control
- Parser: added `HXML105` diagnostics for invalid numeric character references
- Tooling: added large-document benchmark command `npm run bench` (`bench/benchmark.mjs`)
- Parser: expanded named character reference decoding to HTML5 coverage via `entities`
- Parser: added `HXML105` tests for invalid numeric references in text and attribute values
- Docs: added generated API reference output in `docs/api/` with `npm run docs:api`
- Maintenance: set `author` metadata in `package.json`
- Maintenance: initialized repository with Git metadata
- Maintenance: verified npm publish payload with `npm pack --dry-run`
- CLI: added glob/multi-file build support (`hxml build "src/**/*.hxml" -o dist`)
- CLI: added `fmt --preserve-quotes` to keep original attribute quote style
- Converter/Formatter: added `preserveAttributeQuotes` option
- Testing: added coverage for glob builds and quote-preserving formatting paths
- Maintenance: updated `repository`, `homepage`, and `bugs` URLs to the project GitHub account
- Tokenizer: added `tokenizeStream()` incremental generator API
- Tokenizer: replaced regex-based hot-path scans with char-code scanners for tag/attribute/text tokenization
- Parser: implemented lazy child-array allocation via shared empty-child sentinel + append helper
- Emitter: added `emitToStream(ast, writeChunk, options?)` streaming output API
- Emitter: deduplicated repeated attribute emission logic with shared helpers
- Emitter: extracted shared open/children/close element emission helper
- Validator: added per-element namespace prefix resolution cache to avoid repeated scope-stack scans
- Parser: added explicit `<xml>` region mode-switch for unprefixed XML descendants
- Parser: added optional full-document normalization for omitted `<html>`, `<head>`, and `<body>`
- Parser: added implied `<colgroup>` insertion when `<col>` appears directly under `<table>`
- Parser: added practical adoption-style recovery for common formatting-tag misnesting (`b`, `i`, `em`, `strong`)
- API: added `parseFragment()` for snippet parsing without implicit wrappers
- Validator: added `xml:id` uniqueness checking (`HXML206`)
- Validator: added XML-region schema validation options (`HXML207`)
- Docs: rewrote `DECISIONS.md` and `GRAMMAR.md` with implementation-aligned spec detail
- Docs: added comprehensive spec alignment matrix (`docs/spec-audit.md`)

## 0.1.0

Initial release.

- Dual-mode parser: HTML leniency + XML strictness in the same document
- Mode switching via colon in tag names (`prefix:name` = XML mode)
- HTML auto-close rules matching the HTML5 spec
- Hierarchical namespace scoping
- Four emit modes: `custom-elements`, `data-attributes`, `passthrough`, `strip`
- SVG and MathML foreign content support
- V3 source map generation
- HTML-to-HXML converter
- CLI with `build`, `check`, `ast`, `fmt` commands and watch mode
- Formal EBNF grammar specification
- VS Code TextMate syntax grammar

# HXML Design Notes

Short design reference for maintainers.

## Problem

Authoring workflows often need both:

- HTML ergonomics for document structure
- XML strictness for structured, namespaced data

HXML combines both in one parse pipeline.

## Main Decision

Use tag prefixes as the mode switch:

- Unprefixed tag (`div`) → HTML mode
- Prefixed tag (`data:record`) → XML mode

Why this works:

- Easy to read
- No new punctuation beyond established XML syntax
- Deterministic behavior

Normative behavior is defined in:

- `docs/spec/grammar.md`
- `docs/spec/decisions.md`

## Implementation Shape

- Tokenizer is mode-agnostic where possible
- Parser builds AST with per-node mode metadata
- Validator enforces XML-specific constraints
- Emitter serializes by configured emit mode

## Non-Goals

- Browser-native `.hxml` support
- Full XML schema language parity (XSD/RelaxNG)
- Perfect reproduction of all browser parser internals

## Tradeoffs

- Prefer predictable tooling behavior over parser-theory purity
- Parser recovers and returns AST; diagnostics carry strictness
- HTML-friendly defaults, XML strictness only where explicitly requested

## Near-Term Design Priorities

- Improve mixed-mode edge-case tests
- Improve formatter fidelity for mixed HTML/XML content
- Ship editor tooling (LSP + syntax package)

## Naming / Distribution Note

The unscoped npm name `hxml` is already owned by another package.
Project distribution should use the scoped package name `@instrumentalslover/hxml`.

# HXML Decision Log

This document records normative implementation decisions for HXML.
It is the source of truth for behavior where multiple interpretations are possible.

---

## 1) Parsing Model

### 1.1 Dual-mode parsing

- Unprefixed element names default to HTML mode.
- Prefixed element names (`prefix:local`) are XML mode.
- Parsing never changes tokenization rules; mode differences are applied in parser + validator.

### 1.2 Explicit `<xml>` mode-switch region

- `<xml>` in HTML mode opens an XML-mode region for descendants.
- Unprefixed descendants inside that region are parsed as XML mode.
- Closing `</xml>` exits the region.

Rationale: this enables XML vocabularies without prefixing every child element.

### 1.3 Fragment parsing

- `parseFragment()` parses snippet input without implicit document wrappers.
- `parse()` (full-document mode) may normalize omitted structural containers.

---

## 2) HTML Optional-Tag Behavior

### 2.1 Optional close-tags

- HTML auto-close rules are table-driven (`HTML_AUTO_CLOSE_BEFORE`).
- Auto-close loops until no more rules apply.
- Auto-close does not cross XML boundaries.

### 2.2 Optional start-tags for structure

When parsing in full-document mode (`parse`):

- Missing `<html>`, `<head>`, `<body>` are normalized by inserting implied containers.
- Head-only leading nodes (`title`, `meta`, `link`, etc.) are placed in implied `<head>`.
- Remaining nodes are placed in implied `<body>`.

### 2.3 `<colgroup>` start-tag omission

- If `<col>` appears directly under `<table>`, an implied `<colgroup>` is inserted.

---

## 3) Error Recovery and Diagnostics

### 3.1 Always return an AST

- Parser recovery is non-fatal and always returns an AST.
- Diagnostics carry source ranges and optional hints.

### 3.2 Formatting-tag misnest recovery

- For common HTML formatting misnesting (`b`, `i`, `em`, `strong`),
  secondary unmatched close-tags may be consumed when they correspond to
  recently implicit closures from stack unwinding.
- This is a practical adoption-agency-style recovery subset focused on authoring ergonomics.

### 3.3 Character references

- Parser decodes numeric and named character references in text/attributes.
- Invalid numeric references emit `HXML105`.

---

## 4) Namespaces

### 4.1 Prefix declarations and scope

- Namespace declarations are collected in parser and validated later.
- Resolution is hierarchical and nearest-scope wins.
- `xml` and `xmlns` prefixes are predeclared.

### 4.2 Undeclaration

- `xmlns:prefix=""` undeclares that prefix in the element scope and descendants.
- Usage of undeclared prefixes triggers validation errors.

### 4.3 Duplicate declarations

- Duplicate namespace declaration keys on one element are `HXML205`.

---

## 5) XML-specific Validation

### 5.1 XML element rules

- XML mode requires proper nesting and explicit close/void rules.
- Duplicate attributes are `HXML202`.
- Boolean attributes in XML mode are `HXML203`.

### 5.2 `xml:id` uniqueness

- `xml:id` values must be unique across XML regions by default.
- Duplicate values emit `HXML206`.
- This check can be disabled via validator options.

### 5.3 XML region schema checks

- Validator supports optional schema maps keyed by XML element name.
- Supported constraints:
  - `requiredAttributes`
  - `requiredChildren`
  - `allowedChildren`
- Violations emit `HXML207`.

Design note: this is a practical schema layer for template workflows, not full XSD/RelaxNG coverage.

---

## 6) Tokenizer Behavior

### 6.1 Unterminated quoted attributes

- Unterminated quoted attribute values stop at newline/EOF and emit `HXML002`.

### 6.2 Raw-text elements

- `script`, `style`, `textarea`, `title` consume content as raw text until matching close.
- Close tag matching is case-insensitive.

### 6.3 Streaming tokenization

- `tokenizeStream()` yields tokens incrementally to reduce allocation pressure.

---

## 7) Emission Model

### 7.1 Emit modes

- `custom-elements`, `data-attributes`, `passthrough`, `strip`.
- HTML-mode elements emit as HTML.
- XML-mode handling depends on mode.

### 7.2 Streaming emission

- `emitToStream(ast, writeChunk, options?)` writes output incrementally.
- Standard `emit()` remains available for string-based output.

### 7.3 Source maps

- V3 source maps are generated when requested.
- `sourceContent` and `compile(..., includeSourceContent)` are supported.

### 7.4 PI and CDATA controls

- Processing instructions can emit as comments or custom elements.
- CDATA can emit as escaped text or preserved comment form.

---

## 8) Public API Contracts

- `parse()` for full-document behavior.
- `parseFragment()` for snippet behavior.
- `validate()` supports validator options including schema + xml:id policy.
- `compile()` passes parser/emitter/validator options through one pipeline.

---

## 9) Compatibility and Intent

HXML intentionally combines:

- HTML authoring leniency where ergonomic,
- XML strictness where structure matters,
- explicit, diagnosable recovery semantics,
- deterministic compile output suitable for browser pipelines.

Where behavior differs from strict browser parser internals, the project chooses
predictability and tooling ergonomics over exact spec algorithm replication.

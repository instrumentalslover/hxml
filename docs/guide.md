# HXML Guide

Practical reference for using and contributing to HXML.

## What HXML Is

HXML is a mixed markup format:

- Unprefixed elements use HTML parsing rules.
- Prefixed elements (`prefix:name`) use XML parsing rules.
- HTML and XML regions can be nested in one document.

## Install (Quick)

```sh
# local project install
npm i -D @instrumentalslover/hxml
npx hxml build page.hxml -o page.html

# or global install
npm i -g @instrumentalslover/hxml
hxml build page.hxml -o page.html
```

Unscoped npm name `hxml` belongs to an unrelated package. Use `@instrumentalslover/hxml`.

Example:

```hxml
<!DOCTYPE html>
<html>
  <body>
    <p>Hello
    <data:user xmlns:data="urn:app" id="1">
      <data:name>Alice</data:name>
    </data:user>
  </body>
</html>
```

## Core Rules

### Mode selection

- `div`, `p`, `section` → HTML mode
- `data:user`, `svg:rect` → XML mode
- `<xml>...</xml>` can be used as an explicit XML region for unprefixed descendants

### HTML mode

- Case-insensitive tag/attribute behavior
- HTML optional-close and void-element behavior
- Boolean attributes allowed (`disabled`)

### XML mode

- Case-sensitive tag/attribute behavior
- Explicit close or self-close required
- Attribute values must be quoted
- Namespace prefix must be declared (`xmlns:prefix="..."`)

### Namespaces

- Namespace scope is hierarchical (nearest declaration wins)
- `xml` and `xmlns` prefixes are predeclared
- `xmlns:prefix=""` undeclares a prefix in that scope

## CLI

```sh
hxml build input.hxml -o output.html
hxml check input.hxml
hxml fmt input.hxml -o input.hxml
```

Common options:

- `--strict`
- `--sourcemap` / `--sourcemap inline`
- `--stdin`

## API

```ts
import { compile, parse, validate, emit } from "@instrumentalslover/hxml";

const parsed = parse(source);
const diagnostics = validate(parsed.ast);
const emitted = emit(parsed.ast);
const result = compile(source);
```

See generated API docs in `docs/api/` for full signatures.

## Architecture

Pipeline:

1. `tokenizer.ts` → tokens
2. `parser.ts` → AST
3. `validator.ts` → diagnostics
4. `emitter.ts` → HTML output

Key modules:

- `src/ast.ts` node types
- `src/constants.ts` HTML rule tables
- `src/converter.ts` HTML→HXML formatter path
- `src/vite-plugin.ts` Vite integration

## Diagnostics

- Errors: `HXML001`–`HXML299`
- Warnings: `HXML300`–`HXML399`

Reference: `docs/error-codes.md`

## Current Scope

HXML is focused on:

- Correct mixed HTML/XML parsing
- Deterministic emit output
- Good diagnostics and source mapping

Out of scope for now:

- Full LSP implementation
- Full schema languages (XSD/RelaxNG equivalents)
- Native browser parsing of `.hxml`

## Project Status

Active development is tracked in:

- `docs/project/roadmap.md`
- `CHANGELOG.md`
- `docs/spec/grammar.md`
- `docs/spec/decisions.md`

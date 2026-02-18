<p align="center">
  <img src="./docs/assets/HXML.png" alt="HXML logo" width="420" />
</p>

<p align="center">
  <a href="https://github.com/instrumentalslover/hxml/actions/workflows/ci.yml"><img src="https://github.com/instrumentalslover/hxml/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@instrumentalslover/hxml"><img src="https://img.shields.io/npm/v/%40instrumentalslover%2Fhxml" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-AGPL%20v3-blue.svg" alt="License: AGPL v3" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933" alt="Node >=20" />
</p>

# hxml

HTML + XML superset markup: unprefixed tags use HTML rules, namespaced tags (`prefix:name`) use XML rules, and both can be mixed in one document.

## Install

```sh
npm install -D @instrumentalslover/hxml
```

Requires Node.js 20+.

Unscoped npm name `hxml` is already taken by an unrelated package.

## Fast Usage

```sh
# local project install
npm i -D @instrumentalslover/hxml
npx hxml build page.hxml -o page.html

# or global install
npm i -g @instrumentalslover/hxml
hxml build page.hxml -o page.html
```

## Quick Example

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

## CLI

```sh
hxml build page.hxml -o page.html
hxml check page.hxml
hxml fmt page.hxml -o page.hxml
```

## Why HXML

- HTML ergonomics for normal markup
- XML strictness for namespaced content
- One parser/AST/validator pipeline for both

## API

```ts
import { compile } from "@instrumentalslover/hxml";

const result = compile('<p>Hello <data:x xmlns:data="urn:x">ok</data:x>');
console.log(result.html);
console.log(result.diagnostics);
```

## Emit Modes

- `custom-elements` (default)
- `data-attributes`
- `passthrough`
- `strip`

## Documentation

- Start here: [docs/README.md](./docs/README.md)
- Guide: [docs/guide.md](./docs/guide.md)
- Spec grammar: [docs/spec/grammar.md](./docs/spec/grammar.md)
- Decision log: [docs/spec/decisions.md](./docs/spec/decisions.md)
- API reference: [docs/api/README.md](./docs/api/README.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

## License & Contributions

- Open-source: AGPL-3.0-or-later ([LICENSE](./LICENSE))
- Commercial licensing: [docs/legal/commercial-license.md](./docs/legal/commercial-license.md)
- Individual CLA: [docs/legal/cla-individual.md](./docs/legal/cla-individual.md)
- Corporate CLA: [docs/legal/cla-corporate.md](./docs/legal/cla-corporate.md)
- Trademark policy: [docs/legal/trademarks.md](./docs/legal/trademarks.md)

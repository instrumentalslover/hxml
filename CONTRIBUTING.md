# Contributing to HXML

## Prerequisites

- **Node.js ≥ 20** and **npm**

## Development setup

```sh
git clone <repo-url>
cd hxml
npm install
npm run build
npm test
```

Watch mode (recompiles TypeScript on save):

```sh
npm run dev
```

Watch mode for tests:

```sh
npm run test:watch
```

## Project structure

The codebase is a single TypeScript package with minimal runtime dependencies.
See [docs/guide.md](docs/guide.md) §4 for a full module map.

```
src/
  ast.ts          Node type definitions
  tokenizer.ts    Chars → Tokens
  parser.ts       Tokens → AST
  validator.ts    AST → Diagnostics
  emitter.ts      AST → HTML5
  converter.ts    HTML5 → HXML (also used by hxml fmt)
  cli.ts          Command-line interface
  index.ts        Public API
  utils/          errors, source-map, vlq, escape
test/             Vitest test files (one per module)
docs/             Design and implementation guides
```

## Code style

- **Keep runtime dependencies minimal and justified.** Prefer small, well-maintained packages and keep most tooling in `devDependencies`.
- **TypeScript strict mode** — every parameter and return type must be inferred or explicit.
- **ESM modules** — use `.js` extensions in import paths (even for `.ts` source files).
- **Never throw in the tokenizer or parser.** Emit a `Diagnostic` and continue.
- **Tests before features.** Write a failing test first; then implement.
- **Error messages are UI.** Every `Diagnostic` must include a `hint:` field that tells the user how to fix the problem.
- **Update docs/spec/decisions.md** when adding or changing a parser behaviour that involves an ambiguous or non-obvious choice. See the existing entries for the expected format.

## Running tests

```sh
npm test           # run once
npm run test:watch # watch mode
```

All test files must pass before a PR is merged. Fuzz tests live in
`test/fuzz.test.ts` and run as part of the normal test suite.

## Adding a diagnostic code

1. Pick the next unused code in the appropriate range:
   - `HXML001`–`HXML299`: errors (violations)
   - `HXML300`–`HXML399`: warnings (technically valid but likely unintended)
2. Add it to the appropriate place in `validator.ts` or `parser.ts`.
3. Add at least one positive and one negative test in `test/validator.test.ts`.

## Submitting changes

1. Fork the repo and create a feature branch.
2. Make your changes with tests.
3. Run `npm run build && npm test` — both must pass.
4. Open a pull request with a clear description of the change and why it's needed.

## Contribution Licensing

By submitting a contribution, you agree that your contribution is licensed under
the project open-source license (AGPL-3.0-or-later), and you grant the project
maintainer the right to also offer the contribution under commercial licensing terms.

See `docs/legal/cla-individual.md` for the complete legal terms.

For employer/company-backed contributions, see `docs/legal/cla-corporate.md`.

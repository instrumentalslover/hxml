# HXML Roadmap

This roadmap tracks active and upcoming work.
Completed work is recorded in `CHANGELOG.md`.

## Near Term

- Publish `@instrumentalslover/hxml` to npm.
- Add CI check for docs link validation.
- Expand parser/e2e tests for deeply nested mixed-mode auto-close boundaries.
- Improve formatter controls for advanced mixed HTML/XML whitespace preferences.

## Publish Checklist

- Confirm package name is scoped: `@instrumentalslover/hxml`.
- Ensure `package.json` includes public scoped publish config.
- Run `npm run build` and `npm test`.
- Run `npm pack --dry-run` and verify expected files.
- Publish: `npm publish --access public`.
- Tag and push release commit.

## Ecosystem

- Ship a VS Code extension with syntax + diagnostics.
- Add plugin support for esbuild, Rollup, and webpack.
- Publish `hxml.tmLanguage.json` as a standalone marketplace extension.

## Longer Term

- Incremental parse architecture for editor responsiveness.
- Optional Rust/WASM parser path for large-document performance.
- Conformance suite for parser/emitter compatibility across implementations.

## Maintainer Notes

- Keep scope focused on dual-mode parsing correctness and stable compile output.
- Prefer documentation updates in `docs/spec/` for behavioral changes.

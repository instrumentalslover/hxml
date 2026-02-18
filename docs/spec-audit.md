# Spec Alignment Audit

Date: 2026-02-17

Scope: parser, tokenizer, validator, emitter, converter, CLI, API exports, tests, and docs.

## Summary

The implementation aligns with the current HXML grammar + decision log for all tracked spec-completeness items.

## Audit Matrix

| Spec area | Status | Implementation | Validation coverage |
|---|---|---|---|
| Dual-mode parsing (`:` prefix) | ✅ | `src/parser.ts` mode detection | parser + compile tests |
| Explicit `<xml>` mode-switch | ✅ | `src/parser.ts` (`xmlRegion` stack flag) | `test/parser-autoclose.test.ts` |
| HTML optional close rules | ✅ | `src/constants.ts`, `src/parser.ts` auto-close loop | `test/parser-autoclose.test.ts` |
| Omitted `html/head/body` | ✅ | `src/parser.ts` `ensureHtmlOptionalContainers()` | `test/parser-autoclose.test.ts` |
| Omitted `colgroup` start | ✅ | `src/parser.ts` implied colgroup insertion | `test/parser-autoclose.test.ts` |
| Adoption-style formatting recovery | ✅ | `src/parser.ts` implicit-closure consumption for `b/i/em/strong` | `test/parser-autoclose.test.ts` |
| Fragment parsing | ✅ | `parseFragment()` in `src/index.ts`, `fragment` parse option | `test/compile.test.ts` |
| Namespace scope + undeclaration | ✅ | `src/parser.ts`, `src/validator.ts` | `test/validator.test.ts` |
| Character reference decoding + numeric validation | ✅ | `src/utils/entities.ts`, `src/parser.ts` | parser tests |
| XML strict attribute rules | ✅ | `src/validator.ts` (`HXML202/HXML203`) | validator tests |
| `xml:id` uniqueness | ✅ | `src/validator.ts` (`HXML206`) | `test/validator.test.ts` |
| XML-region schema validation | ✅ | `src/validator.ts` options schema (`HXML207`) | `test/validator.test.ts`, `test/compile.test.ts` |
| Emitter streaming output | ✅ | `src/emitter.ts` `emitToStream()` | `test/emitter.test.ts` |
| Tokenizer incremental stream | ✅ | `src/tokenizer.ts` `tokenizeStream()` | tokenizer tests |

## Notes on Semantics

- Adoption-agency handling is implemented as a practical recovery subset for common formatting misnesting, not a full browser parser-internal replica.
- XML-region schema support is pragmatic rule-based validation (`requiredAttributes`, `requiredChildren`, `allowedChildren`) rather than complete XSD/RelaxNG language support.

## Conclusion

Current codebase behavior is consistent with `docs/spec/grammar.md` and `docs/spec/decisions.md`.

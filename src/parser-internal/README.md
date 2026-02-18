# parser-internal

Private parser implementation modules.

- Not part of the public API.
- `src/parser.ts` is the entrypoint and behavior contract.
- Files are split by concern: helpers, diagnostics, recovery, normalization.
- Preferred refactor style here: extraction-only unless tests intentionally change behavior.
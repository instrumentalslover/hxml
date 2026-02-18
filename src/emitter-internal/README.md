# emitter-internal

Private emitter implementation modules.

- Not part of the public API.
- `src/emitter.ts` is the stable entrypoint.
- Files are split by concern: runtime/source-map plumbing and XML mode handlers.
- Keep behavior changes explicit and test-backed; prefer extraction-only refactors by default.
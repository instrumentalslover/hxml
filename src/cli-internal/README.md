# cli-internal

Private CLI implementation modules.

- Not part of the public API.
- `src/cli.ts` remains the CLI entrypoint.
- Files are split by concern:
  - `args.ts`: usage/version/argument parsing
  - `run-once.ts`: one-shot command execution
  - `glob.ts`: glob path helpers
  - `types.ts`: CLI argument type contract

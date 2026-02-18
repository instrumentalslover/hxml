# Migrating from JSX to HXML

HXML is document-first markup, not a JavaScript component runtime. Migration is mostly about replacing JSX-only constructs with plain markup/data structures.

## Key differences

- JSX expressions (`{...}`) are not part of HXML syntax.
- Components (`<MyComponent />`) are not executable in HXML by default.
- Namespace-prefixed tags (`data:record`) opt into strict XML-mode validation.

## Practical migration pattern

1. Render dynamic JSX output to static HTML (SSR/build step).
2. Convert HTML to HXML with `hxml fmt` or `htmlToHxml()`.
3. Add XML-mode sections where strict, machine-readable structure is needed.

## Example

### JSX-style input

```jsx
<section>
  <h2>{title}</h2>
  <StatusBadge level="ok" />
</section>
```

### HXML target

```hxml
<section>
  <h2>Status</h2>
  <ui:status xmlns:ui="urn:ui" level="ok">Healthy</ui:status>
</section>
```

## Notes

- Treat HXML as a source format compiled to HTML, similar to other preprocessor workflows.
- Keep framework behavior in JS; keep structured document semantics in HXML.

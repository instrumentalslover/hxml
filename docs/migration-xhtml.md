# Migrating from XHTML to HXML

HXML lets you keep strict XML where it matters without forcing strictness on the full page.

## Quick mapping

- XHTML document root stays mostly unchanged.
- Keep strict, namespaced structures as `prefix:name` XML-mode elements.
- Let regular page markup use HTML mode for ergonomic authoring.

## Before (XHTML-style)

```xml
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <p>Paragraph</p>
    <data:record xmlns:data="urn:app">
      <data:name>Alice</data:name>
    </data:record>
  </body>
</html>
```

## After (HXML)

```hxml
<!DOCTYPE html>
<html>
<body>
  <p>Paragraph
  <data:record xmlns:data="urn:app">
    <data:name>Alice</data:name>
  </data:record>
</body>
</html>
```

## Notes

- Keep closing tags for XML-mode elements (`prefix:name`).
- HTML-mode optional-close behavior is allowed and intentional.
- Use `hxml check --strict` during migration to surface portability issues.

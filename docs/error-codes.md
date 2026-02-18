# HXML Error Codes

This page summarizes current diagnostics with practical examples.

## Tokenizer (`HXML001`–`HXML099`)

### `HXML002` — Unterminated quoted attribute value

```hxml
<div class="missing-quote
<p>next line</p>
```

Fix: close the quote before newline/EOF.

### `HXML003` — Unrecognized `<!...>` markup declaration

```hxml
<!ELEMENT div (p|br)*>
```

Fix: use valid HXML constructs (`<!DOCTYPE ...>`, `<!-- ... -->`, `<![CDATA[ ... ]]>`).

---

## Parser (`HXML100`–`HXML199`)

### `HXML101` — Unmatched closing tag

```hxml
<div>text</span>
```

### `HXML102` — Unclosed XML element inside close sequence

```hxml
<data:row xmlns:data="urn:app"><data:cell></data:row>
```

### `HXML103` — XML element never closed at EOF

```hxml
<data:record xmlns:data="urn:app">
```

### `HXML104` — More than one colon in tag name

```hxml
<a:b:c xmlns:a="urn:a"/>
```

### `HXML105` — Invalid numeric character reference

```hxml
<p>&#x110000;</p>
<div title="bad: &#55296;"></div>
```

Fix: use a valid Unicode scalar value (`U+0000`–`U+10FFFF`, excluding surrogate range `U+D800`–`U+DFFF`).

---

## Validator (`HXML200`–`HXML299`)

### `HXML201` — Namespace prefix not declared

```hxml
<data:record>text</data:record>
```

### `HXML202` — Duplicate attribute on XML element

```hxml
<data:item xmlns:data="urn:app" id="1" id="2"/>
```

### `HXML203` — XML attribute must have value

```hxml
<data:btn xmlns:data="urn:app" disabled/>
```

### `HXML204` — Prefixed attribute uses undeclared namespace

```hxml
<div foo:bar="x"></div>
```

### `HXML205` — Duplicate namespace declaration on same element

```hxml
<data:record xmlns:data="urn:a" xmlns:data="urn:b"></data:record>
```

### `HXML206` — Duplicate xml:id value

```hxml
<data:root xmlns:data="urn:app">
	<data:item xml:id="dup"/>
	<data:item xml:id="dup"/>
</data:root>
```

### `HXML207` — XML region schema validation violation

```hxml
<data:record xmlns:data="urn:app">
	<data:extra/>
</data:record>
```

Fix: pass `validate(..., { schema: ... })` rules that match your document,
or adjust element structure/attributes to satisfy required/allowed schema rules.

---

## Warnings (`HXML300`–`HXML399`)

### `HXML301` — CDATA inside HTML-mode element

```hxml
<div><![CDATA[text]]></div>
```

### `HXML302` — Legacy DOCTYPE

```hxml
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0//EN">
```

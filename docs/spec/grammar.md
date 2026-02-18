# HXML Formal Grammar and Semantics

This document defines HXML syntax (EBNF) plus required semantic rules.

---

## 1. Core Lexical Units

```ebnf
S            = ( #x20 | #x09 | #x0A | #x0D )+
NameStart    = ':' | '_' | [A-Za-z]
NameChar     = NameStart | '-' | '.' | [0-9]
Name         = NameStart { NameChar }
PrefixedName = Name ':' Name
```

Character references:

```ebnf
CharRef      = '&#' [0-9]+ ';' | '&#x' [0-9A-Fa-f]+ ';'
EntityRef    = '&' Name ';'
Reference    = CharRef | EntityRef
```

---

## 2. Document Forms

### 2.1 Full document

```ebnf
Document = { Node }
```

Full-document parsing may normalize omitted structural containers (`html/head/body`) after parse.

### 2.2 Fragment

```ebnf
Fragment = { Node }
```

Fragment parsing (`parseFragment`) does not inject implied structural containers.

---

## 3. Nodes

```ebnf
Node = Element | Text | Comment | CData | PI | Doctype

Text    = { Char - '<' }+
Comment = '<!--' { Char - '-->' } '-->'
CData   = '<![CDATA[' { Char - ']]>' } ']]>'
PI      = '<?' Name { Char - '?>' } '?>'
Doctype = '<!' ('DOCTYPE' | 'doctype') S { Char - '>' } '>'
```

---

## 4. Elements and Attributes

```ebnf
Element = OpenTag { Node } CloseTag
        | EmptyTag

OpenTag  = '<' TagName { S Attribute } S? '>'
CloseTag = '</' TagName S? '>'
EmptyTag = '<' TagName { S Attribute } S? '/>'

TagName  = Name | PrefixedName

Attribute = Name
          | Name S? '=' S? AttrValue

AttrValue = '"' { Char - '"' } '"'
          | "'" { Char - "'" } "'"
          | { Char - S - '>' - '/' }+
```

Semantic constraints:

- Boolean attributes (`name` with no `=`) are valid in HTML mode.
- In XML mode, boolean attributes are invalid (`HXML203`).

---

## 5. Parsing Modes

### 5.1 Mode selection

An element is XML mode if any of the following is true:

1. `TagName` is prefixed (`prefix:local`), or
2. it is inside an explicit `<xml>` region.

Otherwise it is HTML mode.

### 5.2 Explicit `<xml>` region

```ebnf
XmlRegion = '<xml' { S Attribute } S? '>' { Node } '</xml>'
```

Inside `<xml>...</xml>`, unprefixed elements parse in XML mode.

---

## 6. HTML Optional-Tag Semantics

### 6.1 Auto-close before rules

HTML-mode elements are auto-closed according to `HTML_AUTO_CLOSE_BEFORE` table.

### 6.2 Omitted structural start tags

In full-document parsing:

- If missing, implied `<html>`, `<head>`, and `<body>` containers are inserted.
- Leading head-only nodes (`title`, `meta`, `link`, `style`, `script`, etc.) map to implied `<head>`.
- Remaining nodes map to implied `<body>`.

### 6.3 Omitted `<colgroup>` start tag

If `<col>` is opened directly under `<table>`, an implied `<colgroup>` is inserted.

---

## 7. Namespaces

Namespace declarations:

```ebnf
DefaultNsDecl   = 'xmlns' S? '=' S? AttrValue
PrefixedNsDecl  = 'xmlns:' Name S? '=' S? AttrValue
NamespaceDecl   = DefaultNsDecl | PrefixedNsDecl
```

Rules:

- Scope is hierarchical (nearest declaration wins).
- `xml` and `xmlns` prefixes are predeclared.
- `xmlns:prefix=""` undeclares the prefix in that scope.
- Duplicate namespace declarations on one element are `HXML205`.

---

## 8. XML Validation Semantics

In XML mode:

- Close-tags are exact and case-sensitive.
- Proper nesting is required; parser recovers with diagnostics (`HXML101/102/103`).
- Duplicate attributes are `HXML202`.
- `xml:id` values are unique document-wide by default (`HXML206`).

Optional schema validation can be provided with per-element constraints:

- `requiredAttributes`
- `requiredChildren`
- `allowedChildren`

Violations emit `HXML207`.

---

## 9. Character References

- Named and numeric references are decoded during parse.
- Invalid numeric references emit `HXML105`.

---

## 10. Recovery and Adoption-style Handling

For common formatting tag misnesting (`b`, `i`, `em`, `strong`), parser recovery may consume secondary unmatched close-tags after implicit stack unwinding to preserve author intent.

---

## 11. Raw-text Elements

```ebnf
RawTextTag = 'script' | 'style' | 'textarea' | 'title'
```

Raw-text content is consumed as literal text until matching close tag (case-insensitive).

---

## 12. Diagnostic Codes

- `HXML002` unterminated quoted attribute value
- `HXML003` unrecognized markup declaration
- `HXML101` unmatched close tag
- `HXML102` unclosed XML element inside close sequence
- `HXML103` XML element unclosed at EOF
- `HXML104` multiple colons in tag name
- `HXML105` invalid numeric character reference
- `HXML201` namespace prefix undeclared
- `HXML202` duplicate XML attribute
- `HXML203` XML attribute missing value
- `HXML204` undeclared prefix on attribute
- `HXML205` duplicate namespace declaration
- `HXML206` duplicate `xml:id`
- `HXML207` XML schema violation
- `HXML301` CDATA in HTML mode (warning)
- `HXML302` legacy DOCTYPE (warning)

---

## 13. Conformance Notes

Conforming implementations must:

1. Preserve dual-mode parsing semantics,
2. Emit diagnostics with source ranges,
3. Support fragment parsing distinctly from full-document parsing,
4. Respect namespace scope + predeclared prefixes,
5. Provide deterministic serialization through configured emit mode.

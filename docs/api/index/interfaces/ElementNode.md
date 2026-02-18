[**hxml**](../../README.md)

***

[hxml](../../README.md) / [index](../README.md) / ElementNode

# Interface: ElementNode

Defined in: ast.ts:32

## Properties

### attrs

> **attrs**: [`Attribute`](Attribute.md)[]

Defined in: ast.ts:40

***

### children

> **children**: [`HxmlNode`](../type-aliases/HxmlNode.md)[]

Defined in: ast.ts:47

***

### isVoid

> **isVoid**: `boolean`

Defined in: ast.ts:46

Whether this is an HTML void element or XML self-closing.

***

### loc

> **loc**: [`SourceRange`](SourceRange.md)

Defined in: ast.ts:49

***

### localName

> **localName**: `string`

Defined in: ast.ts:39

Local part after the colon, e.g. "record" or "div".

***

### mode

> **mode**: [`ParsingMode`](../type-aliases/ParsingMode.md)

Defined in: ast.ts:48

***

### name

> **name**: `string`

Defined in: ast.ts:35

Full tag name, e.g. "data:record" or "div".

***

### namespaces

> **namespaces**: `Map`\<`string`, `string`\>

Defined in: ast.ts:42

Namespace declarations on this element. prefix → URI.

***

### prefix

> **prefix**: `string` \| `null`

Defined in: ast.ts:37

Namespace prefix if present, e.g. "data", otherwise null.

***

### selfClosing

> **selfClosing**: `boolean`

Defined in: ast.ts:44

Whether the element used `/>` syntax.

***

### type

> **type**: `"element"`

Defined in: ast.ts:33

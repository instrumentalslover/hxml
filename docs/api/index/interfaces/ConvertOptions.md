[**hxml**](../../README.md)

***

[hxml](../../README.md) / [index](../README.md) / ConvertOptions

# Interface: ConvertOptions

Defined in: converter.ts:24

## Properties

### indent?

> `optional` **indent**: `string`

Defined in: converter.ts:26

Indentation string.  Default: '  ' (2 spaces).

***

### preserveAttributeQuotes?

> `optional` **preserveAttributeQuotes**: `boolean`

Defined in: converter.ts:35

Preserve original attribute quote style (`'` vs `"`) when possible.

***

### preserveWhitespace?

> `optional` **preserveWhitespace**: `boolean`

Defined in: converter.ts:31

If true, preserve the source document's whitespace text nodes verbatim.
If false (default), reformat whitespace for consistent indentation.

***

### sortAttributes?

> `optional` **sortAttributes**: `boolean`

Defined in: converter.ts:33

Sort attributes alphabetically by name. Default: false.

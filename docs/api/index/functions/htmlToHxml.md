[**hxml**](../../README.md)

***

[hxml](../../README.md) / [index](../README.md) / htmlToHxml

# Function: htmlToHxml()

> **htmlToHxml**(`source`, `options?`): [`ConvertResult`](../interfaces/ConvertResult.md)

Defined in: index.ts:99

Convert an HTML5 source string into equivalent HXML source.

Every HTML document is already valid HXML — this function adds explicit
closing tags, consistent indentation, and readies the document for
XML namespace extensions.

## Parameters

### source

`string`

### options?

[`ConvertOptions`](../interfaces/ConvertOptions.md)

## Returns

[`ConvertResult`](../interfaces/ConvertResult.md)

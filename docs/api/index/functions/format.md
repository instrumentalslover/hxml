[**hxml**](../../README.md)

***

[hxml](../../README.md) / [index](../README.md) / format

# Function: format()

> **format**(`source`, `options?`): [`ConvertResult`](../interfaces/ConvertResult.md)

Defined in: index.ts:110

Format an HXML source string with consistent indentation and explicit
closing tags. This is the canonical HXML formatter used by `hxml fmt`.

Since HXML is a superset of HTML, this function accepts any valid HXML
document (including pure HTML) and returns properly formatted HXML.

## Parameters

### source

`string`

### options?

[`ConvertOptions`](../interfaces/ConvertOptions.md)

## Returns

[`ConvertResult`](../interfaces/ConvertResult.md)

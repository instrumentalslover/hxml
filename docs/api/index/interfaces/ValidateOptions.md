[**hxml**](../../README.md)

***

[hxml](../../README.md) / [index](../README.md) / ValidateOptions

# Interface: ValidateOptions

Defined in: validator.ts:27

## Properties

### enforceXmlIdUniqueness?

> `optional` **enforceXmlIdUniqueness**: `boolean`

Defined in: validator.ts:29

Enable xml:id uniqueness checks across the full document. Default: true.

***

### schema?

> `optional` **schema**: `Record`\<`string`, [`XmlRegionSchema`](XmlRegionSchema.md)\>

Defined in: validator.ts:31

Optional schema map keyed by XML element full name (e.g. data:record).

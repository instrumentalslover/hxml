[**hxml**](../../README.md)

***

[hxml](../../README.md) / [tokenizer](../README.md) / Tokenizer

# Class: Tokenizer

Defined in: tokenizer.ts:84

## Constructors

### Constructor

> **new Tokenizer**(`source`): `Tokenizer`

Defined in: tokenizer.ts:90

#### Parameters

##### source

`string`

#### Returns

`Tokenizer`

## Properties

### diagnostics

> `readonly` **diagnostics**: [`Diagnostic`](../../index/interfaces/Diagnostic.md)[] = `[]`

Defined in: tokenizer.ts:88

## Methods

### nextToken()

> **nextToken**(): [`Token`](../type-aliases/Token.md) \| `null`

Defined in: tokenizer.ts:348

#### Returns

[`Token`](../type-aliases/Token.md) \| `null`

***

### tokenize()

> **tokenize**(): [`Token`](../type-aliases/Token.md)[]

Defined in: tokenizer.ts:498

Tokenize the entire source into an array of tokens.

#### Returns

[`Token`](../type-aliases/Token.md)[]

***

### tokenizeStream()

> **tokenizeStream**(): `Generator`\<[`Token`](../type-aliases/Token.md), `void`, `undefined`\>

Defined in: tokenizer.ts:513

Incrementally tokenize the source as a generator.

This avoids materializing a full token array up-front and is useful
for large inputs or streaming-style consumers.

#### Returns

`Generator`\<[`Token`](../type-aliases/Token.md), `void`, `undefined`\>

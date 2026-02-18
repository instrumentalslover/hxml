[**hxml**](../../README.md)

***

[hxml](../../README.md) / [index](../README.md) / EmitOptions

# Interface: EmitOptions

Defined in: emitter.ts:25

## Properties

### customElementPrefix?

> `optional` **customElementPrefix**: `string`

Defined in: emitter.ts:41

Prefix prepended to generated custom-element names.

***

### doctype?

> `optional` **doctype**: `boolean`

Defined in: emitter.ts:30

Whether to include the DOCTYPE.  Default true.

***

### indent?

> `optional` **indent**: `string`

Defined in: emitter.ts:28

Indent string, default ''. Pass '  ' (2 spaces) for formatted output.

***

### mode?

> `optional` **mode**: [`EmitMode`](../type-aliases/EmitMode.md)

Defined in: emitter.ts:26

***

### preserveCdataAsComment?

> `optional` **preserveCdataAsComment**: `boolean`

Defined in: emitter.ts:45

Preserve CDATA sections as comments instead of escaping to text.

***

### processingInstructionMode?

> `optional` **processingInstructionMode**: `"comment"` \| `"custom-elements"`

Defined in: emitter.ts:43

How processing instructions should be emitted. Default: "comment".

***

### sourceContent?

> `optional` **sourceContent**: `string`

Defined in: emitter.ts:39

Optional source content embedded in the source map `sourcesContent`.

***

### sourceFile?

> `optional` **sourceFile**: `string`

Defined in: emitter.ts:37

Source file path embedded in the source map.  Default: "input.hxml".

***

### sourceMap?

> `optional` **sourceMap**: `boolean`

Defined in: emitter.ts:35

When true, generate a V3 source map alongside the HTML output.
The source path used in the map can be set via `sourceFile`.

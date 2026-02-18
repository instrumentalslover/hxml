[**hxml**](../../README.md)

***

[hxml](../../README.md) / [index](../README.md) / Diagnostic

# Interface: Diagnostic

Defined in: utils/errors.ts:25

## Properties

### code

> **code**: `string`

Defined in: utils/errors.ts:28

e.g. "HXML001", "HXML201"

***

### hint?

> `optional` **hint**: `string`

Defined in: utils/errors.ts:34

Optional suggestion for fixing the issue.

***

### loc

> **loc**: [`SourceRange`](SourceRange.md)

Defined in: utils/errors.ts:32

Source location of the problem.

***

### message

> **message**: `string`

Defined in: utils/errors.ts:30

Human-readable description.

***

### severity

> **severity**: [`DiagnosticSeverity`](../type-aliases/DiagnosticSeverity.md)

Defined in: utils/errors.ts:26

# Data Model: Final Processing

Extends Specs [4](../004-cea-request-form/data-model.md), [5](../005-request-attachments/data-model.md) and [7](../007-approval-chain/data-model.md).

## CeaRequest additions
Status values Final Processing and Completed; Completed By (Lookup User), Completed On (DateTime).

## RequestAttachment
`Package = Final` identifies final package files. Same limits as Spec 5, counted separately.

## DataCorrectionRecord

| Column | Type |
|---|---|
| Request | Lookup |
| Table / Field | Text |
| Old Value | Text |
| New Value | Text |
| Changed By | Lookup User |
| Changed On | DateTime |

Create-only. Written only while status = Final Processing.

## Transitions
Approved (all levels) → Final Processing → Completed (final, read-only for all).

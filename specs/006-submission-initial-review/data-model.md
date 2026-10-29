# Data Model: Submission and Initial Review

Extends [Spec 4](../004-cea-request-form/data-model.md) and [Spec 3](../003-approver-assignment/data-model.md).

## CeaRequest additions
Submitted By (Lookup User), Submitted On (DateTime), Status Changed On (DateTime), Current Level (Choice, from Approval Level).

## InitialReview

| Column | Type |
|---|---|
| Request | Lookup |
| State | Choice (Open, Released, Returned) |
| Reviewed By | Lookup User (set when closed) |
| Reviewed On | DateTime |
| Outcome | Choice (Released, Returned) |
| Comments | Multiline; required when Returned |

One Open review per request at a time. Closed rows are immutable.

## Status transitions
Draft → Pending Initial Review (submit) → Pending Approval (release) or → Returned to Creator (return) → Pending Initial Review (resubmit).

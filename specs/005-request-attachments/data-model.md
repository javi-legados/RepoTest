# Data Model: Request Attachments

Extends [Spec 4](../004-cea-request-form/data-model.md).

## RequestAttachment

| Column | Type | Rules |
|---|---|---|
| Request | Lookup CeaRequest | Parental; cascade delete with Draft |
| File | File | ≤ 25 MB; allowed types only |
| File Name | Text | Unique per request |
| Size | Whole | Bytes |
| Type | Text | Extension |
| Uploaded By | Lookup User | Auto |
| Uploaded On | DateTime | Auto |
| Package | Choice | Request, Final (Spec 10 counts the final package separately) |

Rules: max 20 rows per request and package; contents are immutable; removal allowed per role and status only.

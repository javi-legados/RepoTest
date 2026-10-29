# Data Model: Rejection and Revision Review

Extends Specs [6](../006-submission-initial-review/data-model.md) and [7](../007-approval-chain/data-model.md).

## Review additions
Review Type (Choice: Initial, Revision); same states and rules as Initial Review.

## RevisionCycle

| Column | Type |
|---|---|
| Request | Lookup |
| Cycle | Whole |
| Rejected By | Lookup User |
| Rejection Comments | Multiline |
| Rejected On | DateTime |
| Resubmitted On | DateTime |
| Correction Note | Multiline (optional) |
| Review Outcome | Choice (Released, Returned) |
| Reviewed By | Lookup User |

Append-only.

## Status additions
Returned to Creator, Pending Revision Review, On Hold (Creator inactive).

## PlatformSetting key
`CreatorReminderDays`.

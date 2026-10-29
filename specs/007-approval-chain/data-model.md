# Data Model: Approval Chain

Extends [Spec 3](../003-approver-assignment/data-model.md) and [Spec 6](../006-submission-initial-review/data-model.md).

## ResolvedApprover (step) additions
Step Status (Choice: Pending, Approved, Rejected, Skipped, Invalidated, On Hold), Decided On.

## ApprovalDecision

| Column | Type |
|---|---|
| Request | Lookup |
| Level | Choice |
| Approver | Lookup User |
| Decision | Choice (Approved, Rejected) |
| Comments | Multiline; required when Rejected |
| Decided On | DateTime |
| Invalidated | Two Options (set when a later rejection invalidates it) |
| Cycle | Whole (revision cycle number) |

Create-only; only `Invalidated` may change once.

## PlatformSetting
Name, Value. Key `ReminderDays` (N) editable by administrators.

## Request status additions
Pending Approval (with Current Level), Approved, On Hold.

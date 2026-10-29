# Data Model: Audit and History

Consumes events from Specs [1](../001-users-master-data/data-model.md)–[10](../010-final-processing/data-model.md).

## HistoryEntry

| Column | Type |
|---|---|
| Request | Lookup CeaRequest |
| Event Type | Choice (Created, Submitted, Review Released, Review Returned, Approved, Rejected, Skipped, Resubmitted, Reassigned, Field Changed, Attachment Added, Attachment Removed, Data Corrected, Notification Outcome, Hold, Resume, Completed) |
| Actor | Lookup User (nullable for System) |
| Actor Name | Text (snapshot) |
| Occurred On | DateTime |
| Field | Text |
| Old Value / New Value | Text |
| Comments | Multiline |
| Cycle | Whole |

Create-only; no update or delete.

## AdministrativeAuditEntry

Event Type (Role Changed, Approver Assignment Changed, Email Failure, Release Blocked, Other), Actor/Actor Name, Occurred On, Old Value, New Value, Reason. Create-only; Administrators only.

## Request ID
Auto-number on `CeaRequest` (proposed `CEA-YYYY-NNNNN`).

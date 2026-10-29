# Data Model: Email Notifications

## NotificationRequest

| Column | Type |
|---|---|
| Event Type | Choice (Submitted, Resubmitted, Released, Approved Next Level, All Approved, Rejected, Returned, Final Completed, Approver Reminder, Creator Reminder, Alert Blocked, Alert On Hold, Alert Delivery Failure, Alert Invalid Recipient) |
| Request | Lookup CeaRequest |
| Recipient Group | Choice (Administrators, Creator, Approver) |
| Recipient | Lookup User (nullable for Administrators) |
| Comments | Multiline (for rejection/return) |
| Event Id | Text (groups consolidation) |
| Status | Choice (Queued, Sent, Failed, Skipped) |

## NotificationOutcome
Notification Request, Recipient, Sent On, Attempts, Result (Sent, Failed, Skipped), Reason.

## EmailTemplate
Event Type, Subject, Body (English), Expected Action text.

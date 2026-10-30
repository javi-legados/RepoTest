# Flow tests (Spec 9 / Spec 8)

Flows: `SendPendingEmails`, `PendingReminders` (see `solution/CEAPlatform/Flows/`).

Run checks (manual, via the flow run history):
- Per event: trigger the event (`tests/api/notification-rules.mjs`) and confirm a `CEA - Send Pending Emails (Outlook)` run Succeeded and the mail arrived.
- Forced failure / retry: disable the Outlook connection, trigger an event, re-enable and call `cea_ProcessNotifications`.
- Invalid address: a recipient without a valid email must produce a Skipped outcome and no flow send.
- Scheduler: `CEA - Process Notifications (scheduled)` runs hourly and must show Succeeded.

Verified 2026-10-29: a test email left in Pending Send by Dataverse was delivered by the Outlook flow.

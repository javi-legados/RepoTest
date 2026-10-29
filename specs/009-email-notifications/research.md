# Research: Email Notifications

| # | Decision | Rationale | Alternatives |
|---|---|---|---|
| R1 | Queue table `NotificationRequest` written by the workflow actions; a flow triggered on create dispatches | Decouples workflow from delivery (FR-009) | Direct send from plug-in |
| R2 | Office 365 Outlook connector "Send an email (V2)" using a service account | Standard connector | Dataverse email, SMTP |
| R3 | Recipients resolved by role group; administrators expanded to each active administrator individually | FR-010 | Shared mailbox |
| R4 | Consolidation: flow groups pending requests by recipient and event id before sending; one email lists all expected actions | FR-013 | One per role |
| R5 | Pre-send check: active user and valid email format; otherwise no send, outcome recorded with reason, alert to administrators | FR-008/FR-012 | Send anyway |
| R6 | Retry policy on the send action (e.g. 3 attempts with exponential backoff), then outcome Failed and administrator alert | FR-009 | Manual resend |
| R7 | Templates stored in `EmailTemplate` (English), each with the request id, expected action and link | FR-007/FR-011 | Hard-coded in flow |
| R8 | Reminders and alerts of other specs are just additional event types in the same queue | FR-006 | Separate flows |
| R9 | Alert emails to administrators about failures do not themselves create failure alerts (loop guard) | Reliability | None |
| R10 | Request link opens the model-driven app form; if the recipient cannot see the request the email contains only the identifier | Edge case | Full details |

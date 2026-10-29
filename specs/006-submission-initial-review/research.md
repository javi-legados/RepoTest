# Research: Submission and Initial Review

| # | Decision | Rationale | Alternatives |
|---|---|---|---|
| R1 | Status changes only through custom actions `SubmitRequest`, `ReleaseToApproval`, `ReturnToCreator` | Single enforcement point | Editable status column |
| R2 | Submit validates Spec 4 rules, active administrator exists, and status = Draft; double submit prevented because the status check and update run in one transaction | FR-001/FR-008 | UI disable button |
| R3 | Initial Review row created at submit with Open state; the first completed action closes it; later attempts fail on state check with optimistic concurrency | FR-004 | Reservation/lock |
| R4 | Release calls the Spec 3 resolution and blocks if the first approver is missing or inactive; request stays in Initial Review and a notification request goes to administrators naming the missing level | FR-007 | Skip level |
| R5 | Return requires comments, sets status Rejected-for-correction (Creator-editable), records the review; resubmission creates a new Initial Review | FR-011 | Silent return |
| R6 | Administrators may review their own requests; Spec 2 self-approval guard does not apply to Initial Review | FR-012 | Block |
| R7 | Submission and release each create a notification request record consumed by Spec 9 | FR-010 | Direct email here |
| R8 | Status and last-change date columns shown on the form header | FR-009 | Separate view |
| R9 | Submission without attachments allowed | Assumption | Require attachments |

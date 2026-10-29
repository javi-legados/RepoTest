# Research: Rejection and Revision Review

| # | Decision | Rationale | Alternatives |
|---|---|---|---|
| R1 | Revision Review is an `InitialReview` row with `Review Type = Revision` (table may be named Review) | Same rules (FR assumption) | Separate table |
| R2 | `ResubmitRequest` action: same validations and active-administrator check as submit; accepts optional correction note | FR-003/FR-004/FR-012 | Reuse submit with no note |
| R3 | Release restarts the chain: new `ResolvedApprover` set for a new cycle, resolved with Spec 3 at release time; blocked if first approver missing | FR-006/FR-007 | Reuse old approvers |
| R4 | `RevisionCycle` row per rejection with rejection comments, approver, resubmission date, correction note, reviewer outcome | FR-008 | Derive from decisions |
| R5 | No limit on cycles; `Cycle` number increments | FR-010 | Cap |
| R6 | Creator deactivation while returned: flow sets On Hold and notifies administrators; administrators reassign owner | FR-011 | Auto-close |
| R7 | Creator reminder: scheduled flow after N days using the same `PlatformSetting` mechanism (key `CreatorReminderDays`, default 5 proposed) | FR-013 | Hard-coded |
| R8 | Notifications requested on resubmission, release and return | FR-009 | Direct email |
| R9 | Revision history subgrid visible to all who can open the request | FR-008 | Report |

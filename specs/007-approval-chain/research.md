# Research: Approval Chain

| # | Decision | Rationale | Alternatives |
|---|---|---|---|
| R1 | Steps are the `ResolvedApprover` rows (Spec 3); Current Level on the request points to the active step | Reuse | New step table |
| R2 | `ApproveStep` advances to the next non-skipped level, or sets status Approved and notifies administrators after the last | FR-001/FR-003 | Flow-driven advance |
| R3 | `RejectStep` requires comments, marks prior approvals Invalidated (rows kept), returns request to the Creator, resets steps for restart after revision | FR-004 | Delete approvals |
| R4 | Decision caller must equal the current step approver; decided levels cannot be decided again | FR-002/FR-011 | UI only |
| R5 | Skipped levels (Creator is approver, or not applicable) marked Skipped and logged | FR-005 | Auto-approve |
| R6 | First completed decision wins via optimistic concurrency on the step row; second gets a clear message | FR-014 | Locking |
| R7 | Deactivated approver or lost role: flow sets request On Hold at that level and notifies administrators; reassignment (Spec 3) resumes | FR-012 | Auto-reassign |
| R8 | Reminders: scheduled daily flow finds steps pending ≥ N days and requests a reminder; N stored in `PlatformSetting` editable by administrators; default 3 days proposed | FR-013 (value of N left to plan) | Hard-coded |
| R9 | Decision history subgrid visible to all who can open the request | FR-009 | Separate report |
| R10 | Notifications requested after each approval, final approval, rejection | FR-010 | Direct email |

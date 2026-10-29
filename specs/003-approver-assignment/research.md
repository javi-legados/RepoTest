# Research: Approver Assignment

| # | Decision | Rationale | Alternatives |
|---|---|---|---|
| R1 | `ApproverAssignment` table (BU, Role Type, User, State); unique on BU + Role Type for active rows via alternate key | One Plant Manager per plant, one Regional Approver per region | Column on BU (no history) |
| R2 | Assignable users filtered to active users with CEA Internal Approvals | FR-002 | Free choice |
| R3 | Direct manager resolved by matching Manager Email to an active user with the role | FR-003 | Lookup on user |
| R4 | Resolution plug-in at submission writes `ResolvedApprover` rows per applicable level and rejects when one is missing | Synchronous block (FR-006) | Flow |
| R5 | Level applicability by Creator BU level: Plant → 3 levels; Region → manager + Regional; Company/Enterprise → manager only | Spec Edge Cases | Always 3 |
| R6 | Same person on several levels creates separate `ResolvedApprover` rows with separate decisions | FR-005 | Merge levels |
| R7 | Approver change flow updates undecided `ResolvedApprover` rows and logs each update; decided rows untouched | FR-011 | Recompute all |
| R8 | Reassignment via bound action requiring a reason; creates `ReassignmentRecord` | FR-008/FR-009 | Direct edit |
| R9 | Concurrent assignment edits: last save wins with optimistic concurrency (row version) | Edge case | Locking |
| R10 | "Missing approvers" view for BUs without active assignment | FR-007 | Report |

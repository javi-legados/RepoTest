# Research: Audit and History

| # | Decision | Rationale | Alternatives |
|---|---|---|---|
| R1 | Custom `HistoryEntry` table instead of Dataverse auditing alone | Readable, filterable, role-aware, includes comments and decisions | Platform audit only |
| R2 | Platform auditing also enabled on request tables as a backup | Low cost; extra evidence | None |
| R3 | History writer helper called by every action in Specs 3–10 inside the same transaction | No missed events (SC-001) | Triggers per table |
| R4 | Field/attachment change capture starts at submission: plug-in skips status Draft and Returned-before-first-submit rows, writes only from Pending Initial Review on | Clarification (drafts not recorded) | Record all |
| R5 | Create-only: no update/delete privilege for any role, plus a guard that rejects update/delete | FR-006 | Roles only |
| R6 | Person stored as lookup and as text snapshot of the name | FR-009 | Lookup only |
| R7 | System events are entries with Actor = System | FR-001 | Omit |
| R8 | Visibility inherits the request; read-only users (Spec 2) see the full timeline including comments | FR-007 | Hide comments |
| R9 | `AdministrativeAuditEntry` visible only to Administrators | FR-008 | Visible to all |
| R10 | Indefinite retention: no bulk delete or retention jobs; Draft deletion removes its draft-time records | FR-010 | Archive job |
| R11 | No export: no export-to-Excel privilege on the history tables; timeline on screen only | FR-011 | Allow export |
| R12 | Request ID format proposed as `CEA-YYYY-NNNNN` via auto-number (Spec 4 defers the format here, but this spec does not define it; to confirm with the user) | Spec 4 assumption | GUID |

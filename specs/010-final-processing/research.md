# Research: Final Processing

| # | Decision | Rationale | Alternatives |
|---|---|---|---|
| R1 | Last approval sets status Final Processing (instead of only Approved) and queues notification | FR-001/FR-008 | Separate approved state |
| R2 | Queue = system view filtered by status Final Processing, with approval date and Creator | FR-001/SC-004 | Report |
| R3 | Final package files reuse `RequestAttachment` with `Package = Final`; Spec 5 rules apply per package | FR-003/FR-013 | New table |
| R4 | Only Administrators may add to the Final package and call `CompleteRequest` | FR-005 | UI-only |
| R5 | Direct corrections: plug-in on update of request/cost/forecast rows during Final Processing writes `DataCorrectionRecord` (field, old, new, person, date); approvals untouched | FR-011 | Re-approval |
| R6 | Concurrent edits: optimistic concurrency (row version) rejects stale updates with a message | FR-012 | Locking |
| R7 | `CompleteRequest` requires confirmation parameter, works with or without final files, records Completed By/On, sets Completed | FR-004/FR-009/FR-010 | Auto-complete |
| R8 | Completed lock: plug-in rejects any create/update/delete on request, child and attachment rows when Completed, for every role | FR-010 | Security role removal |
| R9 | Creator and authorized users read Completed request and Final files via normal visibility | FR-007 | Separate share |
| R10 | Administrator who is Creator may complete their own request | Edge case | Block |

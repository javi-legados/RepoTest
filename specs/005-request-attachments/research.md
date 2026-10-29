# Research: Request Attachments

| # | Decision | Rationale | Alternatives |
|---|---|---|---|
| R1 | `RequestAttachment` table with a File column, one row per file | Native storage and security | Notes/annotations (older, weaker limits) |
| R2 | Standard sub-grid with file upload; a PCF multi-file uploader only if testing shows the standard control cannot upload several files per action | FR-002; standard first | Custom component by default |
| R3 | Size limit 25 MB set on the File column maximum, mirrored in the validation plug-in | FR-007 | UI check only |
| R4 | Type check by extension and MIME against the closed list | FR-007 | Block list |
| R5 | Count ≤ 20 and unique name per request checked in plug-in; invalid files rejected individually so valid files in the same batch still attach | FR-007 | Reject whole batch |
| R6 | Add/remove allowed to Creator only in Draft or Rejected; Administrators may add in any status; approvers and read-only users have read only | FR-004/FR-005 | UI-only locking |
| R7 | Visibility inherits the request via parental relationship cascade | FR-006 | Separate rules |
| R8 | Cascade delete from Draft request to attachments | FR-009 | Orphan cleanup job |
| R9 | Files never transformed by plug-ins or flows | FR-010 | None |

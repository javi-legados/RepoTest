# Research: Security Roles and Business Unit Access

| # | Decision | Rationale | Alternatives |
|---|---|---|---|
| R1 | Four custom Dataverse security roles; users get role combinations (union of privileges) | Native, matches FR-001/FR-013 | One role with flags (unsafe) |
| R2 | Visibility by BU: Parent/Child BU depth on request read privilege for Creators-owned, Approvals (read-only) and Administrators at organization depth | Native hierarchy: Enterprise > Company > Region > Plant | Custom filtering (not enforced) |
| R3 | Internal approvers see a request only while it is at their step or after they decided: grant record access through access/owner teams or per-record sharing, managed by the workflow when a level starts and kept after the decision | Least privilege (Clarification 1); standard sharing | Parent/Child depth read (shows too much) |
| R4 | Guard for self-approval, step ownership and mandatory comment: synchronous plug-in on the decision table; self-approval step is auto-skipped by the workflow and recorded | Must block the action server-side | Flow only (cannot block) |
| R5 | Creator edit lock: status-based; Creator role has write privilege only through the Draft/Rejected state, enforced by plug-in/column security plus owner-only read | Spec FR-002/FR-003 | UI form locking only |
| R6 | Read-only role: read privilege only, no create/write/delete/append on request, attachment and decision tables | FR-007 | None |
| R7 | Administrators: org-wide read, write for requests, no privilege on chain decision rows; decisions at Initial/Revision Review recorded in dedicated review tables | FR-009 | Admin as superuser (breaks segregation) |
| R8 | Users without a role or BU: no app access (model-driven app requires role; BU is mandatory) | FR-012 | None |
| R9 | Role/BU change effective immediately: Dataverse evaluates privileges per request; a flow flags pending requests for reassignment | FR-016/FR-017 | Deferred sync |
| R10 | Denied attempts logged in `AccessDenialRecord` by the plug-in on rejection (written outside the failing transaction) | FR-015 | Platform audit only (does not log denials) |
| R11 | Amend the constitution wording about read-only visibility | Spec 2 override | Leave inconsistent |

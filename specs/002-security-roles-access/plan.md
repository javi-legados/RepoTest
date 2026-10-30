# Implementation Plan: Security Roles and Business Unit Access

**Branch**: `002-security-roles-access` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Implement the four CEA security roles and Business Unit based visibility with native Dataverse security (roles, privilege depth, Business Units, owner-team access). Rules that standard security cannot express (approver sees only requests at their step or decided by them; no self-approval; Creator cannot edit after submit; comment required on decisions) are enforced server-side through status-based field/record locking and a synchronous plug-in or Dataverse low-code plug-in, never only in the UI.

## Technical Context

**Language/Version**: Dataverse security roles and BU configuration; Power Automate; C# plug-in only for rules that cannot be expressed declaratively (R3, R4)
**Primary Dependencies**: Dataverse security model, Access Teams / Team templates, auditing
**Storage**: Dataverse; `Access Denial Record` table
**Testing**: Test users per role and per BU level (Enterprise, Company, Region, Plant); Web API checks of denied operations; steps in quickstart.md
**Target Platform**: Power Platform environment
**Project Type**: Power Platform solution (extends `CEAPlatform` from Spec 1)
**Performance Goals**: Visibility checks add no perceptible delay (list load under 3 s)
**Constraints**: Permissions evaluated on every action; changes effective immediately; enforced outside the UI
**Scale/Scope**: 4 roles, 4 BU levels, up to 500 users

## Constitution Check

| Principle / Constraint | Status | Notes |
|---|---|---|
| Standard capabilities first | Pass | Security roles, BU depth, access teams |
| Justify complexity | Pass | Plug-in limited to R3/R4 and logged in Complexity Tracking |
| Rules enforced by the system | Pass | Server-side only |
| Immutable history | Pass | Denials and skips recorded |
| Roles | Pass | Exactly four roles |
| Stale item | Note | Constitution says read-only role sees "all records"; this spec (Clarifications) limits it to its own BU hierarchy. Constitution should be amended at next revision |

## Project Structure

### Documentation

```text
specs/002-security-roles-access/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── permission-matrix.md
```

### Source Code

```text
solution/CEAPlatform/
├── SecurityRoles/        # CEA Creators, CEA Internal Approvals, CEA Approvals, CEA Administrators
├── Tables/               # AccessDenialRecord
├── Flows/                # Deny logging, reassign-flagging on role/BU change
└── Plugins/              # Self-approval and step-ownership guard (justified)
tests/api/                # Permission matrix checks per role
tests/ui/                 # Visibility per BU level
```

**Structure Decision**: Roles live in the same solution; matrix is the contract tested in `tests/api`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Plug-in for step-ownership and self-approval guard | "Only at their step" and "never own request" are not expressible by privilege depth | Flows are asynchronous and cannot block the action |
| Plug-in list is `DecisionGuard.cs` only (skeleton, enabled in Spec 5) | Same as above | Confirmed against the final plug-in list (T034) |


## Implementation notes (decision guard)
- DecisionGuard (PreValidation, stage 10) on cea_ApproveStep/cea_RejectStep records Access Denial Records outside the transaction; Custom APIs recreated with AllowedCustomProcessingStepType=2 (create-only field).
- Spec 2 FR-005 (comment required on approve and reject) supersedes the Spec 7 comment-on-reject-only rule.
- Admin-only decision block (T026) is enforced in code but not covered by an API test: the test application user cannot create requests without a creator role.

- Roles verified against Dataverse (RetrieveRolePrivilegesRole): Creators Basic on request/attachment (Delete and Write granted; edit lock is a plug-in); Internal Approvals and Approvals Read/AppendTo Deep on request, attachment and decision, with no create/write/delete; Administrators Global on request/attachment, Read-only on decisions, Read on cea_accessdenialrecord. Roles are provisioned by tools/provision-001-roles.mjs and provision-002.mjs, not XML files. Read-only Deep is used for Internal Approvals (needed to open the request they decide); no separate comment table exists, so T012 stays open.

- T010 edit lock: RequestRules (header) plus new LineEditLock (PreValidation on cost/forecast lines) allow non-admin changes only in Draft, Rejected or Returned to Creator; attachments already covered by AttachmentRules. Implemented as a plug-in only (no column security profile). Not covered by API tests for non-admin users (test users are admins).
- T011: delivered as the form script solution/CEAPlatform/ModelDrivenApp/requestForm.js (applyLock disables all header fields outside Draft/Rejected/Returned; showRejection shows the latest rejection comments as a form notification) instead of business rules, which cannot lock a whole form. Subgrid commands stay enabled and are covered by the server-side locks (Spec 5 T017 tracks hiding them).
- T014: implemented as plug-in GrantApproverAccess (PostOperation Update of cea_request, filter cea_pendingapproverid) that grants Read + AppendTo on the request to the new pending approver; the share is never revoked. Plug-in instead of a flow for transactional reliability; per-record sharing covers approvers outside the Deep read scope. Child records (lines, attachments) rely on relationship cascade sharing.
- T021: implemented as plug-in ApproverReassignmentFlag (PostOperation: Update of systemuser filtering businessunitid; Disassociate of systemuserroles_association for CEA Internal Approvals / CEA Approvals). Sets cea_needsreassignment on the user's undecided Pending/On Hold steps; history is untouched. Not covered by an automated test: application users cannot hold roles and moving the shared test user between Business Units would strip its roles. Clearing the flag on reassignment is not implemented here.
- T029: delivered as tests/api/security/permission-matrix.mjs (Node, 13 checks on real role privileges) instead of PowerShell; denied-attempt Access Denial Records are covered in approval-chain-rules.mjs. T024 stays open: privileges already make Approvals read-only, but no dedicated history/approvals app area exists in the sitemap.
- T024 (update): tools/provision-002-app.mjs adds Approval Decisions and Attachments to the CEA Admin app sitemap alongside Requests, Resolved Approvers and All History. Read-only for CEA Approvals is enforced by privileges (permission-matrix.mjs); not checked in a browser.


> Nota T012: no existia tabla de comentarios; se habilitaron Notes (HasNotes) en cea_request, el Creator recibe Create/Read/Write/Append/AppendTo de Note a nivel Basic (solo sus propias solicitudes), Administradores Global y aprobadores Read Deep, y el formulario de request tiene la pestana Comments. Aprovisionado con tools\provision-002-comments.mjs.

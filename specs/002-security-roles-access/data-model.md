# Data Model: Security Roles and Business Unit Access

Extends [Spec 1 data model](../001-users-master-data/data-model.md).

## Security Role (Dataverse)
CEA Creators, CEA Internal Approvals, CEA Approvals, CEA Administrators. A user has at least one; roles are cumulative.

## User Assignment
User (Spec 1) + role assignments + exactly one Business Unit. No role or no BU → no access.

## Access Denial Record

| Column | Type |
|---|---|
| User | Lookup |
| Action | Choice (Approve, Reject, Edit, Create, Upload, Other) |
| Request | Lookup (nullable until Spec 4 table exists) |
| Reason | Text |
| Occurred On | DateTime |

Create-only for the platform; read for Administrators.

## Request record access rules (applied to tables of Specs 4–7)

| Role | Read | Write | Decide |
|---|---|---|---|
| Creator | Own | Own, Draft/Rejected only | No |
| Internal Approval | At own step or decided by self, within BU hierarchy | None | Own step, comment required |
| Approvals | BU hierarchy | None | No |
| Administrator | All | Requests, attachments, comments | Initial/Revision Review only |

## Flags
Request gets a `Needs Reassignment` flag (Two Options) set when an approver's role or BU changes with pending decisions (FR-017).

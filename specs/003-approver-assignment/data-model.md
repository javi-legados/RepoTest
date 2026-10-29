# Data Model: Approver Assignment

Extends Specs [1](../001-users-master-data/data-model.md) and [2](../002-security-roles-access/data-model.md).

## Approver Assignment
| Column | Type | Rules |
|---|---|---|
| Business Unit | Lookup | Plant or Region level |
| Role Type | Choice | Plant Manager, Regional Approver |
| Approver | Lookup User | Active, CEA Internal Approvals |
| State | Active/Inactive | One active per BU + Role Type |

## Approval Level (Choice)
1 Direct Manager, 2 Plant Manager, 3 Regional Approver.

## Resolved Approver (per request)
| Column | Type |
|---|---|
| Request | Lookup |
| Level | Choice |
| Approver | Lookup User |
| Decided | Two Options |
| Skipped | Two Options (Creator is the approver) |
| Needs Reassignment | Two Options |

Unique per Request + Level.

## Reassignment Record
Request, Level, Previous Approver, New Approver, Reason (required), Changed By, Changed On. Create-only. Automatic propagation updates are logged in the same table with Reason = "Approver changed".

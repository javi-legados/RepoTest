# Data Model: Users and Master Data

Shared base for all later specs (they reference this file).

## User (extension of Dataverse System User)

| Column | Type | Rules |
|---|---|---|
| SAP Number | Text | Required, unique (alternate key) |
| Full Name | Text | Required |
| Email | Text | Required, unique (alternate key), valid format |
| Department | Text | Required |
| Manager Name | Text | Required |
| Manager Email | Text | Required, valid format; may be unregistered (warning) |
| Business Unit | Lookup (BU) | Required, exactly one |
| Roles | Security role assignments | At least one |
| State | Active / Inactive | Deactivation blocked with open requests or pending decisions |

Validation: user cannot be their own manager; record flagged "incomplete" if any mandatory attribute is missing.

## Business Unit (Enterprise > Company > Region > Plant)

Native BU tree. Extra columns: Level (Enterprise/Company/Region/Plant), State. Cannot be deleted when in use; can be deactivated; inactive entries are not offered for new assignments.

## Plant, Region, Company (catalog)

| Column | Type | Rules |
|---|---|---|
| Name | Text | Required, unique within parent |
| Parent | Lookup | Plant → Region → Company |
| Business Unit | Lookup | Link to the BU node |
| State | Active / Inactive | Delete restricted when referenced |

## User Change Record

| Column | Type |
|---|---|
| User | Lookup |
| Changed By | Lookup |
| Changed On | DateTime |
| Field | Text |
| Old Value / New Value | Text |

Immutable: create-only; no update or delete privilege for any role.

## Relationships

User N:1 Business Unit; Business Unit 1:N Plant/Region/Company by level; User 1:N User Change Record.

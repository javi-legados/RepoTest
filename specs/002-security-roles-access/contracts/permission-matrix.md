# Contract: Permission Matrix

| Capability | Creator | Internal Approval | Approvals (read-only) | Administrator |
|---|---|---|---|---|
| Create request / attachments | Yes | No | No | Yes |
| Edit own request | Draft, Rejected | No | No | Yes |
| View | Own | Own step or decided, in BU | All in BU | All |
| Approve/Reject chain step | No | Own step, comment | No | No |
| Initial / Revision Review decision | No | No | No | Yes, comment (one is enough) |
| Add comments | Own | With decision | No | Yes |
| Manage roles, reference data, reassign | No | No | No | Yes |

Rules: no one decides on their own request (step skipped and recorded); every denied action creates an Access Denial Record; role/BU changes apply immediately.

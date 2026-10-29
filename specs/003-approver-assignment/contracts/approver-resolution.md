# Contract: Approver Resolution

Input: Creator and request at submission. Output: list of Resolved Approver rows.

| Creator BU level | Levels resolved |
|---|---|
| Plant | Direct Manager, Plant Manager, Regional Approver |
| Region | Direct Manager, Regional Approver |
| Company / Enterprise | Direct Manager |

Errors (submission blocked, message names the level): manager not registered or lacking the role; no active Plant Manager; no active Regional Approver; approver inactive.
If an approver equals the Creator, the level is marked Skipped and recorded.

Reassign action: inputs Request, Level, New Approver (valid), Reason (required); effect: updates the row, writes a Reassignment Record.

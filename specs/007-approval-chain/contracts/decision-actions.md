# Contract: Decision Actions

| Action | Caller | Inputs | Preconditions | Effect |
|---|---|---|---|---|
| ApproveStep | Approver of current level | Request, Comments (optional) | Caller is current approver; step Pending | Decision recorded; next level or Approved; notification requested |
| RejectStep | Approver of current level | Request, Comments (required) | Same | Decision recorded; prior approvals Invalidated; request returned to Creator; notification to Creator |

Errors: not your level, level already decided (first wins), empty rejection comments, read-only or Creator-only role.
Scheduled: reminder after N days pending; hold when approver inactive or role lost.

# Contract: Notification Events

| Event | Recipients | Content |
|---|---|---|
| Submitted / Resubmitted | Each active administrator | Request id, review needed, link |
| Released | First approver | Approval needed, link |
| Approved (non-final) | Next approver | Approval needed, link |
| All approvals complete | Administrators and Creator | Final processing started / package being prepared |
| Rejected | Creator | Rejection comments |
| Returned by administrator | Creator | Comments |
| Final processing completed | Creator | Completion (Spec 10) |
| Reminder | Pending approver / Creator after N days | Pending action |
| Alert (blocked release, hold, delivery failure, invalid recipient) | Each active administrator | Cause |

Rules: English only; each email names the request and the expected action and links to it; one consolidated email per person and event; no send to inactive or invalid recipients (reason recorded, administrators alerted); retries on failure; workflow never blocked.

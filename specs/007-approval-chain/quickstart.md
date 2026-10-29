# Quickstart: Validating the Approval Chain

1. Release a request from a Plant Creator; Manager approves → Plant Manager level; then Regional; final approval sets Approved and notifies administrators.
2. Region Creator skips the Plant Manager level; Company Creator only has the Manager level.
3. Make the Plant Manager the Creator of a request → level skipped and recorded.
4. Same person manager and Plant Manager → two separate decisions.
5. Reject without comments → blocked; with comments → request returns to the Creator, prior approvals marked invalidated but still visible.
6. Two approvers decide at once → first wins; second sees a clear message.
7. Deactivate the pending approver → request On Hold, administrators notified; assign a new approver → resumes.
8. Set N = 1 and wait → reminder requested once; no auto-approval.
9. Read-only user and Creator cannot approve (API denies).
10. Approver sees the full decision history.

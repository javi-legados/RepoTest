# Quickstart: Validating Audit and History

1. Run a request through submit, reject, resubmit, release, approvals and completion → every event appears in order with person, date and comments.
2. Edit fields as Draft → nothing recorded; edit after submission → field, old and new value recorded.
3. Add and remove attachments after submission → recorded with file name.
4. Correct approved data in Final Processing → recorded.
5. Try to edit or delete a history entry as every role and via API → denied.
6. Deactivate an approver → their name remains in old entries.
7. As read-only user open a visible request → full timeline with comments; invisible request denied.
8. As administrator open the administrative audit → role/assignment changes, failed emails, blocked releases; non-administrators cannot see it.
9. Confirm there is no export option on the history.

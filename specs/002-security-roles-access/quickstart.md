# Quickstart: Validating Security and Access

1. Create one test user per role and one per BU level (Enterprise, Company, Region, Plant).
2. Creator: create and submit a request; edit is blocked; other Creators' requests are not visible.
3. Internal approver: sees only requests at their step or already decided; empty comment on decision is blocked; cannot create or edit.
4. Approvals user: open requests in their BU hierarchy; no action available; requests outside are not visible.
5. Administrator: sees all; approves at Initial Review; approve/reject not available at chain steps.
6. Make a Creator the approver of a step: the step is skipped and appears in history.
7. Move a user to another BU and remove a role: effect is immediate in an open session; affected requests are flagged.
8. Attempt a forbidden action through the Web API: rejected and an Access Denial Record exists.
9. Sign in with a user without role/BU: no access.

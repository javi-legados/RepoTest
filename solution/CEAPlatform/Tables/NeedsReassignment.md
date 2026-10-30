# Needs Reassignment (Spec 2)

When an approver loses their approver role or is deactivated while holding pending requests, those requests are flagged "Needs Reassignment" instead of being silently reassigned.

Status: the request tables (Specs 4-7) do not exist yet. The flag column and the logic are added with Spec 4/5; `UserDeactivationGuard.cs` already contains the hook (`RequestTablesAvailable = false`).

Related: `cea_accessdenialrecord` (created by `tools/provision-002.mjs`) logs denied actions.

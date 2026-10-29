# Implementation Plan: Audit and History

**Branch**: `011-audit-history` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

One append-only `HistoryEntry` table written by the workflow actions and plug-ins of Specs 3–10 (status changes, decisions, skips, corrections, attachment changes after submission, notification outcomes) plus an `AdministrativeAuditEntry` table for role and approver-assignment changes and system events. Both are create-only for every role. A timeline subgrid on the request form shows the full history; an administrator-only view lists administrative and system events. No export and no purge.

## Technical Context

**Language/Version**: Dataverse tables and security; C# plug-in step shared with other specs; Power Automate for notification and system events
**Primary Dependencies**: Specs 1–10; Dataverse auditing as a complementary platform log
**Storage**: `HistoryEntry`, `AdministrativeAuditEntry`
**Testing**: Web API tests for create-only enforcement, per-event entry checks, draft exclusion, deactivated-user name retention, quickstart.md
**Target Platform**: Power Platform environment
**Project Type**: Power Platform solution
**Performance Goals**: History opens in under 1 minute; list loads under 3 s for long histories (server paging)
**Constraints**: Immutable; indefinite retention; on-screen only; draft changes not recorded
**Scale/Scope**: Hundreds of entries per request at most

## Constitution Check

| Principle / Constraint | Status | Notes |
|---|---|---|
| Standard capabilities first | Pass | Tables, subgrid, security roles |
| Justify complexity | Pass | Shares the existing plug-in assembly |
| Rules enforced by system | Pass | No update/delete privilege and plug-in guard |
| Complete immutable history | Pass | This spec delivers it |

## Project Structure

```text
specs/011-audit-history/
├── plan.md  research.md  data-model.md  quickstart.md
└── contracts/history-events.md
solution/CEAPlatform/
├── Tables/    # HistoryEntry, AdministrativeAuditEntry
├── Plugins/   # History writer helper, immutability guard
├── Flows/     # System events (failed email, blocked release)
└── ModelDrivenApp/  # History timeline, administrative audit view (administrators only)
tests/api/
```

**Structure Decision**: Every other spec calls the same history writer helper.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Immutability guard plug-in | Privilege removal alone cannot stop system-level edits or deletes | Security roles only |

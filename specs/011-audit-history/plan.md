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

## Implementation deviations (dev environment)
- Implemented with plug-ins in one file (History.cs) instead of separate files: HistoryImmutabilityGuard, HistoryCreated, HistoryStatusCapture, HistoryFieldChangeCapture, HistoryAttachmentCapture, AdminAuditAssignment; the history helper is HistoryWriter. Rejected/Returned entries are written by their actions (they carry comments).
- Status, level, pending approver and cycle are not logged as field changes (they already produce status events).
- Not wired: Role Changed admin entries (UserChangeRecorder keeps its own table); Release Blocked / Alert Blocked entries cannot persist because the failing transaction rolls back. Attachment Removed is wired but untested via API (admin cannot remove attachments).
- Tests: tests/api/history-rules.mjs.


## Notas de implementación (cierre)
- T008: auditoría de plataforma habilitada en cea_request (IsAuditEnabled = true).
- T013/T021: verificado en Dev: historyentry solo tiene Read para Administrators, Creators, Internal Approvals y Approvals; administrativeauditentry solo Read para CEA Administrators.
- T018: vista 'Administrative Audit' y entrada de sitemap en la app de administración (provision-011.mjs).
- T020: resultados de notificación y Email Failure se registran desde Notifications.cs (HistoryWriter.Write/Admin), no con un flujo.
- T025: Complexity Tracking actualizado: plug-ins HistoryImmutabilityGuard, HistoryCreated, HistoryStatusCapture, HistoryFieldChangeCapture, HistoryAttachmentCapture, AdminAuditAssignment y la clase compartida HistoryWriter, todos en el ensamblado existente.
- T019: solo se registran cambios de asignación de aprobadores; los cambios de rol no se registran (pendiente).
- T022/T023: parcialmente cubiertos por tests\api\history-rules.mjs (10 PASS).

- T019 (actualizado): nuevo plug-in AdminAuditRoleChange (Associate/Disassociate user<->role) escribe Role Changed vía HistoryWriter.Admin.
- T022/T023: tests\api\history-audit-rules.mjs (10 PASS) + history-rules.mjs (10 PASS): inmutabilidad, roles, actor/fecha en 100%, sin privilegio de exportación.

# Implementation Plan: Rejection and Revision Review

**Branch**: `008-rejection-revision-review` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Reuse the Spec 6 review mechanism for the Revision Review: a rejected request returns to the Creator (editable), `ResubmitRequest` sends it to a new review of type Revision, and release restarts the chain from the first applicable level with approvers resolved at release time. Cycles are recorded in a `RevisionCycle` table. Hold on Creator deactivation and the N-day Creator reminder use Power Automate flows and the `PlatformSetting` table of Spec 7.

## Technical Context

**Language/Version**: Dataverse custom action + C# plug-in (shared with Spec 6); Power Automate
**Primary Dependencies**: Specs 3, 6, 7; Spec 9 (notifications); Spec 11 (history)
**Storage**: `RevisionCycle` table; `ReviewType` on the review table
**Testing**: Web API tests of several cycles, deactivated Creator and approver cases, quickstart.md
**Target Platform**: Power Platform environment
**Project Type**: Power Platform solution
**Performance Goals**: Same as Spec 6
**Constraints**: No cycle limit; no auto-close; approvers resolved at release
**Scale/Scope**: Unbounded cycles per request

## Constitution Check

| Principle / Constraint | Status | Notes |
|---|---|---|
| Standard capabilities first | Pass | Reuses Spec 6 actions and tables |
| Justify complexity | Pass | No new plug-in; extends Spec 6 |
| Rules enforced by system | Pass | Actions only |
| Immutable history | Pass | Cycles append-only |
| Every status change sends an email | Pass | Notification requests |

## Project Structure

```text
specs/008-rejection-revision-review/
├── plan.md  research.md  data-model.md  quickstart.md
└── contracts/revision-actions.md
solution/CEAPlatform/
├── Tables/    # RevisionCycle
├── Plugins/   # ResubmitRequest (extends Spec 6 plug-in assembly)
├── Flows/     # Creator hold, Creator reminder
└── ModelDrivenApp/  # Revision history subgrid
tests/api/
```

**Structure Decision**: Same plug-in assembly as Spec 6; no new component types.

## Complexity Tracking

No violations.

## Deviation note (implementation)
- Plug-ins and Custom APIs replace flows: cea_ResubmitRequest extends the Spec 6 action classes (Submit/Return/Release handle Review Type = Revision); the rejection (Spec 7 RejectStep) writes the cea_revisioncycle row.
- Status values reuse Spec 6/7 values: 5 Revision Review, 9 Returned to Creator, 8 On Hold (Creator inactive uses the same On Hold value as approver hold, told apart by an empty Pending Approver). CreatorHold plug-in holds on user deactivation and resumes when an administrator reassigns the request to an active user.
- Deferred: Creator reminder flow (T015), notifications (T014/T020, Spec 9), command-bar Resubmit button (T013), rejection banner and header revision count (T010/T011 partial), edge-case test script (T025), quickstart run (T026). Tests: tests/api/revision-rules.mjs.

- Form UI (T010, T011, T013): implemented in the form script (equestForm.js) and the entity ribbon (RibbonDiff.xml): edit lock by status, rejection banner from the latest revision cycle, and Submit/Resubmit/Complete buttons shown by status (Resubmit has a confirm dialog, no correction-note prompt). Ribbon imported with pac solution pack/import; the import disables plug-in steps, so re-run register-plugins.mjs and re-enable steps afterwards.


## Notas de implementación (cierre)
- T014: CreatorHold es un plug-in (SetState de systemuser -> On Hold + alerta a administradores; reasignación reanuda). No es un flujo de Power Automate.
- T020: notificaciones vía Notifier.Enqueue en SubmissionActions (Resubmitted, Released, Returned).
- T025: cubierto en tests\api\revision-rules.mjs (12 PASS); recordatorio único cubierto por notification-rules (Spec 9). El caso de Creator desactivado no se prueba de forma automática (requiere desactivar un usuario real).

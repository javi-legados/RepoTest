# Implementation Plan: Approval Chain

**Branch**: `007-approval-chain` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Drive the sequential chain (Manager → Plant Manager → Regional Approver) using the `ResolvedApprover` rows of Spec 3 as steps. Approve and reject are custom actions with a plug-in that checks level ownership, mandatory comment, concurrency (first completed decision wins) and advances the status. Rejection invalidates prior approvals and returns the request; deactivated-approver hold and N-day reminders are handled by scheduled Power Automate flows.

## Technical Context

**Language/Version**: Dataverse custom actions + C# plug-in; Power Automate (scheduled and triggered flows)
**Primary Dependencies**: Specs 2, 3, 6; Spec 8 (restart after revision); Spec 9 (notifications); Spec 11 (history)
**Storage**: `ApprovalDecision` table; step state on `ResolvedApprover`; configuration table `PlatformSetting`
**Testing**: Web API tests per level and skip case, concurrency test, hold and reminder tests, quickstart.md
**Target Platform**: Power Platform environment
**Project Type**: Power Platform solution
**Performance Goals**: Decision completes in under 3 s
**Constraints**: Fixed order; once per level; no escalation or auto-approval; N set by administrators
**Scale/Scope**: Up to 3 levels per request

## Constitution Check

| Principle / Constraint | Status | Notes |
|---|---|---|
| Standard capabilities first | Pass | Actions, flows, configuration table |
| Justify complexity | Pass | Plug-in tracked below |
| Rules enforced by system | Pass | Ownership and order server-side |
| Immutable history | Pass | Decisions and invalidations kept |
| Fixed approval order | Pass | Manager, Plant Manager, Regional |
| Every status change sends an email | Pass | Notification requests per decision |

## Project Structure

```text
specs/007-approval-chain/
├── plan.md  research.md  data-model.md  quickstart.md
└── contracts/decision-actions.md
solution/CEAPlatform/
├── Tables/    # ApprovalDecision, PlatformSetting
├── Plugins/   # ApproveStep, RejectStep
├── Flows/     # Hold on deactivation, resume on reassignment, reminders
└── ModelDrivenApp/  # My pending approvals view, decision history subgrid
tests/api/
```

**Structure Decision**: Steps are `ResolvedApprover` rows; decisions append to `ApprovalDecision`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Plug-ins for decision actions (ApproveStep, RejectStep, ChainAdvance helper, ApproverHold) | Level ownership, comments and first-wins need atomic server checks | Flows are not atomic or blocking |

## Deviation note (implementation)
- Custom APIs (cea_ApproveStep/cea_RejectStep) and C# plug-ins replace action XML and flows; hold/resume is the ApproverHold plug-in (untested: app users cannot be disabled/reassigned in dev).
- Resolved Approver gained a Request lookup and StepStatus; a reject marks prior approvals Invalidated and the chain is re-resolved at the next release.
- Decisions are owned by the request owner. Command-bar Approve/Reject buttons (visible in status 3, enabled for the pending approver) and notifications via Notifier.Enqueue (Spec 9) are now implemented.


## Notas de implementación (cierre)
- Aprobar/Rechazar son Custom APIs (cea_ApproveStep/cea_RejectStep); el comentario es obligatorio (Spec 2 FR-005).
- Notificaciones vía Notifier.Enqueue; recordatorios cubiertos por cea_ProcessNotifications y el flujo de Spec 9.
- Botones Approve/Reject en el formulario: visibles en estado 3 y habilitados solo para el aprobador pendiente. No verificado en navegador.

# Implementation Plan: Submission and Initial Review

**Branch**: `006-submission-initial-review` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Implement the submit action (full form validation, double-submit protection, requires an active administrator), the Initial Review (one administrator closes it, release or return with comments) and the release to the first approver using the resolution of Spec 3. The submit and release actions are Dataverse custom actions backed by a server-side plug-in so that validation and status changes are atomic; Power Automate handles notification requests.

## Technical Context

**Language/Version**: Dataverse custom actions + C# plug-in; Power Automate for notification requests
**Primary Dependencies**: Specs 2, 3, 4, 5; Spec 9 (notifications); Spec 11 (history)
**Storage**: `InitialReview` table; status and submission columns on `CeaRequest`
**Testing**: Web API tests of submit/release/return, concurrency test with two administrators, quickstart.md
**Target Platform**: Power Platform environment
**Project Type**: Power Platform solution
**Performance Goals**: Submit completes in under 3 s; under 1 minute for the user
**Constraints**: One administrator closes each review; no reservation; first completed action wins
**Scale/Scope**: Low volume per day

## Constitution Check

| Principle / Constraint | Status | Notes |
|---|---|---|
| Standard capabilities first | Pass | Custom actions and status choice |
| Justify complexity | Pass | Plug-in tracked below |
| Rules enforced by system | Pass | Validation in action |
| Immutable history | Pass | Each review/return recorded |
| Every status change sends an email | Pass | Notification request in the same transaction (Spec 9) |

## Project Structure

```text
specs/006-submission-initial-review/
├── plan.md  research.md  data-model.md  quickstart.md
└── contracts/actions.md
solution/CEAPlatform/
├── Tables/     # InitialReview
├── Plugins/    # SubmitRequest, ReleaseToApproval, ReturnToCreator
├── Flows/      # Notification requests
└── ModelDrivenApp/  # Initial Review queue view, command buttons
tests/api/
```

**Structure Decision**: Actions are the only way to change request status; direct status edits are denied by security (Spec 2).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Plug-in-backed actions | Atomic validation, status change and concurrency control | Flows cannot reject or lock rows |

Deviation: the actions are Dataverse Custom APIs (`cea_SubmitRequest`, `cea_ReleaseToApproval`, `cea_ReturnToCreator`) backed by plug-ins in `SubmissionActions.cs`. `RequestRules` blocks direct edits of status/submission columns and locks the request for non-administrators outside Draft, Rejected and Returned to Creator. The notification flows (T012, T018, T021, T022) are deferred to Spec 9. Release resolves the first approver as the Creator's Direct Manager (by manager email), skipping to the Plant Manager assignment when the manager is missing or is the Creator; the per-request Resolved Approver rows belong to Spec 7. Command-bar buttons (T010, T017, T020) are not built: the actions are callable through the Web API.

## Closing notes
- T010: Submit (Draft) and Resubmit (Returned) buttons exist; T017/T020: 'Return to Creator' (prompt for mandatory comments) and 'Release to Approval' buttons visible in Pending Initial Review and enabled for administrators (CEA.RequestForm.isAdmin; server enforces).
- T012/T018/T021: notification requests are written by Notifier.Enqueue inside SubmissionActions.cs (Submitted/Resubmitted, Returned, Released) instead of flows.
- T015/T025: 'Approval' tab of the CEA Request form shows Submitted By/On and an Initial Reviews sub-grid. Not browser-verified.
- T022 stays open: a blocked release rolls back its transaction, so the admin notification needs a separate mechanism.


> Nota T022/T028: una liberacion bloqueada revierte su transaccion, asi que la alerta a los administradores (AlertBlocked, con el nivel sin aprobador) la escribe la Custom API cea_NotifyReleaseBlocked que invoca el formulario tras el error (en lugar de un flujo). Las acciones de solicitud toman un bloqueo de fila al inicio (RequestAction) para serializar acciones concurrentes; tests\api\initial-review-concurrency.mjs (6 PASS) cubre doble envio y doble cierre.

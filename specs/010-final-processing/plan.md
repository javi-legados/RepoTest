# Implementation Plan: Final Processing

**Branch**: `010-final-processing` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

After the last approval the request enters Final Processing. Administrators see a queue, review approved data and history, optionally upload final package files (Spec 5 table with `Package = Final`), optionally correct approved data with every change logged, and complete the request with a confirmation. Completion is a server-side action that makes the request read-only for everyone; concurrency is first-completion-wins with edit conflict detection through row versioning.

## Technical Context

**Language/Version**: Dataverse custom action + C# plug-in (shared assembly); Power Automate for notification requests
**Primary Dependencies**: Specs 2, 4, 5, 7, 9, 11
**Storage**: Status columns on `CeaRequest`; final files in `RequestAttachment`; changes in `DataCorrectionRecord`
**Testing**: Web API tests (complete with and without files, correction logging, concurrent completion, post-completion edit), quickstart.md
**Target Platform**: Power Platform environment
**Project Type**: Power Platform solution
**Performance Goals**: Queue opens in under 3 s
**Constraints**: Completed is final; no reservation; file rules identical to Spec 5, counted separately
**Scale/Scope**: Low volume per day

## Constitution Check

| Principle / Constraint | Status | Notes |
|---|---|---|
| Standard capabilities first | Pass | View, action, existing attachment table |
| Justify complexity | Pass | Extends existing plug-in assembly |
| Rules enforced by system | Pass | Completed lock server-side |
| Immutable history | Pass | Corrections logged |
| Every status change sends an email | Pass | Notification at start and completion |

Review point: allowing direct correction of approved data without repeating approvals was decided in clarification and is flagged for user confirmation.

## Project Structure

```text
specs/010-final-processing/
├── plan.md  research.md  data-model.md  quickstart.md
└── contracts/final-actions.md
solution/CEAPlatform/
├── Tables/    # DataCorrectionRecord
├── Plugins/   # CompleteRequest, correction logger, completed-lock guard
├── Flows/     # Notification requests
└── ModelDrivenApp/  # Final Processing queue, final package subgrid
tests/api/
```

**Structure Decision**: Reuse `RequestAttachment` with the `Package` column.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Completed-lock and correction logging in plug-in | Field-level old/new capture and absolute lock must be server-side | Auditing alone is not filtered/readable by role |


## Implementation deviation (dev environment)
Implemented with plug-ins and Custom APIs: new status value 10 'Final Processing' (value 6 'Approved' is no longer set; the last approval moves directly to 10), cea_CompleteRequest API, DataCorrectionLogger (request, cost and forecast lines), CompletedLockGuard (rejects every change to the request and lines once Completed, for every role, plus attachments in AttachmentRules) and final-file rule (Package=Final only in Final Processing, admin only). Views and sitemap added. Notifications reuse Spec 9 (AllApproved at entry, FinalCompleted at completion). Not done: dedicated final form/command button, optimistic-concurrency message (T013/T025), read access of Creators to Data Correction Records. Tested by tests/api/final-processing-rules.mjs.


## Notas de implementación (cierre)
- T015: botón 'Complete' en el formulario principal (Spec 6), visible solo en estado 10 y limitado a administradores; llama a la Custom API CompleteRequest.
- T018/T019/T020: notificaciones vía Notifier.Enqueue (AllApproved a administradores y Creator al pasar a Final Processing; FinalCompleted al Creator). Sin administradores activos, el destinatario queda Skipped con alerta (Spec 9). No son flujos de Power Automate.
- T002/T003/T010/T025/T027: no se crearon carpetas ni un formulario separado; se usa el formulario principal 'CEA Request'.
- T013: la concurrencia optimista por row-version no está implementada; CompletedLockGuard bloquea ediciones tras completar y existe protección de edición en Final Processing. Pendiente.
- Resto (T021, T028) manuales/por verificar.

- T013 (actualizado): concurrencia optimista habilitada con IsOptimisticConcurrencyEnabled en cea_request, cea_costline y cea_forecastline (tools\provision-010-concurrency.mjs); una actualización con row-version obsoleta se rechaza (412) y la UI de modelo muestra el aviso de conflicto de forma nativa. Ediciones de no administradores en Final Processing ya bloqueadas por RequestRules ('locked while under review or approved'). Prueba: tests\api\final-concurrency.mjs (3 PASS).

- T021: verificado en Dev: Creators leen (Basic) cea_request, adjuntos (incl. Package=Final), historial y líneas; Administrators Global; Approvals/Internal Approvals Deep. El permiso de lectura no depende del estado, por lo que Completed sigue visible. Creators no leen cea_datacorrectionrecord, pero ven las correcciones como entradas Data Corrected en el historial.

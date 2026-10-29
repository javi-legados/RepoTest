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

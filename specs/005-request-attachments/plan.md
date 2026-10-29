# Implementation Plan: Request Attachments

**Branch**: `005-request-attachments` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Store request attachments in Dataverse as `RequestAttachment` rows with a File column, linked to `CeaRequest`. Limits (25 MB, closed type list, 20 files, no duplicate names) are enforced server-side; add/remove permission depends on request status and role. Upload UI uses the model-driven sub-grid with multi-file upload (a PCF/upload component only if the standard control cannot upload several files at once, see research R2).

## Technical Context

**Language/Version**: Dataverse File columns, business rules; C# plug-in for validation of size, type, count, duplicates
**Primary Dependencies**: Specs 2 (security) and 4 (`CeaRequest`)
**Storage**: Dataverse file storage; table `RequestAttachment`
**Testing**: Web API upload tests for each rejection case; quickstart.md
**Target Platform**: Power Platform environment
**Project Type**: Power Platform solution
**Performance Goals**: 5 files attached in under 2 minutes
**Constraints**: 25 MB per file; PDF, Word, Excel, PowerPoint, JPG, PNG, CSV, TXT, ZIP, DWG, DXF; max 20 files; file content never modified
**Scale/Scope**: Up to 20 files per request

## Constitution Check

| Principle / Constraint | Status | Notes |
|---|---|---|
| Standard capabilities first | Pass | File column, sub-grid, security roles |
| Justify complexity | Pass | Plug-in for limits (below); PCF only if needed |
| Rules enforced by system | Pass | Server-side validation |
| Immutable history | Pass | Add/remove recorded (Spec 11) |

## Project Structure

```text
specs/005-request-attachments/
├── plan.md  research.md  data-model.md  quickstart.md
└── contracts/attachment-rules.md
solution/CEAPlatform/
├── Tables/      # RequestAttachment
├── Plugins/     # Validate size, type, count, duplicate name; status/role guard
└── ModelDrivenApp/  # Attachments sub-grid on the request form
tests/api/
```

**Structure Decision**: Same solution; guard shares the status/role logic of Spec 2.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Validation plug-in | Count and duplicate-name limits are not configurable in standard columns | File column max size alone cannot enforce type, count or names |

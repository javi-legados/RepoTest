# Implementation Plan: Approver Assignment

**Branch**: `003-approver-assignment` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Let administrators assign a Plant Manager per Plant BU and a Regional Approver per Region BU, resolve the three approval levels of a request at submission (direct manager, Plant Manager, Regional Approver), block submission when a level has no active approver, propagate approver changes to undecided levels, and support manual reassignment with a recorded reason. Built with Dataverse tables, model-driven views, a server-side resolution step and Power Automate flows.

## Technical Context

**Language/Version**: Dataverse, Power Automate; C# plug-in only for the pre-submission check (R4)
**Primary Dependencies**: Specs 1 and 2 (users, BUs, roles); Dataverse auditing
**Storage**: Dataverse tables `ApproverAssignment`, `ResolvedApprover`, `ReassignmentRecord`
**Testing**: Web API scenarios for each Creator BU type; quickstart.md
**Target Platform**: Power Platform environment
**Project Type**: Power Platform solution
**Performance Goals**: Resolution completes within the submit action (under 3 s)
**Constraints**: Fixed order; one decision per level even for the same person; manual reassignment only
**Scale/Scope**: 50 plants, regions, 500 users

## Constitution Check

| Principle / Constraint | Status | Notes |
|---|---|---|
| Standard capabilities first | Pass | Tables, lookups, views, flows |
| Justify complexity | Pass | One plug-in, tracked below |
| Rules enforced by system | Pass | Validation on assignment and submit |
| Immutable history | Pass | Reassignment/automatic updates recorded |
| Fixed approval order | Pass | Manager → Plant Manager → Regional Approver |

Open point: Enterprise approver scope undefined; levels omitted for Company/Enterprise Creators per the spec.

## Project Structure

```text
specs/003-approver-assignment/
├── plan.md  research.md  data-model.md  quickstart.md
└── contracts/approver-resolution.md
solution/CEAPlatform/
├── Tables/    # ApproverAssignment, ResolvedApprover, ReassignmentRecord
├── Flows/     # Propagate approver change, flag missing approver
├── ModelDrivenApp/  # Assignment views, "BUs without approver" view
└── Plugins/   # Resolve approvers and block submit when missing
tests/api/     # Resolution per Creator BU type
```

**Structure Decision**: Same solution; resolution is a reusable step called by Spec 6 submission.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Plug-in for resolution/blocking | Submission must be blocked synchronously | Flow cannot stop the status change |

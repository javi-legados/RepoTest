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

| Plug-in ApproverAssignmentValidation replaces business rules and alternate key (T005/T012) | Lookup columns cannot be alternate keys; business rules cannot query roles | Business rules cannot enforce uniqueness or role membership |
| cea_resolvedapprover is user-owned | Org-owned tables only allow Global depth, so 'own rows' read is impossible | Org-owned would expose all rows to Creators |

## Implementation notes (closing)
- Resolution lives in ChainAdvance.Resolve (ApprovalChain.cs, Spec 7), not a separate ResolveApprovers.cs; it throws a level-named error in the same transaction (T015-T017, T021, T022, T025).
- T018/T019/T024: plug-in ApproverChangePropagation (PostOperation Update of cea_approverassignment) replaces the flows; follows the new approver or sets Needs Reassignment. User deactivation is blocked by UserDeactivationGuard (Spec 1).
- T026/T027: Custom API cea_ReassignApprover (ReassignApprover.cs) instead of a flow; admin only, Reason required, writes cea_reassignmentrecord. Provisioned by tools/provision-003-api.mjs. Test: tests/api/approver-reassignment-rules.mjs (success path needs a user with CEA Internal Approvals).
- T023: view 'Business Units without approver (Plants)' created by provision-003.mjs.


> Nota T010/T011/T028: formulario Approver Assignment (BU restringida a la vista 'Plants and Regions', Approver a 'Assignable Approvers') y formulario Resolved Approver con boton 'Reassign approver' (ribbon + CEA.RequestForm.reassignApprover -> cea_ReassignApprover, solo admins y Decided = No), aprovisionados con tools\provision-003-forms.mjs en lugar de XML en ModelDrivenApp\Forms.

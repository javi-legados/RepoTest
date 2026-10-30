# Tasks: Rejection and Revision Review

**Input**: `specs/008-rejection-revision-review/` (plan.md, spec.md, research.md, data-model.md, contracts/revision-actions.md, quickstart.md)
**Prerequisites**: Specs 3 (Approver Assignment), 4 (CEA Request Form), 6 (Submission and Initial Review) and 7 (Approval Chain) built in the `CEAPlatform` solution; `pac` CLI authenticated. Tests are not requested by the spec; validation is done through quickstart.md scenarios and Web API rule checks (Polish phase).

**Format**: `- [ ] T### [P] [US#] Description with path` — `[P]` = parallelizable (different files, no dependency on incomplete tasks).

## Phase 1: Setup

- [X] T001 Verify that the Spec 6 plug-in assembly `solution/CEAPlatform/Plugins/CEAPlatform.Plugins.csproj` and the Spec 6 `InitialReview` table, Spec 7 `ResolvedApprover`, `ApprovalDecision` and `PlatformSetting` tables exist in `solution/CEAPlatform/Tables/`; no new project or component type is created (plan.md Structure Decision)
- [X] T002 [P] Create folders `solution/CEAPlatform/Tables/RevisionCycle/` and `solution/CEAPlatform/Flows/` entries placeholder README for Spec 8 flows (`CreatorHold`, `CreatorReminder`) and `tests/api/` revision test folder notes in `tests/api/README.md`

## Phase 2: Foundational (blocks all user stories)

- [X] T003 Add column `Review Type` (Choice: Initial, Revision) to the existing `InitialReview` table from Spec 6 (data-model.md "Review additions"; same states and rules as Initial Review, existing rows default to Initial) in `solution/CEAPlatform/Tables/InitialReview/`
- [X] T004 Create the table `cea_revisioncycle` per data-model.md: Request (Lookup), Cycle (Whole), Rejected By (Lookup User), Rejection Comments (Multiline), Rejected On (DateTime), Resubmitted On (DateTime), Correction Note (Multiline, optional), Review Outcome (Choice: Released, Returned), Reviewed By (Lookup User) in `solution/CEAPlatform/Tables/RevisionCycle/`
- [X] T005 Make `cea_revisioncycle` "Append-only": remove update (except filling Resubmitted On, Correction Note, Review Outcome, Reviewed By once) and delete privileges for every role in `solution/CEAPlatform/SecurityRoles/` (Constitution: immutable history)
- [X] T006 Add the status values `Returned to Creator`, `Pending Revision Review` and `On Hold (Creator inactive)` to the CeaRequest Status choice from Spec 4/Spec 6 in `solution/CEAPlatform/Tables/CeaRequest/`
- [X] T007 Add the `PlatformSetting` row with key `CreatorReminderDays` (default 5 proposed, editable by CEA Administrators) to the Spec 7 `PlatformSetting` table in `solution/CEAPlatform/Tables/PlatformSetting/` (research R7)
- [X] T008 Grant privileges on `cea_revisioncycle` (Read for every role that can open the request, Create/Append for CEA Administrators and system) and on the new Review Type column in `solution/CEAPlatform/SecurityRoles/` (matrix owned by Spec 2)

**Checkpoint**: table, statuses and setting exist; user stories can start.

## Phase 3: User Story 1 — Correct a rejected request (P1) 🎯 MVP

**Goal**: The Creator receives a rejected request with comments, edits form and attachments, and resubmits it to the CEA Administrators.
**Independent Test**: Reject a request, edit it as the Creator, and resubmit; verify it reaches Pending Revision Review and is locked (quickstart scenarios 1–3).

- [X] T009 [US1] Extend the Spec 7 rejection handling so a rejection sets the request to `Returned to Creator` and creates a `cea_revisioncycle` row with Cycle = previous count + 1 (no limit on cycles, FR-010), Rejected By, Rejection Comments and Rejected On, in `solution/CEAPlatform/Plugins/ApprovalDecisionHandler.cs` (Spec 7 plug-in/action; FR-001, FR-008)
- [X] T010 [P] [US1] Enable editing of the form and attachments for status `Returned to Creator` under the same rules as Specs 4 and 5, via form logic in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` (FR-002)
- [X] T011 [P] [US1] Add a "Rejection" section on the CeaRequest form showing the latest rejection comments, approver and date (from `cea_revisioncycle`) prominently at the top when status is `Returned to Creator`, in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` (FR-001, SC-004)
- [X] T012 [US1] Implement the `ResubmitRequest` action (Caller: Creator; Inputs: Request, Correction Note optional; Preconditions: Returned, form validations pass, active administrator exists) in `solution/CEAPlatform/Plugins/ResubmitRequest.cs` within the Spec 6 plug-in assembly: runs the same validations and active-administrator check as submit (block and keep Returned if none, FR-004), creates a Revision-type review row Open, sets `Pending Revision Review`, locks Creator edits, fills Resubmitted On and Correction Note on the cycle row (FR-003, FR-012)
- [X] T013 [US1] Add the Resubmit command button (with optional Correction Note dialog) to the CeaRequest form ribbon, visible only to the Creator while status is `Returned to Creator`, in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` (spec acceptance scenario 3)
- [X] T014 [P] [US1] Create the Power Automate flow `solution/CEAPlatform/Flows/CreatorHold.json` triggered on deactivation of a user: for each request in `Returned to Creator` owned by that Creator, set `On Hold (Creator inactive)`, request a notification to the CEA Administrators (Spec 9) and allow the administrators to reassign the Creator (FR-011, research R6)
- [X] T015 [P] [US1] Create the scheduled flow `solution/CEAPlatform/Flows/CreatorReminder.json` that, for requests `Returned to Creator` for more than `CreatorReminderDays` days, sends one email reminder request to the Creator via the Spec 9 mechanism and never closes the request automatically (FR-013, research R7)

**Checkpoint**: US1 independently usable (MVP).

## Phase 4: User Story 2 — Perform the Revision Review (P1)

**Goal**: One CEA Administrator reviews the revised request and releases it to the approval chain or returns it to the Creator with comments.
**Independent Test**: Resubmit a corrected request and complete the review as an administrator, both releasing and returning it (quickstart scenarios 4–6).

- [X] T016 [US2] Extend the Spec 6 `ReleaseToApproval` action for `Review Type = Revision` in `solution/CEAPlatform/Plugins/ReleaseToApproval.cs`: precondition revision review Open and first approver active; creates a new `ResolvedApprover` set for the new cycle resolved with the Spec 3 rules at release time (not the one who rejected), restarts the chain at the first applicable level, closes the review as Released and sets Review Outcome and Reviewed By on the cycle row (FR-005, FR-006)
- [X] T017 [US2] Block the release in `solution/CEAPlatform/Plugins/ReleaseToApproval.cs` when the first approver is missing or inactive: keep the request in `Pending Revision Review` and request a notification to the CEA Administrators (FR-007)
- [X] T018 [US2] Extend the Spec 6 `ReturnToCreator` action for `Review Type = Revision` in `solution/CEAPlatform/Plugins/ReturnToCreator.cs`: Comments required ("Comments (required)"), sets `Returned to Creator`, closes the review as Returned, sets Review Outcome Returned and Reviewed By on the cycle row, and the Creator can edit and resubmit again (FR-005)
- [X] T019 [P] [US2] Show on the Revision Review screen for administrators the previous rejection comments and the history of earlier decisions (cycle rows and Spec 7 `ApprovalDecision` rows) in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` and reuse the Spec 6 Initial Review view for Review Type = Revision in `solution/CEAPlatform/ModelDrivenApp/Views/` (the administrator may review their own request and there is no reservation, as in Spec 6)
- [X] T020 [P] [US2] Request notifications through the Spec 9 mechanism: to the CEA Administrators on resubmission, to the first approver on release, to the Creator on return, in `solution/CEAPlatform/Flows/RevisionNotifications.json` (FR-009, research R8)

## Phase 5: User Story 3 — Track the revision cycles (P2)

**Goal**: Creator, approvers and administrators see every rejection and review outcome per cycle.
**Independent Test**: Run two reject-and-revise cycles and verify both appear in order (quickstart scenario 7).

- [X] T021 [P] [US3] Add a read-only "Revision history" subgrid on the CeaRequest form showing, per cycle ordered by Cycle: Rejected By, Rejection Comments, Rejected On, Resubmitted On, Correction Note, Review Outcome, Reviewed By, in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`, visible to everyone who can open the request (FR-008, research R9)
- [X] T022 [P] [US3] Create the view `solution/CEAPlatform/ModelDrivenApp/Views/RevisionCycles.xml` of `cea_revisioncycle` ordered by Request and Cycle
- [X] T023 [US3] Display the revision count ("Revised N times") in the CeaRequest header in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`, computed from `cea_revisioncycle` rows, and ensure `ApprovalDecision.Cycle` (Spec 7) is set to the current cycle on release in `solution/CEAPlatform/Plugins/ReleaseToApproval.cs`

## Phase 6: Polish & Cross-Cutting

- [X] T024 [P] Write Web API rule checks in `tests/api/revision-rules.tests.ps1` covering every row of the contract `contracts/revision-actions.md` (ResubmitRequest, ReleaseToApproval (Revision), ReturnToCreator (Revision)) plus: no cycle limit, `cea_revisioncycle` append-only, no automatic closure, approvers resolved at release time
- [X] T025 [P] Write Web API checks in `tests/api/revision-edge-cases.tests.ps1` for: no active administrator on resubmit, first approver inactive on release, deactivated Creator while returned (On Hold + reassignment), reminder sent once after N days
- [ ] T026 Run all quickstart.md scenarios (1–9) in a clean Dev environment and note results in `specs/008-rejection-revision-review/quickstart.md`
- [X] T027 Confirm the plan.md Complexity Tracking ("No violations", no new plug-in; `ResubmitRequest` extends the Spec 6 assembly) against the final component list and update it if needed in `specs/008-rejection-revision-review/plan.md`
- [X] T028 Export the solution (`pac solution export` + `unpack`) into `solution/CEAPlatform/` and commit

## Dependencies & Execution Order

- Phase 1 → Phase 2 → user stories. Phase 2 blocks everything.
- US1 (P1) depends only on Phase 2 and Specs 4, 6, 7 → MVP.
- US2 depends on US1's `ResubmitRequest` (T012) to create Revision reviews, but is independently testable by seeding a Pending Revision Review request.
- US3 depends on T004 and T009; independently testable with seeded cycle rows.
- Polish after all desired stories.

## Parallel Opportunities

- T010/T011; T014/T015; T019/T020; T021/T022; T024/T025.
- After Phase 2, US1 flows (T014, T015) and US3 views (T021, T022) can proceed in parallel by different people.

## Implementation Strategy

1. Setup + Foundational.
2. US1 → validate → MVP.
3. US2 → validate the full reject → revise → release loop.
4. US3, then Polish and solution export.

**Totals**: 28 tasks — Setup 2, Foundational 6, US1 7, US2 5, US3 3, Polish 5.

# Tasks: Submission and Initial Review

**Input**: `specs/006-submission-initial-review/` (plan.md, spec.md, research.md, data-model.md, contracts/actions.md, quickstart.md)
**Prerequisites**: Specs 1–5 delivered in the `CEAPlatform` solution (Spec 1: solution, System User, Business Unit hierarchy; Spec 2: security roles; Spec 3: Approver Assignment and resolution; Spec 4: `CeaRequest`). Tests are not requested by the spec; validation is done through quickstart.md scenarios and Web API rule checks (Polish phase).

**Format**: `- [ ] T### [P] [US#] Description with path` — `[P]` = parallelizable (different files, no dependency on incomplete tasks).

## Phase 1: Setup

- [X] T001 Confirm the `CEAPlatform` unmanaged solution and publisher prefix `cea` created in Spec 1 are present in the Dev environment, and pull the latest unpacked solution into `solution/CEAPlatform/` (reuse; do not recreate)
- [X] T002 [P] Add the plug-in classes `SubmitRequest`, `ReleaseToApproval`, `ReturnToCreator` as files in the existing `solution/CEAPlatform/Plugins/CEAPlatform.Plugins.csproj` (project created in Spec 1) and create folders `solution/CEAPlatform/Flows/` and `tests/api/` entries only if missing

## Phase 2: Foundational (blocks all user stories)

- [X] T003 Extend the `CeaRequest` table (defined in Spec 4 data-model.md; reuse) in `solution/CEAPlatform/Tables/CeaRequest/` with: Submitted By (Lookup User), Submitted On (DateTime), Status Changed On (DateTime), Current Level (Choice, from Approval Level defined in Spec 3 data-model.md)
- [X] T004 Add the status value "Returned to Creator" to the existing `Status` choice of `CeaRequest` (Spec 4: Draft, Pending Initial Review, Pending Approval, Rejected, Revision Review, Approved, Completed, On Hold) in `solution/CEAPlatform/Tables/CeaRequest/`, keeping the transitions "Draft → Pending Initial Review (submit) → Pending Approval (release) or → Returned to Creator (return) → Pending Initial Review (resubmit)"
- [X] T005 Create the table `InitialReview` in `solution/CEAPlatform/Tables/InitialReview/` with columns Request (Lookup), State (Choice: Open, Released, Returned), Reviewed By (Lookup User, set when closed), Reviewed On (DateTime), Outcome (Choice: Released, Returned), Comments (Multiline; required when Returned)
- [X] T006 Enforce "One Open review per request at a time. Closed rows are immutable." on `InitialReview` by enabling optimistic concurrency (row version) and removing update/delete privileges on closed rows for every role in `solution/CEAPlatform/SecurityRoles/` (matrix owned by Spec 2)
- [X] T007 Deny direct edits of `CeaRequest` Status, Submitted By, Submitted On, Status Changed On and Current Level for every role (status changes only through the actions) by updating `solution/CEAPlatform/SecurityRoles/` and field security profiles (Spec 2 roles reused)
- [X] T008 Register the three custom actions skeleton `cea_SubmitRequest`, `cea_ReleaseToApproval`, `cea_ReturnToCreator` per `contracts/actions.md` (inputs: Request; Comments for return) in `solution/CEAPlatform/Plugins/Actions/`

**Checkpoint**: tables, actions and security exist; user stories can start.

## Phase 3: User Story 1 — Submit a request for review (P1) 🎯 MVP

**Goal**: Creator submits a complete Draft; the request moves to Pending Initial Review and is locked for the Creator.
**Independent Test**: Complete a Draft, submit it, verify status change, Creator cannot edit, administrators are notified; incomplete Draft lists all problems; double submit yields one submission (quickstart scenarios 1–4). This story is independently testable.

- [X] T009 [US1] Implement plug-in `solution/CEAPlatform/Plugins/SubmitRequest.cs` for `cea_SubmitRequest` (Creator or Administrator caller) that, in one transaction: requires status = Draft (double-submit protection), applies every Spec 4 form validation and returns the complete list of missing/invalid fields, blocks with a clear message when no active CEA Administrator exists (request stays Draft), sets Status = Pending Initial Review, Submitted By/On and Status Changed On, and creates an `InitialReview` row in State Open
- [X] T010 [P] [US1] Add the "Submit" command button on the `CeaRequest` form (visible when Status = Draft or Returned to Creator) calling `cea_SubmitRequest` in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`, displaying the returned error list
- [X] T011 [P] [US1] Lock the form for the Creator while Status is Pending Initial Review, Pending Approval or later (view only) via form read-only rules in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` (FR-003)
- [X] T012 [P] [US1] Create the flow `solution/CEAPlatform/Flows/NotifyAdministratorsOnSubmit.json` that writes a notification request record for the CEA Administrators on submission, consumed by Spec 9 (FR-010)
- [X] T013 [US1] Allow submission without attachments (no attachment rule) and document it in `specs/006-submission-initial-review/contracts/actions.md` precondition notes (research R9)

**Checkpoint**: US1 independently usable (MVP).

## Phase 4: User Story 2 — Perform the Initial Review (P1)

**Goal**: Exactly one CEA Administrator closes each Initial Review, either releasing or returning the request with comments.
**Independent Test**: With two administrators, one completes the review and the other's attempt is rejected; return without comments is blocked; own-request review is allowed (quickstart scenarios 5, 6, 8). This story is independently testable.

- [X] T014 [P] [US2] Create the "Pending Initial Review" queue view visible to all CEA Administrators in `solution/CEAPlatform/ModelDrivenApp/Views/PendingInitialReview.xml` and add it to the sitemap of the "CEA Administration" app (Spec 1) (FR-004)
- [X] T015 [P] [US2] Build the read-only `InitialReview` form and a subgrid on the `CeaRequest` form showing Reviewed By, Reviewed On, Outcome and Comments in `solution/CEAPlatform/ModelDrivenApp/Forms/InitialReview.xml`
- [X] T016 [US2] Implement plug-in `solution/CEAPlatform/Plugins/ReturnToCreator.cs` for `cea_ReturnToCreator`: requires the review State = Open, rejects empty Comments ("Comments | Multiline; required when Returned"), closes the review as Returned with Reviewed By/On, sets Status = "Returned to Creator" (Creator-editable), and rejects a later attempt on an already closed review using optimistic concurrency (first completed action wins; no reservation)
- [X] T017 [P] [US2] Add the "Return to Creator" command button with a mandatory comments dialog for administrators in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`
- [X] T018 [P] [US2] Create the flow `solution/CEAPlatform/Flows/NotifyCreatorOnReturn.json` that writes a notification request record for the Creator on return (Spec 9; content defined there), and ensure resubmission after a return creates a new Open `InitialReview` via `SubmitRequest.cs` (FR-011, FR-012: an administrator may review their own request, so no self-approval guard from Spec 2 is applied)

## Phase 5: User Story 3 — Release the request to the approval chain (P1)

**Goal**: After review, the administrator releases the request to the first required approver for that Creator.
**Independent Test**: Complete a review and verify the request is Pending Approval at the first approver; with no active first approver the release is blocked and the request stays in Initial Review (quickstart scenarios 5, 7, 9). This story is independently testable.

- [X] T019 [US3] Implement plug-in `solution/CEAPlatform/Plugins/ReleaseToApproval.cs` for `cea_ReleaseToApproval`: requires the review State = Open, calls the approver resolution of Spec 3 (Approver Assignment / Resolved Approver; reuse, do not recreate) for the first required level, blocks with an error naming the missing level when the approver is missing or inactive (the level is never skipped), otherwise closes the review as Released, sets Status = Pending Approval, Current Level and Status Changed On
- [X] T020 [P] [US3] Add the "Release to Approval" command button for administrators on the `CeaRequest` form in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`, showing the missing-approver message returned by the action
- [X] T021 [P] [US3] Create the flow `solution/CEAPlatform/Flows/NotifyFirstApproverOnRelease.json` that writes a notification request record for the first approver on release (FR-010, Spec 9)
- [X] T022 [P] [US3] Create the flow `solution/CEAPlatform/Flows/NotifyAdministratorsMissingApprover.json` that writes a notification request record to the CEA Administrators naming the missing approver level when the release is blocked (FR-007)
- [X] T023 [US3] Ensure a request is never released without a completed Initial Review (FR-006) by rejecting any Status = Pending Approval change that does not come from `ReleaseToApproval.cs` in `solution/CEAPlatform/Plugins/ReleaseToApproval.cs`

## Phase 6: User Story 4 — Track the status of a submitted request (P2)

**Goal**: Creator and administrators see current status and the date of the last status change.
**Independent Test**: Submit a request and verify status and last-change date at each stage (quickstart scenario 1). This story is independently testable.

- [X] T024 [P] [US4] Show Status and Status Changed On in the `CeaRequest` form header in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` (FR-009, research R8)
- [X] T025 [P] [US4] Show Submitted By and Submitted On to administrators during an Initial Review in the `CeaRequest` form in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`
- [X] T026 [US4] Ensure all three plug-ins update Status Changed On on every status change in `solution/CEAPlatform/Plugins/` (SubmitRequest, ReleaseToApproval, ReturnToCreator)

## Phase 7: Polish & Cross-Cutting

- [X] T027 [P] Write Web API rule checks in `tests/api/submission-rules.tests.ps1` covering every row of the "Actions" table in `contracts/actions.md` and its errors: validation list, no active administrator, review already closed, missing approver (names the level), empty comments
- [X] T028 [P] Write the concurrency check in `tests/api/initial-review-concurrency.tests.ps1` with two administrators closing the same review (first completed action wins, second is rejected) and a double-submit check
- [ ] T029 Run all quickstart.md scenarios (1–9) in a clean Dev environment and note results in `specs/006-submission-initial-review/quickstart.md`; verify submit completes in under 3 seconds
- [X] T030 Confirm the Complexity Tracking entry in `plan.md` ("Plug-in-backed actions") against the final plug-in list (SubmitRequest, ReleaseToApproval, ReturnToCreator) and update it
- [ ] T031 Export the solution (`pac solution export` + `unpack`) into `solution/CEAPlatform/` and commit

## Dependencies & Execution Order

- Phase 1 → Phase 2 → user stories. Phase 2 blocks everything.
- US1 (P1) depends only on Phase 2 → MVP.
- US2 depends on US1 (an Open `InitialReview` is created at submit) but is independently testable by seeding a Pending Initial Review request.
- US3 depends on Spec 3 approver resolution and on T005; independently testable by seeding an Open review.
- US4 depends on T003 and on the plug-ins existing (T026).
- Polish after all desired stories.

## Parallel Opportunities

- T010/T011/T012; T014/T015; T017/T018; T020/T021/T022; T024/T025; T027/T028.
- After Phase 2, US1 flows/forms and US2 views can proceed in parallel by different people.

## Implementation Strategy

1. Setup + Foundational.
2. US1 → validate → MVP.
3. US2 and US3 (both P1) next, then US4.
4. Polish, then export the solution.

**Totals**: 31 tasks — Setup 2, Foundational 6, US1 5, US2 5, US3 5, US4 3, Polish 5.

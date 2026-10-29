# Tasks: Approval Chain

**Input**: `specs/007-approval-chain/` (plan.md, spec.md, research.md, data-model.md, contracts/decision-actions.md, quickstart.md)
**Prerequisites**: Specs 1–6 implemented in the `CEAPlatform` solution (Spec 1: solution, plug-in project, model-driven app; Spec 2: security roles; Spec 3: `Resolved Approver`, Approval Level; Spec 4: `CeaRequest`; Spec 6: `CeaRequest` additions and statuses). Tests are not requested by the spec; validation is done through quickstart.md scenarios and Web API rule checks (Polish phase).

**Format**: `- [ ] T### [P] [US#] Description with path` — `[P]` = parallelizable (different files, no dependency on incomplete tasks).

## Phase 1: Setup

- [ ] T001 Confirm the existing `CEAPlatform` solution, the `cea` publisher and the `solution/CEAPlatform/Plugins/CEAPlatform.Plugins.csproj` project from Spec 1 are available; reuse them (do not recreate) and pull the latest unpacked solution into `solution/CEAPlatform/`
- [ ] T002 [P] Create the working folders `solution/CEAPlatform/Tables/ApprovalDecision/`, `solution/CEAPlatform/Tables/PlatformSetting/` and `solution/CEAPlatform/Flows/ApprovalChain/` and the test folder `tests/api/` if missing

## Phase 2: Foundational (blocks all user stories)

- [ ] T003 [P] Create the table `PlatformSetting` (Name, Value) in `solution/CEAPlatform/Tables/PlatformSetting/`; key `ReminderDays` (N) editable by administrators only
- [ ] T004 [P] Create the table `ApprovalDecision` in `solution/CEAPlatform/Tables/ApprovalDecision/` with columns: Request (Lookup to `CeaRequest`, Spec 4), Level (Choice, reuse Approval Level from Spec 3), Approver (Lookup User, Spec 1), Decision (Choice: Approved, Rejected), Comments (Multiline; required when Rejected), Decided On (DateTime), Invalidated (Two Options, set when a later rejection invalidates it), Cycle (Whole, revision cycle number); "Create-only; only `Invalidated` may change once"
- [ ] T005 Add to the existing `Resolved Approver` table (from Spec 3) in `solution/CEAPlatform/Tables/ResolvedApprover/` the columns Step Status (Choice: Pending, Approved, Rejected, Skipped, Invalidated, On Hold) and Decided On (DateTime); keep the Spec 3 columns Decided, Skipped and Needs Reassignment unchanged
- [ ] T006 Add the statuses Pending Approval (with Current Level), Approved and On Hold to the `CeaRequest` status choice (Spec 4/6) in `solution/CEAPlatform/Tables/CeaRequest/`; reuse the Current Level column added by Spec 6
- [ ] T007 Configure security privileges in `solution/CEAPlatform/SecurityRoles/` (matrix from Spec 2): remove update/delete on `ApprovalDecision` for every role, read access scoped by the BU hierarchy, write on `PlatformSetting` only for `CEA Administrators`, and no approve/reject execute privilege for CEA Approvals (read-only) and CEA Creators without an approval role (FR-008)
- [ ] T008 Seed the `PlatformSetting` row `ReminderDays` = 3 (default proposed in research.md R8) in `solution/CEAPlatform/Tables/PlatformSetting/seed.json`
- [ ] T009 Add to the "CEA Administration"/approvals model-driven app (Spec 1/2) the sitemap entries for My Pending Approvals and Platform Settings in `solution/CEAPlatform/ModelDrivenApp/`

**Checkpoint**: tables, columns, statuses and privileges exist; user stories can start.

## Phase 3: User Story 1 — Approve a request at my level (Priority: P1) 🎯 MVP

**Goal**: The approver of the current level sees the requests pending at their level, approves, and the request advances; the last approval routes it to the CEA Administrators.
**Independent Test**: Release a request with all three levels defined and have each approver approve in turn; verify the request advances level by level (quickstart scenario 1). Independently testable.

- [ ] T010 [US1] Define the custom action `ApproveStep` (inputs Request, Comments optional) in `solution/CEAPlatform/Plugins/Actions/ApproveStep.xml` per `contracts/decision-actions.md`
- [ ] T011 [US1] Implement plug-in `solution/CEAPlatform/Plugins/ApproveStep.cs` (the plug-in justified in plan.md Complexity Tracking) enforcing: caller is the current step approver and the step is Pending (FR-002, FR-011); creates an `ApprovalDecision` (Approved, approver, Decided On, Cycle); sets Step Status = Approved; advances to the next non-skipped level or sets the request status to Approved after the last level (FR-001, FR-003)
- [ ] T012 [US1] Add first-completed-decision-wins concurrency to `solution/CEAPlatform/Plugins/ApproveStep.cs` using optimistic concurrency (row version) on the `Resolved Approver` step row, returning the clear message "level already decided" to the second caller (FR-014, research.md R6)
- [ ] T013 [P] [US1] Create the My Pending Approvals view in `solution/CEAPlatform/ModelDrivenApp/Views/MyPendingApprovals.xml` showing only requests pending at the user's level or already decided by them, within their BU hierarchy (FR-007)
- [ ] T014 [P] [US1] Add the Approve command button and optional comments dialog to the `CeaRequest` form in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`, visible only to the current-level approver while the request is Pending Approval
- [ ] T015 [US1] Request the notifications (Spec 9 handles content and delivery): next approver after each approval and CEA Administrators after the final approval, via notification-request rows created in `solution/CEAPlatform/Plugins/ApproveStep.cs` (FR-010)
- [ ] T016 [US1] Register the `ApproveStep` plug-in step and publish the solution; verify the not-your-level and read-only/Creator-only error cases from `contracts/decision-actions.md`

**Checkpoint**: US1 independently usable (MVP).

## Phase 4: User Story 2 — Reject a request with comments (Priority: P1)

**Goal**: The approver rejects with mandatory comments; the request leaves the chain and returns to the Creator, prior approvals are invalidated but kept.
**Independent Test**: Reject a request at each level without comments (blocked) and with comments (returned to the Creator) (quickstart scenario 5). Independently testable.

- [ ] T017 [US2] Define the custom action `RejectStep` (inputs Request, Comments required) in `solution/CEAPlatform/Plugins/Actions/RejectStep.xml` per `contracts/decision-actions.md`
- [ ] T018 [US2] Implement plug-in `solution/CEAPlatform/Plugins/RejectStep.cs` enforcing the same caller/step checks as `ApproveStep` and rejecting empty comments ("Comments (Multiline; required when Rejected)"); creates an `ApprovalDecision` (Rejected, comments, approver, Decided On) (FR-004)
- [ ] T019 [US2] In `solution/CEAPlatform/Plugins/RejectStep.cs` set `Invalidated` = Yes on all prior Approved `ApprovalDecision` rows of the current Cycle and Step Status = Invalidated on their steps (rows kept, never deleted), and set the request status to Returned to Creator (Spec 6 status) (FR-004, research.md R3)
- [ ] T020 [US2] In `solution/CEAPlatform/Plugins/RejectStep.cs` reset the steps (Step Status = Pending, first applicable level) and increment the Cycle so the chain restarts from the first applicable level after the revision; the resubmission itself is handled by Spec 8 (FR-004)
- [ ] T021 [P] [US2] Add the Reject command button and a dialog with mandatory comments to `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`, blocking confirmation while comments are empty
- [ ] T022 [US2] Request the notification to the Creator after a rejection (Spec 9) from `solution/CEAPlatform/Plugins/RejectStep.cs` (FR-010)
- [ ] T023 [US2] Register the `RejectStep` plug-in step and publish; verify decided levels cannot be decided again unless the request is resubmitted (FR-011)

**Checkpoint**: US2 independently usable.

## Phase 5: User Story 3 — Follow the level order and skipped levels (Priority: P1)

**Goal**: The chain follows Manager, Plant Manager, Regional Approver; non-applicable levels and levels where the approver is the Creator are skipped and recorded; a person holding two levels approves once per level.
**Independent Test**: Submit requests from a Plant Creator, a Region Creator, and a Company Creator and verify the levels each one goes through (quickstart scenarios 2–4). Independently testable.

- [ ] T024 [US3] Implement in `solution/CEAPlatform/Plugins/ChainAdvance.cs` (shared helper used by `ApproveStep.cs`, `RejectStep.cs` and the release step of Spec 6) the selection of the first/next applicable level in the fixed order Manager, Plant Manager, Regional Approver using the `Resolved Approver` rows of Spec 3 (FR-001)
- [ ] T025 [US3] In `solution/CEAPlatform/Plugins/ChainAdvance.cs` mark a step Skipped (Step Status = Skipped, Skipped = Yes) and log it when the approver equals the Creator, and for levels that do not apply to Region and Company Creators under the Spec 3 rules (FR-005, research.md R5)
- [ ] T026 [US3] Ensure in `solution/CEAPlatform/Plugins/ChainAdvance.cs` that one person holding two levels gets one separate Pending step and one `ApprovalDecision` per level, never a combined decision (FR-006)
- [ ] T027 [P] [US3] Show the skipped levels with the reason in the decision history subgrid view `solution/CEAPlatform/ModelDrivenApp/Views/ApprovalSteps.xml`

**Checkpoint**: US3 independently usable.

## Phase 6: User Story 4 — See where the request is in the chain (Priority: P2)

**Goal**: Creator, approvers with access and CEA Administrators see the current level, the pending approver and the full decision history.
**Independent Test**: Open a request in the middle of the chain and verify the current level, the pending approver and the past decisions are shown (quickstart scenario 10). Independently testable.

- [ ] T028 [P] [US4] Add the current level and pending approver fields to the header of the `CeaRequest` form in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` (FR-009)
- [ ] T029 [P] [US4] Add the decision history subgrid (approver, date, comments, outcome, invalidated flag, earlier levels included) from `ApprovalDecision` to the `CeaRequest` form in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`, visible to every user authorized to open the request, approvers included (FR-009, research.md R9)
- [ ] T030 [US4] Verify in `solution/CEAPlatform/SecurityRoles/` that the Creator, approvers with access and CEA Administrators can read `ApprovalDecision` rows within their BU hierarchy and nobody can edit them (Spec 2 matrix)

**Checkpoint**: US4 independently usable.

## Phase 7: Polish & Cross-Cutting

- [ ] T031 [P] Create the hold flow `solution/CEAPlatform/Flows/ApprovalChain/HoldOnApproverDeactivation.json`: when the approver of the current level is deactivated or loses the role, set the request to On Hold and Step Status = On Hold, and notify the CEA Administrators (FR-012, research.md R7)
- [ ] T032 [P] Create the resume flow `solution/CEAPlatform/Flows/ApprovalChain/ResumeOnReassignment.json`: when Spec 3 assigns a new active approver, set the request back to Pending Approval at that level (FR-012)
- [ ] T033 [P] Create the scheduled daily reminder flow `solution/CEAPlatform/Flows/ApprovalChain/PendingReminder.json`: find steps Pending for at least `ReminderDays` (from `PlatformSetting`) days and request a reminder to the current approver once (Spec 9 handles delivery); no escalation and no automatic approval (FR-013, research.md R8)
- [ ] T034 [P] Write Web API rule checks in `tests/api/approval-chain-rules.tests.ps1` covering every row of `contracts/decision-actions.md`: not your level, level already decided (first wins), empty rejection comments, read-only or Creator-only role, plus the concurrency case
- [ ] T035 Run all 10 quickstart.md scenarios in a clean Dev environment (including hold, resume and the N = 1 reminder) and note results in `specs/007-approval-chain/quickstart.md`
- [ ] T036 Measure that a decision completes in under 3 s (plan.md Performance Goals) and an approver can decide in under 2 minutes (SC-005), and record the result in `specs/007-approval-chain/quickstart.md`
- [ ] T037 Confirm the Complexity Tracking entry in `plan.md` against the final plug-in list (`ApproveStep`, `RejectStep`, `ChainAdvance` helper) and update it
- [ ] T038 Export the solution (`pac solution export` + `unpack`) into `solution/CEAPlatform/` and commit

## Dependencies & Execution Order

- Phase 1 → Phase 2 → user stories. Phase 2 blocks everything.
- US1 (P1) depends only on Phase 2 → MVP.
- US2 (P1) shares form and plug-in patterns with US1 but is independently testable; US3 provides `ChainAdvance.cs` used by US1/US2 for skips and should land before the full scenarios are validated (US1 can use a simple next-level step until then).
- US4 depends on T004 and T005; independently testable.
- Polish flows (T031–T033) depend on Phase 2 and Spec 3 reassignment; T035 after all desired stories.

## Parallel Opportunities

- T003/T004; T013/T014; T021; T028/T029; T031/T032/T033/T034.
- After Phase 2, US1, US2 and US4 can proceed in parallel by different people.

## Implementation Strategy

1. Setup + Foundational.
2. US1 → validate → MVP.
3. US3 (order and skips) and US2 (rejection) next, then US4.
4. Polish flows, validation, then export the solution.

**Totals**: 38 tasks — Setup 2, Foundational 7, US1 7, US2 7, US3 4, US4 3, Polish 8.

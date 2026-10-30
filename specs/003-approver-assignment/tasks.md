# Tasks: Approver Assignment

**Input**: `specs/003-approver-assignment/` (plan.md, spec.md, research.md, data-model.md, contracts/approver-resolution.md, quickstart.md)
**Prerequisites**: Specs 1 and 2 implemented (`CEAPlatform` solution, `cea` publisher, System User extension, Business Unit `cea_level`, catalogs, security roles, model-driven app "CEA Administration"). Tests are not requested by the spec; validation is done through quickstart.md scenarios and Web API rule checks (Polish phase).

**Format**: `- [ ] T### [P] [US#] Description with path` — `[P]` = parallelizable (different files, no dependency on incomplete tasks).

## Phase 1: Setup

- [X] T001 Confirm the existing `CEAPlatform` solution from Spec 1 (T001) is imported in the Dev environment and `pac` is authenticated; do not create a new solution or publisher
- [X] T002 [P] Create the subfolders `solution/CEAPlatform/Tables/{ApproverAssignment,ResolvedApprover,ReassignmentRecord}/` and reuse the existing `Flows/`, `ModelDrivenApp/`, `Plugins/` folders and `CEAPlatform.Plugins.csproj` created in Spec 1 (T002, T003)

## Phase 2: Foundational (blocks all user stories)

- [X] T003 Create the global Choice `cea_approvallevel` (1 Direct Manager, 2 Plant Manager, 3 Regional Approver) in `solution/CEAPlatform/Tables/ApproverAssignment/approvallevel.xml`
- [X] T004 Create the table `cea_approverassignment` in `solution/CEAPlatform/Tables/ApproverAssignment/` with columns: Business Unit (Lookup to the Business Unit table from Spec 1, "Plant or Region level"), Role Type (Choice: Plant Manager, Regional Approver), Approver (Lookup to System User from Spec 1, "Active, CEA Internal Approvals"), State (Active/Inactive)
- [X] T005 Define the alternate key on `cea_approverassignment` for Business Unit + Role Type (active rows) so there is "One active per BU + Role Type", and enable row-version optimistic concurrency, in `solution/CEAPlatform/Tables/ApproverAssignment/keys.xml` (R1, R9)
- [X] T006 Create the table `cea_resolvedapprover` in `solution/CEAPlatform/Tables/ResolvedApprover/` with columns: Request (Lookup, nullable until the Spec 4 request table exists), Level (`cea_approvallevel`), Approver (Lookup User), Decided (Two Options), Skipped (Two Options, "Creator is the approver"), Needs Reassignment (Two Options); alternate key "Unique per Request + Level"
- [X] T007 Create the create-only table `cea_reassignmentrecord` in `solution/CEAPlatform/Tables/ReassignmentRecord/` with columns: Request, Level, Previous Approver, New Approver, Reason (Text, required), Changed By, Changed On; remove update/delete privileges for every role, following the immutable pattern of `cea_userchangerecord` from Spec 1 (T008)
- [X] T008 Update the security roles from Spec 2 in `solution/CEAPlatform/SecurityRoles/`: `CEA Administrators` full CRUD on `cea_approverassignment`, read/write on `cea_resolvedapprover`, create and read on `cea_reassignmentrecord`; Creators and approvers read-only on their own `cea_resolvedapprover` rows
- [X] T009 Add the sitemap entries "Approver Assignments" and "Reassignment Records" to the existing "CEA Administration" app from Spec 1 (T009) in `solution/CEAPlatform/ModelDrivenApp/`

**Checkpoint**: tables, keys and security exist; user stories can start.

## Phase 3: User Story 1 — Assign Plant Manager and Regional Approver per Business Unit (P1) 🎯 MVP

**Goal**: Administrator assigns one Plant Manager per Plant BU and one Regional Approver per Region BU from active users with the CEA Internal Approvals role.
**Independent Test**: Assign a Plant Manager to a plant and a Regional Approver to a region; verify both are shown on their BUs, and that users without the role or inactive are refused (quickstart scenario 1).

- [X] T010 [P] [US1] Build the Approver Assignment form in `solution/CEAPlatform/ModelDrivenApp/Forms/ApproverAssignment.xml` with the Business Unit lookup filtered to Plant and Region levels (`cea_level` from Spec 1) and Role Type consistent with the BU level
- [X] T011 [P] [US1] Filter the Approver lookup to "Active, CEA Internal Approvals" users (roles from Spec 2) through a custom lookup view in `solution/CEAPlatform/ModelDrivenApp/Views/AssignableApprovers.xml` (R2, FR-002)
- [X] T012 [US1] Add business rules in `solution/CEAPlatform/BusinessRules/` showing the explanation message when a user without the CEA Internal Approvals role or an inactive user is selected, and blocking the save (FR-002)
- [X] T013 [US1] Create the Approver Assignments view in `solution/CEAPlatform/ModelDrivenApp/Views/ApproverAssignments.xml` (BU, Role Type, Approver, State) and show the assigned Plant Manager / Regional Approver on the Business Unit form
- [X] T014 [US1] Enable Dataverse auditing on `cea_approverassignment` in `solution/CEAPlatform/Tables/ApproverAssignment/audit-settings.md` so every assignment, change and removal is recorded with who, when, previous and new value (FR-009, FR-011)

**Checkpoint**: US1 independently usable (MVP).

## Phase 4: User Story 2 — Resolve the approvers of a request from its Creator (P1)

**Goal**: At submission the system resolves manager, Plant Manager and Regional Approver from the Creator's data, per Creator BU level, and keeps them with the request.
**Independent Test**: Submit requests from Creators in two plants of different regions and verify each resolves to its own approvers; verify Region and Company/Enterprise Creators, duplicate persons and later Plant Manager changes (quickstart scenarios 2, 3, 5, 6).

- [X] T015 [US2] Implement plug-in `solution/CEAPlatform/Plugins/ResolveApprovers.cs` (PreOperation on the Spec 6 submission status change) that reads the Creator's BU `cea_level` and writes `cea_resolvedapprover` rows by the contract table: Plant → Direct Manager, Plant Manager, Regional Approver; Region → Direct Manager, Regional Approver; Company / Enterprise → Direct Manager (R4, R5, FR-004)
- [X] T016 [US2] In `ResolveApprovers.cs` resolve the Direct Manager by matching the Creator's Manager Email (`cea_manageremail`, Spec 1) to an active user with the CEA Internal Approvals role, and Plant Manager / Regional Approver from the active `cea_approverassignment` of the Plant BU and of its parent Region (R3, FR-003)
- [X] T017 [US2] In `ResolveApprovers.cs` create separate `cea_resolvedapprover` rows when one person holds several levels, and set Skipped = Yes and record it when the resolved approver equals the Creator (R6, FR-005, FR-010; skip rule from Spec 2)
- [X] T018 [US2] Create the Power Automate flow `solution/CEAPlatform/Flows/PropagateApproverChange.json` triggered on change/deactivation of `cea_approverassignment`: update undecided `cea_resolvedapprover` rows (Decided = No) of in-progress requests to the new approver, leave Decided rows untouched, and write a `cea_reassignmentrecord` with Reason = "Approver changed" for each update (R7, FR-011)
- [X] T019 [US2] In `PropagateApproverChange.json` set Needs Reassignment = Yes on pending levels when the Business Unit is left without an approver (FR-011)
- [X] T020 [US2] Register the plug-in step, publish the solution, and document the resolution contract usage for Spec 6 in `specs/003-approver-assignment/contracts/approver-resolution.md` (rule row: "resolution is a reusable step called by submission")

**Checkpoint**: US2 independently testable.

## Phase 5: User Story 3 — Detect missing or invalid approvers before submission (P1)

**Goal**: Submission is blocked, naming the missing level, when any required level has no active approver; administrators see BUs lacking approvers.
**Independent Test**: Remove the Plant Manager of a plant and attempt to submit from that plant; verify the block and message, and the BU in the missing-approvers view (quickstart scenario 4).

- [X] T021 [US3] Extend `solution/CEAPlatform/Plugins/ResolveApprovers.cs` to throw an `InvalidPluginExecutionException` naming the level for: manager not registered or lacking the role; no active Plant Manager; no active Regional Approver; approver inactive treated as missing (FR-006, SC-002)
- [X] T022 [US3] Ensure the resolution and the block run in the same transaction so no `cea_resolvedapprover` rows persist and the request status does not change when any level fails, in `solution/CEAPlatform/Plugins/ResolveApprovers.cs` (R4)
- [X] T023 [P] [US3] Create the "Business Units without approver" view in `solution/CEAPlatform/ModelDrivenApp/Views/BusinessUnitsWithoutApprover.xml` listing Plant BUs without an active Plant Manager and Region BUs without an active Regional Approver (R10, FR-007)
- [X] T024 [P] [US3] Create the Power Automate flow `solution/CEAPlatform/Flows/FlagMissingApprover.json` flagging pending levels (Needs Reassignment) when an assigned approver is deactivated, and notifying CEA Administrators (FR-011; deactivation guard from Spec 1)
- [X] T025 [US3] Show the missing-approver message to the Creator on the submission form via the error returned by `ResolveApprovers.cs` (message format: "Missing approver: <level>") in `solution/CEAPlatform/ModelDrivenApp/Forms/` (FR-006)

**Checkpoint**: US3 independently testable.

## Phase 6: User Story 4 — Reassign approvers as a workflow exception (P2)

**Goal**: Administrator reassigns the approver of a pending step with a required reason; the change is recorded.
**Independent Test**: Reassign the Plant Manager step of a pending request; verify the new approver receives it, the former loses access, and the record exists; an empty reason is refused (quickstart scenario 7).

- [X] T026 [US4] Create the bound action `cea_ReassignApprover` (inputs Request, Level, New Approver, Reason required) in `solution/CEAPlatform/Flows/ReassignApprover.json` that validates the New Approver (active, CEA Internal Approvals), updates the `cea_resolvedapprover` row and clears Needs Reassignment (R8, FR-008)
- [X] T027 [US4] In the same flow write a `cea_reassignmentrecord` with Request, Level, Previous Approver, New Approver, Reason, Changed By, Changed On, and reject the action when Reason is empty (FR-009, SC-005)
- [X] T028 [P] [US4] Add the "Reassign approver" command button for CEA Administrators on pending `cea_resolvedapprover` rows in `solution/CEAPlatform/ModelDrivenApp/Forms/ResolvedApprover.xml`, only for rows with Decided = No
- [X] T029 [P] [US4] Create the read-only Reassignment Records view in `solution/CEAPlatform/ModelDrivenApp/Views/ReassignmentRecords.xml` (Request, Level, Previous Approver, New Approver, Reason, Changed By, Changed On)
- [ ] T030 [US4] Ensure the former approver loses decide access by relying on the row-level access rules of Spec 2 (access at own step) and verify it in `specs/003-approver-assignment/quickstart.md` scenario 7

## Phase 7: Polish & Cross-Cutting

- [ ] T031 [P] Write Web API rule checks in `tests/api/approver-resolution.tests.ps1` covering the contract table and errors in `contracts/approver-resolution.md` (Plant, Region, Company/Enterprise Creators; missing, inactive and non-role approvers; Skipped when approver equals Creator; separate rows for the same person; empty Reason refused)
- [X] T032 [P] Write Web API checks in `tests/api/approver-assignment.tests.ps1` for duplicate active assignment per BU + Role Type, unassignable users, concurrent edits (last save wins), and propagation leaving decided levels unchanged
- [ ] T033 Run all quickstart.md scenarios (1–7) in a clean Dev environment and note results in `specs/003-approver-assignment/quickstart.md`
- [X] T034 Confirm the Complexity Tracking entry in `plan.md` against the final plug-in list (only `ResolveApprovers.cs`) and update it
- [ ] T035 Export the solution (`pac solution export` + `unpack`) into `solution/CEAPlatform/` and commit

## Dependencies & Execution Order

- Phase 1 → Phase 2 → user stories. Phase 2 blocks everything; depends on Specs 1 and 2.
- US1 (P1) has no dependency on other stories → MVP.
- US2 depends on US1 assignments existing (T004) but is independently testable with seeded assignments; submission trigger depends on Spec 6.
- US3 extends `ResolveApprovers.cs` from US2 (T015–T017); the missing-approvers view (T023) is independent.
- US4 depends on `cea_resolvedapprover` rows (T006) but can be tested with seeded rows.
- Polish after all desired stories.

## Parallel Opportunities

- T010/T011; T023/T024; T028/T029; T031/T032.
- After Phase 2, US1 and US4 can proceed in parallel; US3 view/flow tasks can proceed in parallel with US2.

## Implementation Strategy

1. Setup + Foundational.
2. US1 → validate → MVP.
3. US2 and US3 (both P1; same plug-in) next, then US4 (P2).
4. Polish, then export the solution.

**Totals**: 35 tasks — Setup 2, Foundational 7, US1 5, US2 6, US3 5, US4 5, Polish 5.

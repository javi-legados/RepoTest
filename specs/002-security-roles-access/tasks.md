# Tasks: Security Roles and Business Unit Access

**Input**: `specs/002-security-roles-access/` (plan.md, spec.md, research.md, data-model.md, contracts/permission-matrix.md, quickstart.md)
**Prerequisites**: Spec 1 (`specs/001-users-master-data/`) implemented: `CEAPlatform` solution, Business Unit hierarchy, user extension columns, `CEA Administrators` role stub and `CEAPlatform.Plugins.csproj`. Tests are not requested by the spec; validation is done through quickstart.md scenarios and Web API rule checks (Polish phase).

**Format**: `- [ ] T### [P] [US#] Description with path` — `[P]` = parallelizable (different files, no dependency on incomplete tasks).

**Note**: User story phases follow spec priority order (P1: US1, US2, US5; then P2: US3, US4). Request tables (Specs 4–7) do not exist yet; request-level privileges are defined against the access rules and applied when those tables are created.

## Phase 1: Setup

- [X] T001 Verify the existing `CEAPlatform` solution (created in Spec 1, T001) and its folders `solution/CEAPlatform/{Tables,SecurityRoles,Flows,Plugins}` and `tests/{ui,api}` (Spec 1, T002); do not recreate them
- [X] T002 [P] Create `tests/api/security/` and `tests/ui/security/` with a `README.md` in each describing the per-role and per-BU-level test users
- [ ] T003 [P] Create the test-user seed script `tests/api/security/seed-security-users.ps1` creating one user per role and one per BU level (Enterprise, Company, Region, Plant) using the Spec 1 user columns (`cea_sapnumber`, `cea_department`, `cea_manageremail`, `cea_managername`)

## Phase 2: Foundational (blocks all user stories)

- [X] T004 Create the empty security roles `CEA Creators`, `CEA Internal Approvals` and `CEA Approvals` in `solution/CEAPlatform/SecurityRoles/` and reuse the `CEA Administrators` role stub from Spec 1 (T010); the solution MUST contain exactly four roles (FR-001)
- [X] T005 Create the table `cea_accessdenialrecord` ("Access Denial Record") in `solution/CEAPlatform/Tables/AccessDenialRecord/` with columns: User (Lookup to System User from Spec 1), Action (Choice: Approve, Reject, Edit, Create, Upload, Other), Request (Lookup, nullable until Spec 4 table exists), Reason (Text), Occurred On (DateTime); "Create-only for the platform; read for Administrators"
- [X] T006 Define the `Needs Reassignment` flag (Two Options) specification in `solution/CEAPlatform/Tables/NeedsReassignment.md` to be added to the request table(s) of Specs 4–7, "set when an approver's role or BU changes with pending decisions (FR-017)"
- [X] T007 Reuse the Business Unit hierarchy from Spec 1 (T004, `cea_level` Enterprise/Company/Region/Plant) and confirm the model-driven app "CEA Administration" (Spec 1, T009) shows only to users holding a CEA role, so "No role or no BU → no access" (FR-012, R8) in `solution/CEAPlatform/ModelDrivenApp/`
- [X] T008 Add the guard plug-in class skeleton `solution/CEAPlatform/Plugins/DecisionGuard.cs` to the existing `CEAPlatform.Plugins.csproj` (Spec 1, T003) with shared helpers to write an Access Denial Record outside the failing transaction (R10)

**Checkpoint**: roles, denial log, flag definition and plug-in skeleton exist; user stories can start.

## Phase 3: User Story 1 — Creators work only with their own requests (P1) 🎯 MVP

**Goal**: A Creator creates, uploads and edits own requests only in Draft or Rejected, sees only own requests, and cannot change submitted or approved requests.
**Independent Test**: Sign in as a Creator, create and submit a request, verify it can no longer be edited, and verify requests of other Creators are not visible (quickstart scenario 2). Independently testable.

- [X] T009 [US1] Define the `CEA Creators` privileges in `solution/CEAPlatform/SecurityRoles/CEAcreators.xml`: create and append on request, attachment and comment tables; read at user (own) depth only (FR-002, FR-003; Creator: View "Own")
- [X] T010 [US1] Implement the Creator edit lock, status-based: write allowed only in Draft or Rejected status, blocked while pending review or approval and after approval, using column security profiles and a low-code plug-in documented in `solution/CEAPlatform/Plugins/CreatorEditLock.md` (R5, FR-003)
- [X] T011 [P] [US1] Create business rules in `solution/CEAPlatform/BusinessRules/` that make request and attachment forms read-only outside Draft/Rejected and show rejection comments to the Creator when a request is returned (UI aid only; enforcement is T010)
- [X] T012 [US1] Ensure Creators can add comments on own requests only, per matrix "Add comments: Own", in `solution/CEAPlatform/SecurityRoles/CEAcreators.xml`

**Checkpoint**: US1 independently usable (MVP).

## Phase 4: User Story 2 — Internal approvers act only on requests in their hierarchy (P1)

**Goal**: An Internal approver sees only requests at their step or decided by them within their BU hierarchy, approves/rejects with mandatory comment, and cannot create or edit.
**Independent Test**: Sign in as an approver of one plant; approve or reject a request of that plant, verify no visibility or action on another plant's request and no edit possible (quickstart scenario 3). Independently testable.

- [X] T013 [US2] Define the `CEA Internal Approvals` privileges in `solution/CEAPlatform/SecurityRoles/CEAInternalApprovals.xml`: no create/write/delete/append on request and attachment tables; create on decision records only; no base read on requests (R3, FR-006)
- [X] T014 [US2] Create the flow `solution/CEAPlatform/Flows/GrantApproverAccess.json` that shares the request with the approver (access team / per-record sharing) when a level starts and keeps the share after the decision, within the approver's BU hierarchy (R3, FR-004)
- [X] T015 [US2] Implement in `solution/CEAPlatform/Plugins/DecisionGuard.cs` (PreValidation, Create/Update of the decision table of Spec 5) the step-ownership check: block the decision when the request is not at the approver's step (FR-004, R4)
- [X] T016 [US2] Extend `solution/CEAPlatform/Plugins/DecisionGuard.cs` to require a non-empty comment on every approve and reject by `CEA Internal Approvals` (FR-005, SC-004) and to block creation or edit of request data and attachments (FR-006)
- [X] T017 [US2] Extend `solution/CEAPlatform/Plugins/DecisionGuard.cs` so that no user can approve or reject a request they created (FR-013), and write an Access Denial Record (Action = Approve/Reject/Edit) for each blocked attempt (FR-015)
- [X] T018 [US2] Register the plug-in steps (synchronous) in `solution/CEAPlatform/Plugins/` and publish; verify the guard rejects out-of-step and empty-comment decisions

**Checkpoint**: US2 independently testable.

## Phase 5: User Story 5 — Visibility follows the Business Unit hierarchy (P1)

**Goal**: Users see records of their own Business Unit and those below it (Enterprise sees all; Company its regions and plants; Region its plants; Plant only its plant), subject to role limits.
**Independent Test**: Create requests in two plants of different regions; a Region user sees only their region's plants and a Plant user only their plant (quickstart scenario 7). Independently testable.

- [X] T019 [US5] Set record read depth to Parent/Child Business Unit for `CEA Approvals` and organization depth for `CEA Administrators` on request, attachment and comment tables in `solution/CEAPlatform/SecurityRoles/` (R2, FR-011)
- [X] T020 [US5] Verify requests are owned by the Business Unit of the Creator (ownership by BU, per Spec 1 user's single Business Unit) in `solution/CEAPlatform/Tables/BusinessUnitOwnership.md`, documenting how Spec 4 request tables set the owning BU (FR-011)
- [X] T021 [US5] Create the flow `solution/CEAPlatform/Flows/FlagReassignmentOnRoleOrBuChange.json` that, when a user's roles or Business Unit change, sets `Needs Reassignment` on requests with pending decisions of that approver and does not alter request history (FR-016, FR-017, R9)
- [X] T022 [P] [US5] Add an "Access Denial Records" view (read-only, Administrators) and a "Requests Needing Reassignment" view in `solution/CEAPlatform/ModelDrivenApp/Views/` and add them to the sitemap

**Checkpoint**: US5 independently testable.

## Phase 6: User Story 3 — Read-only consultation across the platform (P2)

**Goal**: `CEA Approvals` users have read-only access to all requests in their BU hierarchy, including history, status, comments, approvals and attachments.
**Independent Test**: Sign in as a CEA Approvals user, open requests from different plants in the hierarchy, and verify no create, edit, approve, reject or attachment action exists (quickstart scenario 4). Independently testable.

- [X] T023 [US3] Define the `CEA Approvals` privileges in `solution/CEAPlatform/SecurityRoles/CEAApprovals.xml`: read only on request, attachment, comment and decision tables; "no create/write/delete/append" (R6, FR-007)
- [X] T024 [US3] Add the read-only app view of request history, comments, approvals and attachments for `CEA Approvals` in `solution/CEAPlatform/ModelDrivenApp/` with all action buttons hidden by privilege, not by UI alone (FR-007, FR-014)

## Phase 7: User Story 4 — Administrators manage the platform and all requests (P2)

**Goal**: `CEA Administrators` see all requests, create/edit requests, upload attachments, add comments, and decide only at Initial and Revision Review; no chain approval.
**Independent Test**: Sign in as an administrator, open any request, perform a review, and verify approve/reject are not available at chain steps (quickstart scenario 5). Independently testable.

- [X] T025 [US4] Extend the `CEA Administrators` role (from Spec 1, T010) in `solution/CEAPlatform/SecurityRoles/CEAAdministrators.xml`: organization-wide read, write on requests, attachments and comments, create on Initial/Revision Review decision tables, and "no privilege on chain decision rows" (R7, FR-008, FR-009)
- [X] T026 [US4] Extend `solution/CEAPlatform/Plugins/DecisionGuard.cs` to allow administrator decisions only at Initial Review and Revision Review, with a mandatory comment, and block them at approval-chain steps (FR-009, SC-005)
- [X] T027 [P] [US4] Grant Administrators the privileges to manage roles, reference data and reassignment (restart/reassign exceptions) and read `cea_accessdenialrecord` in `solution/CEAPlatform/SecurityRoles/CEAAdministrators.xml` (FR-008, FR-015)
- [X] T028 [P] [US4] Create the self-approval skip behavior spec in `solution/CEAPlatform/Flows/SkipCreatorAsApprover.md` (skip the step automatically, move to the next level and record it in the history) to be honored by the Approval Chain flow of the Approval Chain spec (FR-013)

## Phase 8: Polish & Cross-Cutting

- [X] T029 [P] Write Web API permission-matrix checks in `tests/api/security/permission-matrix.tests.ps1` covering every row of `contracts/permission-matrix.md` for each of the four roles, including denied attempts creating an Access Denial Record
- [ ] T030 [P] Write the UI visibility checks in `tests/ui/security/` (Test Engine) for one user per BU level (Enterprise, Company, Region, Plant)
- [ ] T031 Run all quickstart.md scenarios 1–9 in a clean Dev environment and note results in `specs/002-security-roles-access/quickstart.md`
- [ ] T032 Verify the Users-list/request-list load stays under 3 seconds with 500 seeded users and record the measurement in `specs/002-security-roles-access/quickstart.md`
- [X] T033 Amend `.specify/memory/constitution.md` so the read-only role wording ("all records") reflects the BU-hierarchy limit (R11), as a separate constitution revision
- [X] T034 Confirm the Complexity Tracking entry in `plan.md` against the final plug-in list (`DecisionGuard.cs` only) and update it
- [X] T035 Export the solution (`pac solution export` + `unpack`) into `solution/CEAPlatform/` and commit

## Dependencies & Execution Order

- Phase 1 → Phase 2 → user stories. Phase 2 blocks everything.
- US1, US2 and US5 (P1) are independent of each other once Phase 2 is done; US1 is the MVP.
- US2 depends on T008 (plug-in skeleton) and on decision tables from Spec 5 for final registration (feature-flagged until they exist).
- US4 extends `DecisionGuard.cs` after US2 (T026 after T015–T017).
- US3 and US5 role depth settings touch the same role files as US4 (T019, T023, T025): sequence them.
- Polish after all desired stories.

## Parallel Opportunities

- T002/T003; T011 alongside T009/T010; T022 alongside T021; T027/T028; T029/T030.
- After Phase 2, US1, US2 and US3 can proceed in parallel by different people.

## Implementation Strategy

1. Setup + Foundational.
2. US1 → validate → MVP.
3. US2 and US5 (remaining P1), then US3 and US4 (P2).
4. Polish, then export the solution.

**Totals**: 35 tasks — Setup 3, Foundational 5, US1 4, US2 6, US5 4, US3 2, US4 4, Polish 7.

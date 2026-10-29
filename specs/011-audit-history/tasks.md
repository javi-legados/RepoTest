# Tasks: Audit and History

**Input**: `specs/011-audit-history/` (plan.md, spec.md, research.md, data-model.md, contracts/history-events.md, quickstart.md)
**Prerequisites**: `CEAPlatform` solution, `CEAPlatform.Plugins` project and "CEA Administration" app from [Spec 1](../001-users-master-data/data-model.md); roles from Spec 2; `CeaRequest` from [Spec 4](../004-cea-request-form/data-model.md). Tests are not requested by the spec; validation is done through quickstart.md scenarios and Web API rule checks (Polish phase).

**Format**: `- [ ] T### [P] [US#] Description with path` — `[P]` = parallelizable (different files, no dependency on incomplete tasks).

## Phase 1: Setup

- [ ] T001 Verify the existing `CEAPlatform` solution (Spec 1), the shared plug-in project `solution/CEAPlatform/Plugins/CEAPlatform.Plugins.csproj` (Spec 1, reused — do not create a new assembly) and the `CeaRequest` table (Spec 4) are present; pull the latest unpacked solution into `solution/CEAPlatform/`
- [ ] T002 [P] Create the folder `tests/api/audit/` with a `README.md` describing the Web API checks of this spec (existing `tests/api/` from Spec 1 is reused)

## Phase 2: Foundational (blocks all user stories)

- [ ] T003 Create the table `HistoryEntry` per data-model.md in `solution/CEAPlatform/Tables/HistoryEntry/`: Request (Lookup CeaRequest, from Spec 4), Event Type (Choice: Created, Submitted, Review Released, Review Returned, Approved, Rejected, Skipped, Resubmitted, Reassigned, Field Changed, Attachment Added, Attachment Removed, Data Corrected, Notification Outcome, Hold, Resume, Completed), Actor (Lookup User, nullable for System), Actor Name (Text, snapshot), Occurred On (DateTime), Field (Text), Old Value / New Value (Text), Comments (Multiline), Cycle (Whole); "Create-only; no update or delete."
- [ ] T004 Create the table `AdministrativeAuditEntry` in `solution/CEAPlatform/Tables/AdministrativeAuditEntry/`: Event Type (Role Changed, Approver Assignment Changed, Email Failure, Release Blocked, Other), Actor/Actor Name, Occurred On, Old Value, New Value, Reason; "Create-only; Administrators only."
- [ ] T005 Configure security in `solution/CEAPlatform/SecurityRoles/` (roles defined in Spec 2, reused): remove update and delete privileges on `HistoryEntry` and `AdministrativeAuditEntry` for every role; read of `HistoryEntry` inherits the request visibility; read of `AdministrativeAuditEntry` for CEA Administrators only; remove export-to-Excel privilege on both tables (R5, R9, R11; FR-006, FR-008, FR-011)
- [ ] T006 Implement the immutability guard plug-in `solution/CEAPlatform/Plugins/HistoryImmutabilityGuard.cs` (PreValidation, Update and Delete of `HistoryEntry` and `AdministrativeAuditEntry`) rejecting every change including system-level ones, with an explanatory message; justified in plan.md Complexity Tracking (FR-006, SC-002)
- [ ] T007 Implement the shared history writer helper `solution/CEAPlatform/Plugins/HistoryWriter.cs` that writes `HistoryEntry`/`AdministrativeAuditEntry` inside the caller's transaction, stores Actor as lookup and as Actor Name text snapshot, sets Occurred On, and uses Actor = System when no user applies (R3, R6, R7; FR-009, SC-003)
- [ ] T008 [P] Enable Dataverse platform auditing as a complementary backup on the `CeaRequest` table and its child tables from Specs 4/5 in `solution/CEAPlatform/Tables/CeaRequest/audit-settings.md` (R2)
- [ ] T009 Confirm the Request ID auto-number on `CeaRequest` (proposed `CEA-YYYY-NNNNN`, R12) in `solution/CEAPlatform/Tables/CeaRequest/` after the user confirms the format; document the open decision in `specs/011-audit-history/research.md` if still unconfirmed

**Checkpoint**: both tables, create-only security, guard and writer helper exist; user stories can start.

## Phase 3: User Story 1 — See the full history of a request (Priority: P1) 🎯 MVP

**Goal**: An authorized user opens a request and sees a chronological timeline of every lifecycle event with person, date/time and comments.
**Independent Test**: Run a request through a rejection and a completion and verify the timeline shows every event in order, including revision cycles; read-only users see the full history for visible requests only (quickstart scenarios 1, 7).

- [ ] T010 [P] [US1] Add the History timeline subgrid to the `CeaRequest` form in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` showing Event Type, Actor Name, Occurred On, Cycle, Comments sorted by Occurred On ascending, with server paging (page size 50) for long histories (FR-001, FR-007, SC-004)
- [ ] T011 [P] [US1] Create the view `solution/CEAPlatform/ModelDrivenApp/Views/RequestHistory.xml` over `HistoryEntry` with no edit/delete/export commands in the command bar (FR-006, FR-011)
- [ ] T012 [US1] Wire the `HistoryWriter` helper into the lifecycle actions per `contracts/history-events.md` (reuse the existing Specs' components, no new tables): Created/Submitted (Spec 4/6), Review Released/Returned (Spec 6/8), Approved/Rejected/Skipped/Hold/Resume (Spec 7), Reassigned (Spec 3), Resubmitted (Spec 8), Completed (Spec 10); each entry records person or System, date, level/cycle and comments (FR-001, SC-001)
- [ ] T013 [US1] Verify in `solution/CEAPlatform/SecurityRoles/` that CEA Approvals (read-only, Spec 2) and CEA Internal Approvals see the full timeline with comments only for requests they can already see, and that users without access to the request cannot read its `HistoryEntry` rows (FR-007, R8)

**Checkpoint**: US1 independently usable and testable (MVP).

## Phase 4: User Story 2 — Audit changes to data (Priority: P1)

**Goal**: Every field and attachment change made after submission is recorded with old and new values, person and date; Draft edits are not recorded.
**Independent Test**: Edit fields of a submitted request, add/remove an attachment and correct approved data in Final Processing; verify each change is recorded with old/new values; verify Draft edits produce nothing (quickstart scenarios 2–4).

- [ ] T014 [US2] Implement plug-in `solution/CEAPlatform/Plugins/HistoryFieldChangeCapture.cs` (PostOperation, Update of `CeaRequest`, `CostLine`, `ForecastLine` from Spec 4) writing one `Field Changed` entry per changed field with Field, Old Value, New Value, Actor and Occurred On; skip the request while status is Draft and Returned-before-first-submit, and record from Pending Initial Review onward only (R4; FR-002)
- [ ] T015 [US2] Record `Attachment Added` / `Attachment Removed` entries (file name, action, person, date) for the attachment components of Spec 5 (reused) by calling `HistoryWriter` after submission only, in `solution/CEAPlatform/Plugins/HistoryAttachmentCapture.cs` (FR-003)
- [ ] T016 [US2] Record `Data Corrected` entries (Field, Old Value, New Value, person) from the administrative corrections of Spec 10 (reused) through `HistoryWriter` in the Final Processing correction action (FR-001, FR-002)
- [ ] T017 [US2] Ensure that deleting a Draft request removes only its draft-time records (creation entry) and that no bulk delete, retention or archival job exists for `HistoryEntry`/`AdministrativeAuditEntry`; document in `solution/CEAPlatform/Tables/HistoryEntry/retention.md` (R10; FR-010)

**Checkpoint**: US2 independently testable.

## Phase 5: User Story 3 — Audit administrative and system events (Priority: P2)

**Goal**: CEA Administrators review role/approver-assignment changes and system events (failed emails, blocked releases) outside a single request.
**Independent Test**: Change an approver assignment and block a release; verify both appear in the administrative audit view, and that non-administrators cannot see it (quickstart scenario 8).

- [ ] T018 [P] [US3] Create the Administrative Audit view `solution/CEAPlatform/ModelDrivenApp/Views/AdministrativeAudit.xml` (Event Type, Actor Name, Occurred On, Old Value, New Value, Reason) and add the "Administrative Audit" sitemap entry visible only to CEA Administrators in `solution/CEAPlatform/ModelDrivenApp/` (FR-008, R9)
- [ ] T019 [P] [US3] Write `AdministrativeAuditEntry` rows with Old Value, New Value, person and date for role changes (Specs 1/2) and approver assignment changes (Spec 3) by calling `HistoryWriter` in the existing role/assignment plug-ins and flows of those specs (FR-005)
- [ ] T020 [US3] Create the flow `solution/CEAPlatform/Flows/RecordSystemEvents.json` that records the outcome of every notification from Spec 9 (including failures and unsent emails with reason) as `Notification Outcome` `HistoryEntry` rows, and records Email Failure and Release Blocked events (Reason required) as `AdministrativeAuditEntry` rows with Actor = System (FR-004, R7)
- [ ] T021 [US3] Verify non-administrators receive no access to `AdministrativeAuditEntry` through the app or Web API and that the history of every request keeps the Actor Name after the user is deactivated, in `solution/CEAPlatform/SecurityRoles/` (FR-008, FR-009)

**Checkpoint**: US3 independently testable.

## Phase 6: Polish & Cross-Cutting

- [ ] T022 [P] Write Web API rule checks in `tests/api/audit/history-immutability.tests.ps1` covering update/delete rejection on both tables for every role and via API, and absence of export privileges (FR-006, FR-011, SC-002)
- [ ] T023 [P] Write Web API rule checks in `tests/api/audit/history-events.tests.ps1` covering one entry per event type in `contracts/history-events.md`, Draft-edit exclusion, attachment capture, Actor Name retention after deactivation, and Actor/Occurred On populated on 100% of entries (FR-001–FR-004, FR-009, SC-001, SC-003)
- [ ] T024 Run all quickstart.md scenarios (1–9) in a clean Dev environment, confirm there is no export option on the history, measure that a history opens in under 1 minute and long histories page under 3 s, and note results in `specs/011-audit-history/quickstart.md` (SC-004)
- [ ] T025 Confirm the Complexity Tracking entry in `specs/011-audit-history/plan.md` against the final plug-in list (HistoryImmutabilityGuard; shared `HistoryWriter`, `HistoryFieldChangeCapture`, `HistoryAttachmentCapture`) and update it
- [ ] T026 Export the solution (`pac solution export` + `unpack`) into `solution/CEAPlatform/` and commit

## Dependencies & Execution Order

- Phase 1 → Phase 2 → user stories. Phase 2 blocks everything (tables T003/T004, security T005, guard T006, writer T007).
- US1 (P1) depends only on Phase 2 → MVP; T012 needs the event sources of Specs 3–10 to exist.
- US2 (P1) depends on T007 and Spec 4/5/10 components; independent of US1's timeline UI.
- US3 (P2) depends on T004, T005, T007; independent of US1/US2.
- Polish after all desired stories.

## Parallel Opportunities

- T001/T002; T008 with T003–T007; T010/T011; T018/T019; T022/T023.
- After Phase 2, US1, US2 and US3 can proceed in parallel by different people.

## Implementation Strategy

1. Setup + Foundational.
2. US1 → validate → MVP.
3. US2 (P1) next, then US3 (P2).
4. Polish, then export the solution.

**Totals**: 26 tasks — Setup 2, Foundational 7, US1 4, US2 4, US3 4, Polish 5.

# Tasks: Final Processing

**Input**: `specs/010-final-processing/` (plan.md, spec.md, research.md, data-model.md, contracts/final-actions.md, quickstart.md)
**Prerequisites**: Specs 001–009 and 011 deliver the `CEAPlatform` solution, `CeaRequest` (Spec 4), `RequestAttachment` (Spec 5), the approval chain (Spec 7), email notification requests (Spec 9) and audit history (Spec 11); the shared plug-in assembly `solution/CEAPlatform/Plugins/CEAPlatform.Plugins.csproj` already exists. Tests are not requested by the spec; validation is done through quickstart.md scenarios and Web API rule checks (Polish phase).

**Format**: `- [ ] T### [P] [US#] Description with path` — `[P]` = parallelizable (different files, no dependency on incomplete tasks).

## Phase 1: Setup

- [ ] T001 Confirm in the Dev environment that the `CEAPlatform` solution (Spec 1) contains `CeaRequest` (Spec 4), `RequestAttachment` with its `Package` column (Spec 5) and the approval tables (Spec 7); do not recreate them
- [ ] T002 [P] Create the working folders `solution/CEAPlatform/Plugins/FinalProcessing/` and `solution/CEAPlatform/Flows/FinalProcessing/` with a `README.md` in each describing its purpose, reusing the existing `solution/CEAPlatform/Plugins/CEAPlatform.Plugins.csproj` assembly (no new assembly)
- [ ] T003 [P] Create the test folder `tests/api/final-processing/` with a `README.md` describing the Web API rule checks

## Phase 2: Foundational (blocks all user stories)

- [ ] T004 Add to the existing `CeaRequest` table (Spec 4) in `solution/CEAPlatform/Tables/CeaRequest/`: the status values `Final Processing` and `Completed`, `Completed By` (Lookup User) and `Completed On` (DateTime), per data-model.md "CeaRequest additions"
- [ ] T005 Confirm the existing `RequestAttachment` table (Spec 5) in `solution/CEAPlatform/Tables/RequestAttachment/` exposes `Package = Final` to identify final package files; reuse it, no new table (R3)
- [ ] T006 Create the table `DataCorrectionRecord` in `solution/CEAPlatform/Tables/DataCorrectionRecord/` with columns: Request (Lookup), Table / Field (Text), Old Value (Text), New Value (Text), Changed By (Lookup User), Changed On (DateTime); "Create-only. Written only while status = Final Processing."
- [ ] T007 Configure security roles in `solution/CEAPlatform/SecurityRoles/`: remove update/delete privileges on `DataCorrectionRecord` for every role, and grant create/read only to `CEA Administrators` plus read to the Creator and authorized users through normal visibility (R9)
- [ ] T008 Enable the status transition "Approved (all levels) → Final Processing → Completed (final, read-only for all)" in the status model of `CeaRequest` in `solution/CEAPlatform/Tables/CeaRequest/`

**Checkpoint**: columns, table and roles exist; user stories can start.

## Phase 3: User Story 1 — Prepare the final CEA package (Priority: P1) 🎯 MVP

**Goal**: An administrator opens a fully approved request, reviews it, optionally attaches final package files, optionally corrects approved data with every change logged, and completes it.
**Independent Test**: Take a fully approved request, attach the final package, and complete it; verify the request closes with the package stored (quickstart scenarios 2–7 and 9). Independently testable.

- [ ] T009 [US1] Update the last-approval step of the Spec 7 approval-chain logic in `solution/CEAPlatform/Plugins/FinalProcessing/EnterFinalProcessing.cs` so that when "All applicable levels approved" the status becomes `Final Processing` instead of only Approved (R1, FR-001, SC-001, SC-002)
- [ ] T010 [P] [US1] Build the final-processing request form in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequestFinal.xml` showing approved information, the Creator's attachments, the approval history (Spec 11) and a "Final package" subgrid of `RequestAttachment` filtered on `Package = Final`, listed separately from Creator files (FR-002, FR-003)
- [ ] T011 [US1] Implement the `AddFinalFile` rule in `solution/CEAPlatform/Plugins/FinalProcessing/FinalFileGuard.cs` (PreValidation, Create of `RequestAttachment` with `Package = Final`): caller must be CEA Administrator, request must be Final Processing, same rules as Spec 5 (25 MB per file, closed list of file types, 20 files maximum), counted separately from the Creator's attachments (FR-003, FR-005, FR-013, R3, R4)
- [ ] T012 [US1] Implement the correction logger `solution/CEAPlatform/Plugins/FinalProcessing/DataCorrectionLogger.cs` (PostOperation, Update of request, cost and forecast rows while status = Final Processing) writing one `DataCorrectionRecord` per changed field with Request, Table / Field, Old Value, New Value, Changed By, Changed On; approvals remain unchanged (FR-006, FR-011, R5)
- [ ] T013 [US1] Reject edits of approved information by non-administrators during Final Processing and reject stale updates with a clear message using row-version optimistic concurrency in `solution/CEAPlatform/Plugins/FinalProcessing/ApprovedDataEditGuard.cs` (FR-006, FR-012, R6)
- [ ] T014 [US1] Create the custom action `CompleteRequest` (inputs: Request, Confirmation) and implement `solution/CEAPlatform/Plugins/FinalProcessing/CompleteRequest.cs`: requires `Confirmation = true`, caller is CEA Administrator, status is Final Processing; works with or without final files; sets `Completed By`/`Completed On` and status `Completed`; first completion wins and a second call returns "already completed" (FR-004, FR-005, FR-009, FR-010, FR-012, R7, R10)
- [ ] T015 [US1] Add the "Complete request" command with a mandatory confirmation dialog to `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequestFinal.xml` calling `CompleteRequest`, visible only to CEA Administrators while status = Final Processing (FR-010)
- [ ] T016 [US1] Implement the Completed lock in `solution/CEAPlatform/Plugins/FinalProcessing/CompletedLockGuard.cs` (PreValidation, Create/Update/Delete on the request, its child rows and `RequestAttachment` rows when the request is Completed) rejecting every change for every role, including final package files and history (FR-010, R8)
- [ ] T017 [US1] Register the plug-in steps for T009, T011–T014 and T016 and publish the solution; the registrations extend the existing assembly in `solution/CEAPlatform/Plugins/CEAPlatform.Plugins.csproj`

**Checkpoint**: US1 independently usable (MVP).

## Phase 4: User Story 2 — Confirm completion to the Creator (Priority: P1)

**Goal**: The Creator is notified when Final Processing starts and can open the Completed request with its final package.
**Independent Test**: Complete a request and verify the Creator is notified and can open the final package (quickstart scenarios 1, 6 and 8). Independently testable.

- [ ] T018 [P] [US2] Create the flow `solution/CEAPlatform/Flows/FinalProcessing/NotifyFinalProcessingStarted.json` triggered when the status changes to `Final Processing`, creating a notification request (Spec 9 email notification table, reused) for the Creator and for all active CEA Administrators; email content and delivery stay in Spec 9 (FR-008, R1)
- [ ] T019 [P] [US2] Create the flow `solution/CEAPlatform/Flows/FinalProcessing/NotifyRequestCompleted.json` triggered when the status changes to `Completed`, creating a notification request for the Creator (Spec 9) so every status change sends an email (constitution check, contract "CompleteRequest")
- [ ] T020 [US2] Handle the "no active CEA Administrator exists" edge case in `solution/CEAPlatform/Flows/FinalProcessing/NotifyFinalProcessingStarted.json`: notify the Creator and raise an alert through the Spec 9 mechanism when no active administrator is found
- [ ] T021 [US2] Verify the Creator and authorized users can read a Completed request, its history and its `Package = Final` files through normal visibility without extra sharing, adjusting `solution/CEAPlatform/SecurityRoles/` read privileges only if needed (FR-007, R9)

## Phase 5: User Story 3 — Work final processing among administrators (Priority: P2)

**Goal**: Any CEA Administrator can see all pending and completed Final Processing requests in a shared list.
**Independent Test**: Have two administrators open the Final Processing list and verify both see the same pending requests (quickstart scenarios 1 and 5). Independently testable.

- [ ] T022 [P] [US3] Create the system view "Final Processing Queue" in `solution/CEAPlatform/ModelDrivenApp/Views/FinalProcessingQueue.xml` filtered on status = Final Processing with columns request, approval date and Creator, with no per-administrator reservation (FR-001, SC-001, SC-004, R2)
- [ ] T023 [P] [US3] Create the view "Completed Requests" in `solution/CEAPlatform/ModelDrivenApp/Views/CompletedRequests.xml` showing Completed By and Completed On (FR-009, SC-003)
- [ ] T024 [US3] Add the "Final Processing" area with both views to the sitemap in `solution/CEAPlatform/ModelDrivenApp/` visible to `CEA Administrators` (extends the Spec 1 app skeleton) and verify the queue opens in under 3 s
- [ ] T025 [US3] Show a clear conflict message in the form when a concurrent edit is rejected or the request was already completed by another administrator, in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequestFinal.xml` (FR-012)

## Phase 6: Polish & Cross-Cutting

- [ ] T026 [P] Write Web API rule checks in `tests/api/final-processing/final-processing-rules.tests.ps1` covering every row of `contracts/final-actions.md`: complete with and without files, `AddFinalFile` limits (21st file rejected), correction logging, stale edit rejected, missing confirmation, already completed, non-administrator denied, and any create/update/delete after completion denied for every role
- [ ] T027 [P] Verify the audit history (Spec 11) shows `DataCorrectionRecord` entries and Completed By/On in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequestFinal.xml`
- [ ] T028 Run all quickstart.md scenarios 1–9 in a clean Dev environment and note results in `specs/010-final-processing/quickstart.md`
- [ ] T029 Confirm the Complexity Tracking entry in `plan.md` against the final plug-in list (EnterFinalProcessing, FinalFileGuard, DataCorrectionLogger, ApprovedDataEditGuard, CompleteRequest, CompletedLockGuard) and update it; flag the "direct correction without repeating approvals" decision for user confirmation
- [ ] T030 Export the solution (`pac solution export` + `unpack`) into `solution/CEAPlatform/`

## Dependencies & Execution Order

- Phase 1 → Phase 2 → user stories. Phase 2 blocks everything.
- US1 (P1) depends only on Phase 2 and earlier specs → MVP.
- US2 (P1) depends on T004 and T009 (status transitions) but is independently testable; its flows need Spec 9.
- US3 (P2) depends on T004 only; independently testable.
- Polish after all desired stories.

## Parallel Opportunities

- T002/T003; T010 with T009; T018/T019; T022/T023; T026/T027.
- After Phase 2, US2 flows and US3 views can proceed in parallel with US1 plug-ins by different people.

## Implementation Strategy

1. Setup + Foundational.
2. US1 → validate → MVP.
3. US2 (also P1) next, then US3.
4. Polish, then export the solution.

**Totals**: 30 tasks — Setup 3, Foundational 5, US1 9, US2 4, US3 4, Polish 5.

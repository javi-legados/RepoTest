# Tasks: Request Attachments

**Input**: `specs/005-request-attachments/` (plan.md, spec.md, research.md, data-model.md, contracts/attachment-rules.md, quickstart.md)
**Prerequisites**: `CEAPlatform` solution, `CEA Administration` app, security roles and `CeaRequest` from earlier specs (Specs 1, 2 and 4) are in place. Tests are not requested by the spec; validation is done through quickstart.md scenarios and Web API rule checks (Polish phase).

**Format**: `- [ ] T### [P] [US#] Description with path` — `[P]` = parallelizable (different files, no dependency on incomplete tasks).

## Phase 1: Setup

- [X] T001 Confirm the existing `CEAPlatform` solution (created in Spec 1) contains the `Tables`, `Plugins` and `ModelDrivenApp` folders and that `solution/CEAPlatform/Plugins/CEAPlatform.Plugins.csproj` (Spec 1) builds; reuse them, do not recreate
- [X] T002 [P] Create the folder `solution/CEAPlatform/Tables/RequestAttachment/` with a short `README.md` describing the table purpose
- [X] T003 [P] Create `tests/api/attachments/` for the upload rule checks with a `README.md` describing its purpose

## Phase 2: Foundational (blocks all user stories)

- [X] T004 Create the table `RequestAttachment` in `solution/CEAPlatform/Tables/RequestAttachment/` with columns: Request (Lookup CeaRequest, "Parental; cascade delete with Draft"), File (File, "≤ 25 MB; allowed types only"), File Name (Text, "Unique per request"), Size (Whole, "Bytes"), Type (Text, "Extension"), Uploaded By (Lookup User, "Auto"), Uploaded On (DateTime, "Auto"), Package (Choice: Request, Final — "Spec 10 counts the final package separately"); reuse `CeaRequest` (Spec 4) and System User (Spec 1)
- [X] T005 Set the File column maximum size to 25 MB in `solution/CEAPlatform/Tables/RequestAttachment/` (R3), mirrored later by the plug-in
- [X] T006 Configure the parental relationship `CeaRequest` → `RequestAttachment` with cascade delete and cascade share/assign so that visibility inherits the request (R7, R8) in `solution/CEAPlatform/Tables/RequestAttachment/`
- [X] T007 Add the security privileges for `RequestAttachment` to the roles defined in Spec 2 in `solution/CEAPlatform/SecurityRoles/`: Creator create/delete/read, CEA Administrators create/read, CEA Internal Approvals and CEA Approvals read only; no update privilege on the File column for any role ("contents are immutable")
- [X] T008 Create the Attachments sub-grid skeleton (File Name, Size, Uploaded By, Uploaded On, Package) on the `CeaRequest` form from Spec 4 in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` and publish

**Checkpoint**: `RequestAttachment` table, security and sub-grid exist; user stories can start.

## Phase 3: User Story 1 — Upload supporting files to a request (P1) 🎯 MVP

**Goal**: A Creator uploads several files to a Draft and sees them listed with name, size, uploader and date; invalid files are rejected individually while valid ones attach.
**Independent Test**: Open a Draft, upload several files at once, and verify they appear with name, size, uploader and upload date; mix in invalid files and verify only those are rejected (quickstart scenarios 1–4). This story is independently testable.

- [X] T009 [US1] Implement plug-in `solution/CEAPlatform/Plugins/AttachmentValidation.cs` (PreValidation, Create of `RequestAttachment`) rejecting: file larger than 25 MB; type not in "PDF, Word, Excel, PowerPoint, JPG, PNG, CSV, TXT, ZIP, DWG, DXF" checked by extension and MIME (R3, R4); each file is validated individually so valid files in the same batch still attach (R5); each rejection carries a clear reason
- [X] T010 [US1] Extend `solution/CEAPlatform/Plugins/AttachmentValidation.cs` to reject a new file whose File Name matches an existing attachment of the same request ("Rejected; rename or remove first") and to reject the 21st file ("max 20 rows per request and package"; extra files rejected) (R5)
- [X] T011 [US1] Extend `solution/CEAPlatform/Plugins/AttachmentValidation.cs` to auto-fill Uploaded By, Uploaded On, File Name, Size and Type from the uploaded file without modifying its contents (FR-003, FR-010, R9)
- [X] T012 [US1] Register the plug-in step for `AttachmentValidation` in `solution/CEAPlatform/Plugins/` and add it to the solution
- [X] T013 [US1] Configure multi-file upload on the Attachments sub-grid in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` using the standard control; test whether it uploads several files in one action (R2, FR-002) and record the outcome in `specs/005-request-attachments/research.md`
- [X] T014 [US1] Only if T013 shows the standard control cannot upload several files per action, build a PCF multi-file uploader in `solution/CEAPlatform/ModelDrivenApp/Components/MultiFileUploader/` that creates one `RequestAttachment` per file and displays each rejection reason (R2)

**Checkpoint**: US1 independently usable (MVP).

## Phase 4: User Story 2 — Remove or replace attachments while the request is editable (P1)

**Goal**: The Creator adds or removes files only while the request is Draft or returned for correction (Rejected); other statuses are view-only.
**Independent Test**: Attach and remove a file in Draft; verify the list updates; move the request out of Draft and verify add/remove is blocked; reject it and verify add/remove works again (quickstart scenarios 5 and 9). This story is independently testable.

- [X] T015 [US2] Implement plug-in `solution/CEAPlatform/Plugins/AttachmentStatusRoleGuard.cs` (PreValidation, Create/Delete of `RequestAttachment`) allowing the Creator only when `CeaRequest` Status (Spec 4) is Draft or Rejected, and denying every other status; reuse the status/role logic of Spec 2 (R6, FR-004)
- [X] T016 [US2] Register the plug-in step for `AttachmentStatusRoleGuard` on Create and Delete in `solution/CEAPlatform/Plugins/` and add it to the solution
- [X] T017 [US2] Hide the add and remove commands of the Attachments sub-grid when the request status is not Draft or Rejected via ribbon/command rules in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` (UI convenience; server guard in T015 is authoritative)
- [X] T018 [US2] Verify that deleting a Draft removes its attachments through the cascade configured in T006 (FR-009, R8)

## Phase 5: User Story 3 — View and download attachments during review (P1)

**Goal**: Anyone who can see a request can view and download its attachments but cannot modify them; users without access to the request cannot reach them.
**Independent Test**: As an approver and a CEA Approvals user, open a visible request and download each attachment; add/remove are unavailable and denied by API; as a user without access, attachments are unreachable (quickstart scenario 6). This story is independently testable.

- [X] T019 [US3] Extend `solution/CEAPlatform/Plugins/AttachmentStatusRoleGuard.cs` to deny Create and Delete of `RequestAttachment` for CEA Internal Approvals and CEA Approvals ("Not available and denied server-side"), and to keep read allowed (FR-005, R6)
- [X] T020 [US3] Verify in `solution/CEAPlatform/SecurityRoles/` that the visibility inherited through the parental relationship (T006) gives view/download to every user who can see the request per the Spec 2 BU-hierarchy rules, and denies it otherwise (FR-006, R7)
- [X] T021 [P] [US3] Make the Attachments sub-grid read-only for approvers and read-only users, with a download action per row, in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`
- [X] T022 [US3] Ensure CEA Administrators can access every attachment of the request for final documentation in `solution/CEAPlatform/SecurityRoles/` (User Story 3, scenario 4)

## Phase 6: User Story 4 — Administrators add supporting files (P2)

**Goal**: A CEA Administrator uploads supporting documentation to a request in any status, shown as uploader.
**Independent Test**: As an administrator, upload a file to a request under review and verify the administrator is listed as uploader; as CEA Internal Approvals, verify upload is not available (quickstart scenario 7). This story is independently testable.

- [X] T023 [US4] Extend `solution/CEAPlatform/Plugins/AttachmentStatusRoleGuard.cs` so CEA Administrators may create `RequestAttachment` in any status ("Administrator add: Any status; shows administrator as uploader"); the same size, type, count and duplicate-name rules of `AttachmentValidation.cs` still apply (R6)
- [X] T024 [US4] Show the add-attachment command on the Attachments sub-grid for the `CEA Administrators` role in any request status in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`
- [X] T025 [US4] Set the Package column default to Request and allow the `CEA Administrators` role to choose Final, applying the 20-row limit separately per request and package in `solution/CEAPlatform/Plugins/AttachmentValidation.cs` ("Spec 10 counts the final package separately")

## Phase 7: Polish & Cross-Cutting

- [X] T026 [P] Write Web API rule checks in `tests/api/attachments/attachment-rules.tests.ps1` covering every row of the table in `contracts/attachment-rules.md` (oversize, disallowed type, duplicate name, 21st file, mixed batch, Creator Draft/Rejected only, Administrator any status, approver/read-only denied, view/download visibility, Draft delete cascade)
- [X] T027 Confirm that no plug-in or flow transforms file contents, as required by FR-010 and R9, by reviewing `solution/CEAPlatform/Plugins/` and `solution/CEAPlatform/Flows/`
- [ ] T028 Verify that attachments persist through save, submit, reject, return for revision and approve (FR-008, SC-002) and that add/remove events are available for the audit history of Spec 11 (add/remove recorded)
- [ ] T029 Measure that 5 files can be attached in under 2 minutes (SC-001) and record the result in `specs/005-request-attachments/quickstart.md`
- [ ] T030 Run all quickstart.md scenarios 1–9 in a clean Dev environment and note results in `specs/005-request-attachments/quickstart.md`
- [X] T031 Confirm the Complexity Tracking entry in `plan.md` against the final plug-in list (`AttachmentValidation`, `AttachmentStatusRoleGuard`) and the outcome of T013/T014 (PCF only if needed), and update it
- [ ] T032 Export the solution (`pac solution export` + `unpack`) into `solution/CEAPlatform/` and commit

## Dependencies & Execution Order

- Phase 1 → Phase 2 → user stories. Phase 2 blocks everything and relies on Specs 1, 2 and 4.
- US1 (P1) has no dependency on other stories → MVP.
- US2 and US3 reuse `AttachmentStatusRoleGuard.cs` (T015) but are independently testable; T019 depends on T015.
- US4 depends on T015 and T009 (shared guard and validation) but is independently testable.
- Polish after all desired stories.

## Parallel Opportunities

- T002/T003; T021 alongside T019/T020.
- After Phase 2, US1 and US2 can proceed in parallel by different people (different plug-in files).

## Implementation Strategy

1. Setup + Foundational.
2. US1 → validate → MVP.
3. US2 and US3 (both P1) next, then US4 (P2).
4. Polish, then export the solution.

**Totals**: 32 tasks — Setup 3, Foundational 5, US1 6, US2 4, US3 4, US4 3, Polish 7.

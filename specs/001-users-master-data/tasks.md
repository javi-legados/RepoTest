# Tasks: Users and Master Data

**Input**: `specs/001-users-master-data/` (plan.md, spec.md, research.md, data-model.md, contracts/ui-and-rules.md, quickstart.md)
**Prerequisites**: Power Platform Dev environment with Dataverse; `pac` CLI authenticated. Tests are not requested by the spec; validation is done through quickstart.md scenarios (Polish phase).

**Format**: `- [ ] T### [P] [US#] Description with path` — `[P]` = parallelizable (different files, no dependency on incomplete tasks).

## Phase 1: Setup

- [ ] T001 Create the `CEAPlatform` unmanaged solution in the Dev environment and a publisher prefix `cea`; export/unpack it to `solution/CEAPlatform/`
- [ ] T002 [P] Create the folder layout `solution/CEAPlatform/{Tables,SecurityRoles,ModelDrivenApp,BusinessRules,Flows,Plugins}` and `tests/{ui,api}` with a `README.md` in each describing its purpose
- [ ] T003 [P] Create `solution/CEAPlatform/Plugins/CEAPlatform.Plugins.csproj` (.NET Framework 4.6.2, Microsoft.CrmSdk.CoreAssemblies) with a signing key, per plan.md Technical Context

## Phase 2: Foundational (blocks all user stories)

- [ ] T004 Configure the Business Unit hierarchy in Dataverse: root BU "Enterprise" and add column `cea_level` (Choice: Enterprise/Company/Region/Plant) to Business Unit in `solution/CEAPlatform/Tables/BusinessUnit/`
- [ ] T005 Add the user extension columns to System User in `solution/CEAPlatform/Tables/SystemUser/`: `cea_sapnumber` (Text, Required), `cea_department` (Text, Required), `cea_manageremail` (Text, Required, email format), `cea_managername` (Text, Required), `cea_incomplete` (Yes/No calculated)
- [ ] T006 Define alternate keys on System User for SAP Number (`cea_sapnumber`) and Email (`internalemailaddress`) in `solution/CEAPlatform/Tables/SystemUser/keys.xml`
- [ ] T007 Create the catalog tables per data-model.md: `cea_company`, `cea_region`, `cea_plant` (Name Required, unique within parent; Parent lookup Plant→Region→Company; Business Unit lookup; State Active/Inactive) in `solution/CEAPlatform/Tables/`
- [ ] T008 Create the immutable table `cea_userchangerecord` (User lookup, Changed By lookup, Changed On DateTime, Field Text, Old Value Text, New Value Text) in `solution/CEAPlatform/Tables/UserChangeRecord/`
- [ ] T009 Create the model-driven app "CEA Administration" skeleton with sitemap (Users, Incomplete Users, Companies, Regions, Plants, User Change Records) in `solution/CEAPlatform/ModelDrivenApp/`
- [ ] T010 Define the security-role stubs `CEA Administrators` (full CRUD on Users and catalogs, read-only on User Change Records) and no access for other CEA roles in `solution/CEAPlatform/SecurityRoles/`; remove update/delete privileges on `cea_userchangerecord` for every role (detailed matrix in Spec 2)

**Checkpoint**: tables, keys and app skeleton exist; user stories can start.

## Phase 3: User Story 1 — Register a user with complete data (P1) 🎯 MVP

**Goal**: Administrator registers a user with all mandatory data and at least one role; unregistered people cannot access the platform.
**Independent Test**: Register a user with complete data and verify sign-in, role and Business Unit; verify duplicates and missing data are rejected (quickstart scenarios 1–3).

- [ ] T011 [P] [US1] Build the User form in `solution/CEAPlatform/ModelDrivenApp/Forms/User.xml` with SAP Number, Name, Email, Department, Manager Name, Manager Email, Business Unit all marked Required and inactive BUs filtered out of the lookup
- [ ] T012 [P] [US1] Create business rules in `solution/CEAPlatform/BusinessRules/` to make mandatory fields required and flag `cea_incomplete` when any is empty
- [ ] T013 [US1] Implement plug-in `solution/CEAPlatform/Plugins/UserValidation.cs` (PreValidation, Create/Update of systemuser) enforcing: Email and Manager Email valid format; user cannot be own manager (compare Email to Manager Email); exactly one Business Unit; at least one security role on save
- [ ] T014 [US1] Show the warning "Manager is not registered" on the User form when Manager Email matches no active user, and record the block "cannot submit until manager registered with CEA Internal Approvals" as a flag column `cea_managerregistered` in `solution/CEAPlatform/Tables/SystemUser/` (FR-006a)
- [ ] T015 [US1] Restrict platform access to registered users: keep the model-driven app visible only to users holding a CEA role, and document in `solution/CEAPlatform/SecurityRoles/README.md` that unregistered identities receive no role (FR-001)
- [ ] T016 [US1] Register the plug-in step and publish the solution; verify duplicate SAP Number/Email creation is rejected by the alternate keys

**Checkpoint**: US1 independently usable (MVP).

## Phase 4: User Story 2 — Keep user and manager information up to date (P2)

**Goal**: Changes to department, manager, BU or roles are recorded and never re-route requests already submitted.
**Independent Test**: Change a user's manager; verify a User Change Record exists and in-flight requests are unchanged (quickstart scenario 4).

- [ ] T017 [US2] Create the Power Automate flow `solution/CEAPlatform/Flows/RecordUserChange.json` triggered on update of Manager Name, Manager Email, Department, Business Unit and role association; write one `cea_userchangerecord` per changed field with Changed By, Changed On, Old/New Value (FR-012)
- [ ] T018 [US2] Enable Dataverse auditing on System User and the catalog tables as a second, native audit source, in `solution/CEAPlatform/Tables/SystemUser/audit-settings.md`
- [ ] T019 [US2] Implement plug-in `solution/CEAPlatform/Plugins/UserDeactivationGuard.cs` (PreOperation, SetState on systemuser) that rejects deactivation when the user has own requests in Draft/review/approval or requests awaiting their decision, with an explanatory message (FR-008a); until Spec 4 tables exist, query is feature-flagged to return no matches
- [ ] T020 [US2] Document in `specs/001-users-master-data/contracts/ui-and-rules.md` (rule row) that manager/BU changes apply only to new requests (FR-014), to be honored by the approver-resolution step of Spec 3

## Phase 5: User Story 3 — Maintain plant and region catalogs (P2)

**Goal**: Administrator maintains Company > Region > Plant catalogs aligned with the BU hierarchy.
**Independent Test**: Add a plant under a region and see it as BU assignment option and project location; deleting an in-use plant is blocked (quickstart scenario 5).

- [ ] T021 [P] [US3] Build forms and views for Company, Region and Plant in `solution/CEAPlatform/ModelDrivenApp/Forms/` and `Views/` (Name, Parent, State; Active Plants view used for project location)
- [ ] T022 [P] [US3] Create the Business Unit synchronization flow `solution/CEAPlatform/Flows/SyncCatalogToBusinessUnit.json` creating/updating the linked BU with the correct `cea_level` and parent (FR-009)
- [ ] T023 [US3] Implement plug-in `solution/CEAPlatform/Plugins/CatalogDeleteGuard.cs` (PreValidation, Delete of company/region/plant) rejecting deletion when users or requests reference the entry and advising to deactivate (FR-011)
- [ ] T024 [US3] Validate hierarchy levels (Region under Company, Plant under Region; no plant under plant) via lookup filters in the forms and a check in `CatalogDeleteGuard.cs`'s sibling `solution/CEAPlatform/Plugins/CatalogHierarchyValidation.cs` (FR-009)
- [ ] T025 [US3] Ensure inactive catalog entries are excluded from user BU assignment and project-location lookups through view filters in `solution/CEAPlatform/ModelDrivenApp/Views/` (FR-010, FR-011)

## Phase 6: User Story 4 — Review the user directory (P3)

**Goal**: Administrator searches, filters and audits user data completeness.
**Independent Test**: Filter by Business Unit and role; incomplete records are flagged (quickstart scenario 6).

- [ ] T026 [P] [US4] Create the Users view in `solution/CEAPlatform/ModelDrivenApp/Views/Users.xml` with columns SAP Number, Name, Email, Department, Role, Business Unit, State, Incomplete flag; quick find on name and SAP Number; filters on department, role and BU (FR-013)
- [ ] T027 [P] [US4] Create the Incomplete Users view in `solution/CEAPlatform/ModelDrivenApp/Views/IncompleteUsers.xml` filtered on `cea_incomplete = Yes`
- [ ] T028 [P] [US4] Create the read-only User Change Records view in `solution/CEAPlatform/ModelDrivenApp/Views/UserChangeRecords.xml`
- [ ] T029 [US4] Verify the Users view returns filtered results in under 3 seconds with 500 seeded users using `tests/api/seed-users.ps1` and record the measurement in `specs/001-users-master-data/quickstart.md`

## Phase 7: Polish & Cross-Cutting

- [ ] T030 [P] Write Web API rule checks in `tests/api/users-rules.tests.ps1` covering every row of the "Server-side rules" table in `contracts/ui-and-rules.md`
- [ ] T031 [P] Write the UI scenarios in `tests/ui/` (Test Engine) for registration, incomplete flag, and catalog delete block
- [ ] T032 Run all quickstart.md scenarios in a clean Dev environment and note results in `specs/001-users-master-data/quickstart.md`
- [ ] T033 Confirm the Complexity Tracking entry in `plan.md` against the final plug-in list (UserValidation, UserDeactivationGuard, CatalogDeleteGuard, CatalogHierarchyValidation) and update it
- [ ] T034 Export the solution (`pac solution export` + `unpack`) into `solution/CEAPlatform/` and commit

## Dependencies & Execution Order

- Phase 1 → Phase 2 → user stories. Phase 2 blocks everything.
- US1 (P1) has no dependency on other stories → MVP.
- US2 depends on US1 tables/forms (T011) but is independently testable.
- US3 is independent of US1/US2; US4 depends on T005 (`cea_incomplete`) and T008.
- Polish after all desired stories.

## Parallel Opportunities

- T002/T003; T011/T012; T021/T022; T026/T027/T028; T030/T031.
- After Phase 2, US1, US3 and US4 views can proceed in parallel by different people.

## Implementation Strategy

1. Setup + Foundational.
2. US1 → validate → MVP.
3. US3 and US2 (both P2) next, then US4.
4. Polish, then export the solution.

**Totals**: 34 tasks — Setup 3, Foundational 7, US1 6, US2 4, US3 5, US4 4, Polish 5.

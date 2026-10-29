# Tasks: CEA Request Form

**Input**: `specs/004-cea-request-form/` (plan.md, spec.md, research.md, data-model.md, contracts/form-rules.md, quickstart.md)
**Prerequisites**: Specs 1–3 implemented (solution `CEAPlatform`, users, catalogs, roles, approver assignment). Tests are not requested by the spec; validation is done through quickstart.md scenarios and Web API rule checks (Polish phase).
**Reuse**: The `CEAPlatform` solution, the `cea_plant` catalog (Spec 1), System User extension columns `cea_department` (Spec 1) and the CEA model-driven app/security roles (Specs 1–2) are reused, not recreated. `CeaRequest` is created here and reused by Specs 5–11.
**Complexity note**: plan.md Complexity Tracking lists no violations; no plug-in is created in this spec. Submit-time validation (forecast = 100%, Grand Total > 0, completeness list) is implemented once in the submit action owned by Spec 6 (R13).

**Format**: `- [ ] T### [P] [US#] Description with path` — `[P]` = parallelizable (different files, no dependency on incomplete tasks).

## Phase 1: Setup

- [ ] T001 Confirm the `CEAPlatform` solution from Spec 1 is available in the Dev environment with the `cea` publisher prefix, and that `cea_plant` (Spec 1) and `cea_department` on System User (Spec 1) exist; do not recreate them
- [ ] T002 [P] Create the folders `solution/CEAPlatform/Tables/CeaRequest/`, `solution/CEAPlatform/Tables/CostLine/` and `solution/CEAPlatform/Tables/ForecastLine/` with a `README.md` in each describing its purpose
- [ ] T003 [P] Create `tests/api/cea-request/` and `tests/ui/cea-request/` (reusing the `tests/{ui,api}` layout from Spec 1) with a `README.md` in each

## Phase 2: Foundational (blocks all user stories)

- [ ] T004 Create table `cea_request` ("CeaRequest") in `solution/CEAPlatform/Tables/CeaRequest/` with `Request ID` (Auto-number, "Unique; format defined in Spec 11"), `Status` (Choice: Draft, Pending Initial Review, Pending Approval, Rejected, Revision Review, Approved, Completed, On Hold; default Draft) and `Creator` (Lookup User, "Owner") (R1)
- [ ] T005 [P] Create table `cea_costline` ("CostLine") in `solution/CEAPlatform/Tables/CostLine/` with `Request` (Lookup cea_request), `Group` (Choice: Modifications to Existing Building, Non-Capitalized Expenses, Processing System, Packaging Equipment, Others), `Description` (Text), `Cost` (Decimal, 2 places; "≥ 0, numeric"); amounts are Decimal, not Dataverse Currency type (R12)
- [ ] T006 [P] Create table `cea_forecastline` ("ForecastLine") in `solution/CEAPlatform/Tables/ForecastLine/` with `Request` (Lookup cea_request), `Year`, `Month`, `Percentage` (Decimal, 2 places), `Amount` (calculated, added in US5), `Comments` (Text)
- [ ] T007 Create the six-value Currency Choice (USD, EUR, GBP, UAH, CNY, AUD) and the ten-value Project Category Choice (Asset Replacement, Capacity Requirements, Cost Savings, Disposal, Innovation, Modification of Existing Facilities, New Facilities, Operational Requirements, Quality Improvement, Regulatory Compliance) in `solution/CEAPlatform/Tables/CeaRequest/` (FR-008, FR-009)
- [ ] T008 Add the "CEA Request" main form skeleton with one tab per section (Requester Data, Project Category, Schedule and Project, Financial Data, Monetary Values, Spending Forecast, Project Details) and a "CEA Requests" entry to the existing "CEA Administration"/CEA app sitemap (Spec 1) in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`
- [ ] T009 Add table privileges for `cea_request`, `cea_costline` and `cea_forecastline` to the CEA Creator security role stub in `solution/CEAPlatform/SecurityRoles/` (Creator-owned records only; detailed matrix and Business Unit scoping in Spec 2)

**Checkpoint**: tables, choices and form skeleton exist; user stories can start.

## Phase 3: User Story 1 — Create and save a request Draft (P1) 🎯 MVP

**Goal**: A Creator opens a new request with requester data filled automatically, saves a partially completed Draft, and reopens it later.
**Independent Test**: Create a request, fill part of the form, save, close, reopen; verify data is kept and system fields are correct (quickstart scenarios 1–2). Independently testable.

- [ ] T010 [P] [US1] Add columns `Project Manager`, `Location`, `Department`, `Date` ("Auto, read-only", "From Creator") to `cea_request` in `solution/CEAPlatform/Tables/CeaRequest/` (FR-001)
- [ ] T011 [US1] Create the flow `solution/CEAPlatform/Flows/PopulateRequesterData.json` that, on create of `cea_request`, fills Project Manager, Location (Business Unit/plant from Spec 1), Department (`cea_department`, Spec 1) and Date (current date) from the Creator (R2, FR-001)
- [ ] T012 [P] [US1] Build the Requester Data and Project Category sections of `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` with Project Manager, Location, Department and Date locked read-only (FR-001)
- [ ] T013 [P] [US1] Create business rules in `solution/CEAPlatform/BusinessRules/DraftRequiredFields.xml` making all fields of section 1 (Requester Data) and section 2 (Project Category) required when saving, and leaving other sections optional while Status = Draft (R3, FR-002)
- [ ] T014 [US1] Configure the form and views so a Draft stays editable and reopenable until submission, and a deleted/abandoned Draft is never routed for review (no approval or notification triggers fire for Status = Draft), in `solution/CEAPlatform/ModelDrivenApp/Views/MyDrafts.xml`

**Checkpoint**: US1 independently usable (MVP).

## Phase 4: User Story 2 — Describe the project, schedule, and supplemental status (P1)

**Goal**: Creator enters schedule, Supplemental / Addendum answer and project description; the right fields appear and are required.
**Independent Test**: Toggle Supplemental / Addendum Yes/No and verify visible and required fields, date order and the 300-character limit (quickstart scenario 3). Independently testable.

- [ ] T015 [P] [US2] Add columns `Start Date`, `Estimated Completion Date` (Date; "Completion ≥ Start"), `Supplemental / Addendum` (Yes/No, "Required"), `Existing CEA Reference` (Lookup cea_request; "Required if Supplemental = Yes"), `Project Name` (Text), `Project Location (Plant)` (Lookup `cea_plant` from Spec 1; "Required if Supplemental = No"), `Description Summary` (Text, max length 300) to `cea_request` in `solution/CEAPlatform/Tables/CeaRequest/`
- [ ] T016 [US2] Create business rules in `solution/CEAPlatform/BusinessRules/SupplementalRules.xml`: Supplemental = Yes shows and requires Existing CEA Reference and hides Project Name/Project Location; Supplemental = No requires Project Name and Project Location (FR-004, FR-005, FR-006)
- [ ] T017 [P] [US2] Create business rule `solution/CEAPlatform/BusinessRules/DateOrder.xml` rejecting an Estimated Completion Date earlier than the Start Date with an explanatory message (FR-003)
- [ ] T018 [P] [US2] Filter the Existing CEA Reference lookup to `cea_request` rows with the same Creator and submitted status (empty list when none exist), and the Project Location lookup to active `cea_plant` rows (Spec 1), in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` (R10, FR-005, FR-006)
- [ ] T019 [US2] Add the Schedule and Project section (dates, Supplemental toggle, Existing CEA Reference, Project Name, Project Location, Description Summary with the 300-character limit enforced by column length) to `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` (FR-007)
- [ ] T020 [US2] Create the flow `solution/CEAPlatform/Flows/ClearHiddenSupplementalFields.json` that clears Project Name/Project Location (Supplemental → Yes) or Existing CEA Reference (→ No) server-side, complementing the form business rule (R9, FR-020)

## Phase 5: User Story 3 — Select category, currency, and enter financial data (P1)

**Goal**: Creator picks one category and one currency, states Project in Plan, and enters financial data; metrics show only for the four categories that require them.
**Independent Test**: Choose each category and verify Pay Back, IRR and NPV appear only for Capacity Requirements, Cost Savings, Innovation, New Facilities; toggle Project in Plan (quickstart scenarios 4, 9, 10). Independently testable.

- [ ] T021 [P] [US3] Add columns `Category` (Choice, 10 values; "Required (Draft)"), `Currency` (Choice USD, EUR, GBP, UAH, CNY, AUD; "Required"), `Project in Plan` (Yes/No), `Budgeted Amount` (Decimal; "Budgeted required if Yes"), `Investment Required`, `Non-Capitalized Expenses`, `Write-Off` (Decimal(2)), `Pay Back (years)` (Whole), `IRR %` (Decimal), `NPV` (Decimal; "Only for 4 categories") to `cea_request` in `solution/CEAPlatform/Tables/CeaRequest/` (FR-008–FR-012)
- [ ] T022 [US3] Create business rules in `solution/CEAPlatform/BusinessRules/CategoryMetrics.xml` showing and requiring Pay Back, IRR and NPV only for Capacity Requirements, Cost Savings, Innovation and New Facilities, hiding and not requiring them otherwise (R11, FR-012)
- [ ] T023 [P] [US3] Create business rule `solution/CEAPlatform/BusinessRules/ProjectInPlan.xml`: Project in Plan = Yes shows and requires Budgeted Amount; No hides it (FR-010)
- [ ] T024 [P] [US3] Add a visible form warning in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` when Project in Plan = Yes and Budgeted Amount < Grand Total, without blocking save or submit (R7, FR-019)
- [ ] T025 [US3] Create the flow `solution/CEAPlatform/Flows/ClearHiddenFinancialFields.json` clearing Pay Back, IRR, NPV and Budgeted Amount server-side when Category or Project in Plan change so they become hidden (R9, FR-020)
- [ ] T026 [US3] Add the Financial Data section (Category/Currency in section 2, Project in Plan, Budgeted Amount, Investment Required, Non-Capitalized Expenses, Write-Off, metrics) to `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml`; display the selected Currency as a label only on amount fields so a currency change leaves amounts unchanged and performs no conversion (R12, FR-021)

## Phase 6: User Story 4 — Itemize monetary values with automatic totals (P1)

**Goal**: Creator adds cost lines in five groups; subtotals and a read-only Grand Total update automatically.
**Independent Test**: Add, edit and delete lines in each group and verify subtotals and Grand Total; verify negative/non-numeric costs are rejected and Others is pre-filled (quickstart scenario 5). Independently testable.

- [ ] T027 [P] [US4] Add rollup columns to `cea_request` in `solution/CEAPlatform/Tables/CeaRequest/`: five group subtotals (rollup of `CostLine.Cost` filtered by Group) and `Grand Total` (rollup of all `CostLine.Cost`; "> 0 at submit"), read-only (R4, FR-013, FR-015)
- [ ] T028 [P] [US4] Enforce `Cost` as numeric with minimum 0 (negative or non-numeric rejected) on `cea_costline` in `solution/CEAPlatform/Tables/CostLine/` (FR-013)
- [ ] T029 [US4] Create the flow `solution/CEAPlatform/Flows/PrefillOthersGroup.json` that on create of `cea_request` adds six `cea_costline` rows in Group Others: Freight, Commissioning Services, Electrical Installation, Mechanical Installation, Custom Fees, Taxes (R8, FR-014)
- [ ] T030 [US4] Add the Monetary Values section to `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` with five editable sub-grids filtered by Group (description + cost), per-group subtotal fields and the read-only Grand Total, refreshing on line add/edit/delete (FR-013, FR-015)
- [ ] T031 [US4] Create `cea_costline` views per group in `solution/CEAPlatform/ModelDrivenApp/Views/CostLines.xml` used by the sub-grids (up to ~50 lines per request)

## Phase 7: User Story 5 — Distribute the spending forecast by month (P1)

**Goal**: Creator distributes the total by year/month percentages; calculated amounts, Total, Calculated and Left are shown; submission readiness requires exactly 100%.
**Independent Test**: Enter 90% then 100% and verify the difference shown and amounts calculated from the Grand Total; duplicate year/month blocked; out-of-schedule month warns (quickstart scenarios 6–7). Independently testable.

- [ ] T032 [P] [US5] Add calculated column `Amount` = Percentage × Grand Total of the parent request (two decimals) to `cea_forecastline` in `solution/CEAPlatform/Tables/ForecastLine/` (R5, FR-016)
- [ ] T033 [P] [US5] Define the alternate key `Request + Year + Month` ("Unique Request + Year + Month") on `cea_forecastline` in `solution/CEAPlatform/Tables/ForecastLine/keys.xml` so duplicate year/month lines are blocked server-side (R6, FR-017)
- [ ] T034 [P] [US5] Add to `cea_request` the columns `Forecast Calculated` (rollup of `ForecastLine.Amount`) and `Forecast Left` (Grand Total − Calculated), plus a rollup of percentages for the 100% check, in `solution/CEAPlatform/Tables/CeaRequest/` (R4, FR-016)
- [ ] T035 [US5] Add the Spending Forecast section to `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` with an editable sub-grid (Year, Month, Percentage, Amount, Comments) and a summary showing Total, Calculated, Left and the difference to 100% (FR-016)
- [ ] T036 [US5] Add a form warning (non-blocking) in `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` when a forecast month falls outside Start Date–Estimated Completion Date (R7, FR-017)
- [ ] T037 [US5] Create the flow `solution/CEAPlatform/Flows/RecalculateForecast.json` (or rely on the calculated column refresh) so forecast amounts and summary recalculate from percentages when the Grand Total changes (US5 scenario 4, FR-016)
- [ ] T038 [US5] Document in `specs/004-cea-request-form/contracts/form-rules.md` the submit checks (percentages = 100 with difference shown) handed to the Spec 6 submit action so the rule is implemented once (R13, FR-017, FR-019)

## Phase 8: User Story 6 — Detailed project description (P2)

**Goal**: Creator writes a multiline detailed description covering objectives, scope, benefits, impact and implementation.
**Independent Test**: Enter a long multiline description and verify it is saved and shown in full; empty value is flagged for submission (quickstart scenario 8). Independently testable.

- [ ] T039 [P] [US6] Add column `Detailed Description` (Multiline text; "Required at submit", not required for Draft) to `cea_request` in `solution/CEAPlatform/Tables/CeaRequest/` (FR-018)
- [ ] T040 [US6] Add the Project Details section to `solution/CEAPlatform/ModelDrivenApp/Forms/CeaRequest.xml` and register "Detailed Description empty" and "Grand Total = 0" in the submit-validation list in `specs/004-cea-request-form/contracts/form-rules.md` for the Spec 6 submit action (R13, FR-018, FR-019)

## Phase 9: Polish & Cross-Cutting

- [ ] T041 [P] Write Web API rule checks in `tests/api/cea-request/form-rules.tests.ps1` covering every row of `contracts/form-rules.md` (auto fields, Draft save, date order, supplemental, 300 chars, category metrics, negative cost, Grand Total, duplicate year/month, hidden-value clearing, currency change)
- [ ] T042 [P] Write Web API calculation checks in `tests/api/cea-request/calculations.tests.ps1` verifying subtotals, Grand Total, forecast Amount, Calculated and Left equal their sources (SC-002)
- [ ] T043 Run all quickstart.md scenarios (1–10) in a clean Dev environment and note results in `specs/004-cea-request-form/quickstart.md`
- [ ] T044 Verify the main form loads in under 3 seconds and totals refresh immediately with ~50 cost lines and ~36 forecast lines (plan.md Performance Goals) and record the result in `specs/004-cea-request-form/quickstart.md`
- [ ] T045 Confirm plan.md Complexity Tracking ("No violations", no plug-in in this spec) still holds and that all amounts use Decimal with two places and no currency conversion exists anywhere in `solution/CEAPlatform/`
- [ ] T046 Export the solution (`pac solution export` + `unpack`) into `solution/CEAPlatform/` and commit

## Dependencies & Execution Order

- Phase 1 → Phase 2 → user stories. Phase 2 blocks everything; depends on Specs 1–3 (plants, users, roles).
- US1 (P1) has no dependency on other stories → MVP.
- US2, US3, US4 depend only on Phase 2 and the `cea_request` table; independently testable.
- US5 depends on T027 (`Grand Total`) and T006; US3's warning (T024) needs T027.
- US6 is independent of US2–US5.
- Submit-time blocking is implemented in Spec 6; this spec supplies the data and rules.
- Polish after all desired stories.

## Parallel Opportunities

- T002/T003; T005/T006; T010/T012/T013; T017/T018; T023/T024; T027/T028; T032/T033/T034; T041/T042.
- After Phase 2, US1–US4 and US6 can proceed in parallel by different people.

## Implementation Strategy

1. Setup + Foundational.
2. US1 → validate → MVP.
3. US2, US3, US4, then US5 (all P1), then US6 (P2).
4. Polish, then export the solution.

**Totals**: 46 tasks — Setup 3, Foundational 6, US1 5, US2 6, US3 6, US4 5, US5 7, US6 2, Polish 6.

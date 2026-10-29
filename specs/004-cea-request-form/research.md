# Research: CEA Request Form

| # | Decision | Rationale | Alternatives |
|---|---|---|---|
| R1 | Single `CeaRequest` table with Status (Draft first); child `CostLine` and `ForecastLine` tables | Sub-grids and rollups are native | JSON fields (no validation) |
| R2 | Requester fields (Project Manager, Location, Department, Date) populated on create by business rule/flow and made read-only | FR-001 | Manual entry |
| R3 | Draft requires sections 1–2 only: required columns are conditional on status; section 3+ checked at submit | FR-002 | All required always |
| R4 | Grand Total = rollup of `CostLine.Cost`; subtotals per group = rollups filtered by Group; Left = Total − Calculated | FR-013/015/016 | Manual totals |
| R5 | Forecast Amount = Percentage × Grand Total as calculated column on `ForecastLine`; Calculated = rollup | FR-016 | Stored value |
| R6 | Unique alternate key Request + Year + Month on `ForecastLine` | Duplicates blocked server-side | UI check |
| R7 | Month outside schedule and Budgeted < Grand Total produce warnings only (form notification, no block) | Clarifications | Block |
| R8 | Others group pre-filled by a flow/plug-in on request creation with six default lines | FR-014 | Manual |
| R9 | Hidden-field discard: business rule clears fields when Supplemental, Project in Plan or Category changes; server-side clear in create/update logic | FR-020 | Leave stale values |
| R10 | Existing CEA Reference: lookup to `CeaRequest` filtered to same Creator and submitted status | FR-005 | Free text |
| R11 | Category Choice with flag for the four metric categories; Pay Back, IRR, NPV required only then | FR-012 | Always show |
| R12 | Currency is a six-value Choice; amounts stored as Decimal with 2 places, not Dataverse Currency type, to avoid exchange-rate behavior | FR-021 | Currency columns |
| R13 | Submit-time validation list (missing fields, forecast = 100%, Grand Total > 0) implemented once in the submit action (Spec 6) | FR-017/FR-019 | Duplicated logic |

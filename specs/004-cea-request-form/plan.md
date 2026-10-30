# Implementation Plan: CEA Request Form

**Branch**: `004-cea-request-form` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Model the CEA request (requester data, schedule, supplemental, category, currency, financials, five cost groups with subtotals and Grand Total, monthly forecast that must total 100%, project details) as Dataverse tables with a main model-driven form with editable sub-grids. Calculations use Dataverse calculated/rollup columns; required-field and conditional rules use business rules; submission-time validation (forecast = 100%, Grand Total > 0, completeness list) runs server-side from the submit action defined in Spec 6.

## Technical Context

**Language/Version**: Dataverse (calculated/rollup columns, business rules), Power Fx in form components; C# plug-in for submit validation only
**Primary Dependencies**: Specs 1–3 (plants, users, roles); Spec 6 (submission action)
**Storage**: Dataverse tables `CeaRequest`, `CostLine`, `ForecastLine`
**Testing**: Web API calculation checks, form UI tests per category and Yes/No toggle, quickstart.md
**Target Platform**: Power Platform environment
**Project Type**: Power Platform solution
**Performance Goals**: Totals refresh immediately on line change; form loads under 3 s
**Constraints**: Two decimals; no currency conversion; hidden values discarded when options change; English only
**Scale/Scope**: Up to ~50 cost lines and ~36 forecast lines per request

## Constitution Check

| Principle / Constraint | Status | Notes |
|---|---|---|
| Standard capabilities first | Pass | Business rules, calculated and rollup columns |
| Justify complexity | Pass | Only submit validation uses a plug-in (Spec 6) |
| Currencies USD, EUR, GBP, UAH, CNY, AUD | Pass | Choice column, no conversion |
| Rules enforced by system | Pass | Validation in platform, not only form |
| Business rules testable | Pass | Contract table lists each rule |

## Project Structure

```text
specs/004-cea-request-form/
├── plan.md  research.md  data-model.md  quickstart.md
└── contracts/form-rules.md
solution/CEAPlatform/
├── Tables/           # CeaRequest, CostLine, ForecastLine
├── BusinessRules/    # Conditional fields, date order, 300-char limit
├── ModelDrivenApp/   # CEA Request main form, sub-grids, summary section
└── Plugins/          # Shared submit validation (owned by Spec 6)
tests/api/ tests/ui/
```

**Structure Decision**: Same solution; one main form with tabs per section.

## Complexity Tracking

Deviation: server-side rules and calculations are implemented with plug-ins (`RequestPlugins.cs`: `RequestRules`, `RequestPrefill`, `LineRules`) instead of business rules, flows and rollup columns. Reason: those features are not available or not reliable in this environment. Totals and forecast columns are plain decimals maintained by the plug-in; the Request ID format `CEA-{SEQNUM:6}` is provisional until Spec 11.

## Closing notes
- T016/T022: show/hide rules implemented in requestForm.js (Supplemental, metrics by category); required-ness enforced server-side.
- T019/T026/T030/T031: the provisioned 'CEA Request' main form has sections, fields and 7 sub-grids (cost groups, forecast); not verified in a browser.

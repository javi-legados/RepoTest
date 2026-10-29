# Data Model: CEA Request Form

Extends Specs [1](../001-users-master-data/data-model.md)–[3](../003-approver-assignment/data-model.md). `CeaRequest` is the central table reused by Specs 5–11.

## CeaRequest

| Column | Type | Rules |
|---|---|---|
| Request ID | Auto-number | Unique; format defined in Spec 11 |
| Status | Choice | Draft, Pending Initial Review, Pending Approval, Rejected, Revision Review, Approved, Completed, On Hold |
| Creator | Lookup User | Owner |
| Project Manager, Location, Department, Date | Auto, read-only | From Creator |
| Start Date, Estimated Completion Date | Date | Completion ≥ Start |
| Supplemental / Addendum | Yes/No | Required |
| Existing CEA Reference | Lookup CeaRequest | Required if Supplemental = Yes |
| Project Name, Project Location (Plant) | Text, Lookup | Required if Supplemental = No |
| Description Summary | Text(300) | |
| Category | Choice (10 values) | Required (Draft) |
| Currency | Choice USD, EUR, GBP, UAH, CNY, AUD | Required |
| Project in Plan, Budgeted Amount | Yes/No, Decimal | Budgeted required if Yes |
| Investment Required, Non-Capitalized Expenses, Write-Off | Decimal(2) | |
| Pay Back (years), IRR %, NPV | Whole, Decimal, Decimal | Only for 4 categories |
| Detailed Description | Multiline | Required at submit |
| Grand Total | Rollup | > 0 at submit |
| Forecast Calculated, Left | Rollup / calculated | |

## CostLine
Request, Group (Modifications to Existing Building, Non-Capitalized Expenses, Processing System, Packaging Equipment, Others), Description, Cost (≥ 0, numeric).

## ForecastLine
Request, Year, Month, Percentage, Amount (calculated), Comments. Unique Request + Year + Month. Sum of percentages = 100 at submit.

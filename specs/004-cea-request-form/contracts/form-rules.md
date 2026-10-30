# Contract: Form Rules

| Rule | Behavior | Type |
|---|---|---|
| Auto fields | Project Manager, Location, Department, Date filled and read-only | Block edit |
| Draft save | Sections 1–2 complete | Block |
| Completion < Start | Rejected | Block |
| Supplemental = Yes | Show Existing CEA Reference; hide name/location | Show/hide + required |
| Supplemental = No | Require name and plant | Required |
| Summary > 300 chars | Not accepted | Block |
| Category in Capacity Requirements, Cost Savings, Innovation, New Facilities | Show and require Pay Back, IRR, NPV | Required |
| Project in Plan = Yes | Show and require Budgeted Amount | Required |
| Cost negative or non-numeric | Rejected | Block |
| Grand Total | Sum of all lines, read-only | Calculated |
| Duplicate year/month in forecast | Rejected | Block |
| Forecast month outside schedule | Warning | Warn |
| Budgeted < Grand Total | Warning | Warn |
| Submit: percentages ≠ 100 | Rejected, difference shown | Block |
| Submit: Grand Total = 0 | Rejected | Block |
| Submit: Detailed Description empty | Rejected | Block |
| Option change hides fields | Hidden values cleared | Auto |
| Currency change | Amounts unchanged | Label only |

## Submit checks (handed to Spec 6)
- Forecast percentages must add up to 100 (the difference is shown as Forecast Left).
- Detailed Description is required at submit; Grand Total must be greater than 0.
- Not enforced in Draft.

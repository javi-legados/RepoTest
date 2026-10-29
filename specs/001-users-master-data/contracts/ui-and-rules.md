# Contracts: Users and Master Data

## Model-driven app "CEA Administration" (CEA Administrators only)

| Component | Contract |
|---|---|
| Users view | Columns: SAP Number, Name, Email, Department, Role, Business Unit, State, Incomplete flag; quick find on name and SAP Number; filters on department, role, BU |
| Incomplete Users view | Users missing any mandatory attribute |
| User form | All mandatory fields marked required; inactive BU/plant not selectable |
| Plants/Regions/Companies views and forms | Name, parent, state; delete disabled when in use |
| User Change Records view | Read-only |

## Server-side rules

| Rule | Check |
|---|---|
| SAP Number and Email unique | Create duplicate → rejected |
| Invalid email format | Rejected |
| User is own manager | Rejected |
| Unregistered manager | Saved with warning |
| Deactivate with open requests/pending decisions | Rejected with explanatory message |
| Delete in-use plant/region/company | Rejected; deactivation allowed |
| Manager or BU change | A User Change Record is created; existing requests unchanged |

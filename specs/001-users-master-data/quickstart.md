# Quickstart: Validating Users and Master Data

1. Import the `CEAPlatform` solution into a Dev environment and open the "CEA Administration" app as a CEA Administrator.
2. Create a user with all mandatory attributes → saved. Omit one → blocked.
3. Create a second user with the same SAP Number, then the same Email → both rejected.
4. Enter an invalid email → rejected.
5. Set a user as their own manager → rejected.
6. Enter an unregistered manager → saved with warning.
7. Change a user's manager and BU → User Change Records appear; open requests unchanged.
8. Deactivate a user with a Draft request → blocked; with none → allowed.
9. Try deleting a plant in use → blocked; deactivate it → no longer offered in new assignments.
10. Search by name, SAP Number, department, role and BU; open the Incomplete Users view.
11. Load 500 users and 50 plants; search returns in under 3 seconds.

## Implementation results (Dev environment, 2026-10-29)

| Scenario | Result |
|---|---|
| 2, 4, 5 | Verified by `tests/api/users-rules.mjs` (PASS) |
| 3 | Duplicate SAP Number verified (PASS); duplicate Email enforced by alternate key `cea_EmailKey` |
| 6 | `cea_managerregistered` flag verified (PASS); form warning implemented, not yet checked in the browser |
| 7 | User Change Record for Department change verified (PASS) via `tests/api/catalog-rules.mjs`; BU/role changes implemented, not tested |
| 8 | Guard registered but inactive until Spec 4 request tables exist |
| 9 | Delete block, inactive-parent block and BU sync verified (PASS) |
| 10 | Views exist; no Role column and no Incomplete flag column (see plan Complexity Tracking) |
| 11 | NOT RUN: 500 test users cannot be created through the API without Entra ID accounts |

Solution exported and unpacked to `solution/CEAPlatform/src` with `pac solution export` / `unpack`.

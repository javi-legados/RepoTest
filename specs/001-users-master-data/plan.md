# Implementation Plan: Users and Master Data

**Branch**: `001-users-master-data` | **Date**: 2026-07-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-users-master-data/spec.md`

## Summary

Provide the administrator-managed foundation of the CEA platform: user registration with mandatory attributes (SAP Number, Name, Email, Department, Manager, Business Unit, roles), master data for companies, regions and plants, and an audit trail of user changes. Approach: a Dataverse solution with a model-driven app, standard Dataverse security roles and Business Units, alternate keys for uniqueness, and server-side validation (plug-in-free where possible: business rules + Power Automate; a synchronous plug-in only if a rule cannot be enforced otherwise, see research.md).

## Technical Context

**Language/Version**: Low-code; Power Fx (business rules/formulas), Power Automate cloud flows; C# (.NET Framework 4.6.2) only for justified synchronous Dataverse plug-ins
**Primary Dependencies**: Microsoft Dataverse, Model-driven Power Apps, Power Automate, Dataverse auditing
**Storage**: Dataverse (tables in a single managed solution `CEAPlatform`)
**Testing**: Power Apps Test Engine / EasyRepro for UI; Dataverse Web API scripted checks for server-side rules; manual scenarios in quickstart.md
**Target Platform**: Power Platform environment (Dev → Test → Prod via solution export)
**Project Type**: Power Platform solution (model-driven app)
**Performance Goals**: User search/filter returns in under 3 seconds with 500 users
**Constraints**: English only; rules enforced server-side, not only in the UI; no deletion of in-use master data
**Scale/Scope**: Up to 500 users, 50 plants, 4 security roles

No NEEDS CLARIFICATION items remain.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1.*

| Principle / Constraint | Status | Notes |
|---|---|---|
| Power Platform + Dataverse | Pass | Whole design is Dataverse-native |
| Prefer standard capabilities | Pass | Alternate keys, BUs, security roles, auditing, business rules |
| Justify complexity | Pass | Only deactivation-blocking may need a plug-in (research R5) |
| Testable business rules | Pass | quickstart.md + contracts list each rule with a check |
| Rules enforced by the system | Pass | Alternate keys and server-side logic, not UI only |
| Complete immutable history | Pass | User Change Record table + Dataverse audit |
| BU hierarchy Enterprise > Company > Region > Plant | Pass | Native BU tree plus Plant/Region/Company catalog (R2) |
| Roles | Pass | Four roles defined in Spec 2; this spec only assigns them |

## Project Structure

### Documentation (this feature)

```text
specs/001-users-master-data/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── ui-and-rules.md
```

### Source Code (repository root)

```text
solution/
└── CEAPlatform/
    ├── Tables/            # User extension, BusinessUnit extension, Plant, UserChangeRecord
    ├── SecurityRoles/     # Role definitions (detailed in Spec 2)
    ├── ModelDrivenApp/    # CEA Administration app, sitemap, forms, views
    ├── BusinessRules/     # Field-level rules
    ├── Flows/             # Change recording, manager validation
    └── Plugins/           # Only if justified (R5)
tests/
├── ui/                    # Test Engine / EasyRepro scenarios
└── api/                   # Web API rule checks
```

**Structure Decision**: Single Dataverse solution with a folder per component type; later specs add components to the same solution.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Possible synchronous plug-in for deactivation blocking | Block deactivation when open requests exist must be server-side | Flows run asynchronously and cannot prevent the save |

# Implementation Plan: Security Roles and Business Unit Access

**Branch**: `002-security-roles-access` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Implement the four CEA security roles and Business Unit based visibility with native Dataverse security (roles, privilege depth, Business Units, owner-team access). Rules that standard security cannot express (approver sees only requests at their step or decided by them; no self-approval; Creator cannot edit after submit; comment required on decisions) are enforced server-side through status-based field/record locking and a synchronous plug-in or Dataverse low-code plug-in, never only in the UI.

## Technical Context

**Language/Version**: Dataverse security roles and BU configuration; Power Automate; C# plug-in only for rules that cannot be expressed declaratively (R3, R4)
**Primary Dependencies**: Dataverse security model, Access Teams / Team templates, auditing
**Storage**: Dataverse; `Access Denial Record` table
**Testing**: Test users per role and per BU level (Enterprise, Company, Region, Plant); Web API checks of denied operations; steps in quickstart.md
**Target Platform**: Power Platform environment
**Project Type**: Power Platform solution (extends `CEAPlatform` from Spec 1)
**Performance Goals**: Visibility checks add no perceptible delay (list load under 3 s)
**Constraints**: Permissions evaluated on every action; changes effective immediately; enforced outside the UI
**Scale/Scope**: 4 roles, 4 BU levels, up to 500 users

## Constitution Check

| Principle / Constraint | Status | Notes |
|---|---|---|
| Standard capabilities first | Pass | Security roles, BU depth, access teams |
| Justify complexity | Pass | Plug-in limited to R3/R4 and logged in Complexity Tracking |
| Rules enforced by the system | Pass | Server-side only |
| Immutable history | Pass | Denials and skips recorded |
| Roles | Pass | Exactly four roles |
| Stale item | Note | Constitution says read-only role sees "all records"; this spec (Clarifications) limits it to its own BU hierarchy. Constitution should be amended at next revision |

## Project Structure

### Documentation

```text
specs/002-security-roles-access/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── permission-matrix.md
```

### Source Code

```text
solution/CEAPlatform/
├── SecurityRoles/        # CEA Creators, CEA Internal Approvals, CEA Approvals, CEA Administrators
├── Tables/               # AccessDenialRecord
├── Flows/                # Deny logging, reassign-flagging on role/BU change
└── Plugins/              # Self-approval and step-ownership guard (justified)
tests/api/                # Permission matrix checks per role
tests/ui/                 # Visibility per BU level
```

**Structure Decision**: Roles live in the same solution; matrix is the contract tested in `tests/api`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Plug-in for step-ownership and self-approval guard | "Only at their step" and "never own request" are not expressible by privilege depth | Flows are asynchronous and cannot block the action |

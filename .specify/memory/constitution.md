# CEA Request Management Constitution

## Core Principles

### I. Workflow Integrity
A CEA Request MUST follow the defined chain: Creator -> CEA Administrator Initial Review ->
Manager -> Plant Manager -> Regional Approver -> CEA Administrators (final processing). No step
MAY be skipped or reordered. Any rejection MUST require comments and return the request to the
Creator; a revised request MUST pass a CEA Administrator Revision Review before re-entering the
chain. Approvers are resolved per request from the Creator: the Manager is the Creator's direct
manager (Manager Email on the user record), the Plant Manager is the approver assigned to the
Creator's Plant Business Unit, and the Regional Approver is the approver assigned to the
Creator's Region Business Unit. A request MUST NOT be submitted when any approver cannot be
resolved. A Creator MUST NOT modify a request while it is pending review or approval, or after it is
approved; edits are allowed only in Draft or Rejected status.
Rationale: approvals are a business control; the sequence is the product.

### II. Role and Business Unit Access
Access MUST be the combination of security role and Business Unit position. The roles are:
CEA Creators (create/edit own Draft and rejected requests, view only own), CEA Internal
Approvals (approve/reject with mandatory comments, no edits, only requests within their approval
hierarchy), CEA Approvals (read-only, all records), and CEA Administrators (full access, reviews,
workflow exceptions, platform administration, final documentation). Business Units follow
Enterprise > Company > Region > Plant, and a user MUST see only records of their own Business Unit
and those below it. The permission matrix in the User Roles document is authoritative.
Rationale: prevents unauthorized approvals and data exposure.

### III. Notifications on Every Transition
Every status change MUST send an email to the correct next party (pending review, pending
approval, rejection with comments, final approval, revision submitted). Notification content
and recipients MUST be defined per transition and covered by tests. Rationale: the workflow
stalls if the next actor is not informed.

### IV. Auditability
Each request MUST keep a complete, immutable history of submissions, approvals, rejections,
comments, actors, timestamps, and attachments, including every revision cycle. Rationale:
approvals must be traceable for review and compliance.

### V. Simplicity and Spec-Driven Development
Work MUST start from a spec (`/speckit-specify`) and plan before implementation. Prefer the
simplest solution that satisfies the spec, favoring standard Power Platform capabilities over
custom code; added complexity MUST be justified in the plan. Business rules (routing, rejection,
revision, access) MUST be covered by automated or documented repeatable tests with the feature.
Rationale: keeps changes small, reviewable, and verifiable.

### VI. Data Integrity
The CEA Request form rules MUST be enforced by the system, not only the UI: read-only
auto-populated requester fields, conditional fields (Supplemental/Addendum, Project in Plan,
financial metrics for Capacity, Cost Savings, Innovation and New Facilities categories),
automatic subtotals and Grand Total, and a spending forecast that totals exactly 100% before
submission. Every user MUST have SAP Number, Name, Email, Department, Manager Name, Manager Email,
and Business Unit, since these drive routing and access. Rationale: incorrect data produces
incorrect approvals and routing.

## Domain Constraints

- The platform is Microsoft Power Platform with Dataverse; users are System Users assigned to at
  least one security role and one Business Unit.
- The CEA Request Form, User Roles, Business Unit Hierarchy, and Users documents are the source of
  truth; specs MUST reference them rather than redefine them.
- Supported currencies are USD, EUR, GBP, UAH, CNY, and AUD.
- Final processing is limited to the CEA Administrators preparing the standard CEA layout and
  supporting documentation.
- Secrets and credentials MUST NOT be committed to the repository.

## Development Workflow

- Changes are made on a feature branch and merged through a pull request.
- Each pull request MUST be checked against this constitution before merge.
- Spec Kit sequence: constitution, specify, plan, tasks, implement; clarify and analyze are
  used when requirements are ambiguous or inconsistent.

## Governance

This constitution supersedes other practices. Amendments require a pull request describing the
change and rationale, plus an updated version and Last Amended date. Versioning follows semantic
versioning: MAJOR for removed or redefined principles, MINOR for added or materially expanded
guidance, PATCH for clarifications. Plans and pull request reviews MUST verify compliance, and
deviations MUST be justified in writing.

**Version**: 1.1.1 | **Ratified**: 2026-10-29 | **Last Amended**: 2026-10-29

# Research: Users and Master Data

| # | Decision | Rationale | Alternatives |
|---|---|---|---|
| R1 | Model-driven app on Dataverse with Power Automate (confirmed by the user) | Data-centric admin screens, native security and auditing | Canvas app (more custom UI work), Power Pages (external users not required) |
| R2 | Business Units model the Enterprise > Company > Region > Plant hierarchy; Plant, Region and Company catalog attributes live in custom columns/tables linked to the BU | Native BU hierarchy drives row security (Spec 2) | Pure custom tables (loses native security scoping) |
| R3 | Uniqueness of SAP Number and Email through Dataverse alternate keys on the User extension | Enforced by the platform at any entry point | Duplicate-detection rules (warn only) |
| R4 | Email format validated by a business rule plus a server-side check on create/update | Satisfies "enforced by the system" | UI-only validation |
| R5 | Block deactivation with open requests: synchronous plug-in on update of user state; fall back to documenting a flow-based check if plug-ins are not allowed | Only a synchronous step can reject the save | Asynchronous flow (cannot block) |
| R6 | Manager stored as Name + Email text columns plus optional lookup; submission check (manager has CEA Internal Approvals) happens in Spec 6 | Manager may be unregistered (spec) | Mandatory lookup (contradicts the spec) |
| R7 | Self-manager prevented by business rule + server-side check | Spec FR | UI-only |
| R8 | In-use protection for plants, regions and companies: delete blocked by relationship restrict behavior; deactivation allowed | Standard Dataverse relationship behavior | Custom delete checks |
| R9 | User Change Record table written by a Power Automate flow, plus Dataverse auditing on the User table | Readable history and platform audit | Auditing only (not easily filterable) |
| R10 | Manager and BU changes affect new requests only: requests snapshot approver data at submission (Spec 6) | Spec requirement | Live lookup (would change old requests) |
| R11 | Search and filter through views, quick find and advanced filters; an "incomplete records" view | Standard capability | Custom search page |

# Feature Specification: Approver Assignment

**Feature Branch**: `003-approver-assignment`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Approver assignment: how the system determines who approves each step of the CEA approval chain: the Creator's direct manager, the Plant Manager of the Creator's Plant Business Unit, and the Regional Approver of the Creator's Region Business Unit, plus the CEA Administrators for review and final processing."

## Clarifications

### Session 2026-10-29

- Q: If the same person holds two levels of a request's chain, do they approve once or once per level? → A: Once per level; each level requires its own separate decision and history record.
- Q: Which approvers apply when a Creator belongs to a Region or Company Business Unit instead of a plant? → A: The Plant Manager level is omitted; the direct manager and the Regional Approver of the Creator's Region still apply.
- Q: What happens to in-progress requests when the Plant Manager or Regional Approver of a Business Unit changes? → A: Levels not yet decided update automatically to the new approver; levels already decided keep their original approver.
- Q: How is the Creator's direct manager identified in the system? → A: By email, which must match an active registered user with the CEA Internal Approvals role.
- Q: What happens when the approver of a step is unavailable but still active? → A: Only manual reassignment by a CEA Administrator; no delegation, substitutes, or automatic escalation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assign Plant Manager and Regional Approver per Business Unit (Priority: P1)

A CEA Administrator assigns the Plant Manager to each Plant Business Unit and the Regional
Approver to each Region Business Unit, choosing from registered users that hold the CEA Internal
Approvals role.

**Why this priority**: Without these assignments the approval chain cannot route any request past
the direct manager.

**Independent Test**: Assign a Plant Manager to a plant and a Regional Approver to a region, then
verify both are shown on their Business Units and available for routing.

**Acceptance Scenarios**:

1. **Given** a Plant Business Unit without a Plant Manager, **When** the administrator selects a
   registered user with the CEA Internal Approvals role, **Then** that user is saved as the
   Plant Manager of the plant.
2. **Given** a Region Business Unit, **When** the administrator selects a registered approver,
   **Then** that user is saved as the Regional Approver of the region.
3. **Given** a user without the CEA Internal Approvals role, **When** the administrator tries to
   assign them as an approver, **Then** the system blocks the assignment and explains why.
4. **Given** an inactive user, **When** the administrator tries to assign them, **Then** the
   system blocks the assignment.

---

### User Story 2 - Resolve the approvers of a request from its Creator (Priority: P1)

When a request is submitted, the system determines the approvers for the three approval levels
from the Creator's data: the direct manager from the Creator's record, the Plant Manager from the
Creator's Plant Business Unit, and the Regional Approver from the Region above that plant.

**Why this priority**: The chain is only correct if the right person is found at every level.

**Independent Test**: Submit requests from Creators in two plants of different regions and verify
each request resolves to its own manager, Plant Manager, and Regional Approver.

**Acceptance Scenarios**:

1. **Given** a Creator in a Plant with an assigned Plant Manager and region approver, **When**
   the request is submitted, **Then** the manager, Plant Manager, and Regional Approver are
   resolved in that order.
2. **Given** a Creator assigned to a Region Business Unit (not a plant), **When** the request is
   submitted, **Then** the Plant Manager level is omitted and the direct manager and the Regional
   Approver of that Region apply.
3. **Given** the approvers of a request were resolved, **When** the Plant Manager assignment of the
   plant changes afterwards, **Then** the approval levels not yet decided update automatically to
   the new Plant Manager, and levels already decided keep their original approver.

---

### User Story 3 - Detect missing or invalid approvers before submission (Priority: P1)

Before a request can be submitted, the system verifies that every required approval level has a
valid active approver and tells the Creator and the administrators what is missing.

**Why this priority**: Prevents requests from getting stuck in the chain with nobody to decide.

**Independent Test**: Remove the Plant Manager of a plant and attempt to submit a request from
that plant; verify submission is blocked with a clear message.

**Acceptance Scenarios**:

1. **Given** a Creator whose plant has no Plant Manager, **When** they try to submit a request,
   **Then** submission is blocked and the message says the Plant Manager is missing.
2. **Given** a Creator whose manager is not registered as an approver, **When** they try to
   submit, **Then** submission is blocked and the message says the manager is not registered.
3. **Given** an assigned approver that is inactive, **When** a request is submitted, **Then** the
   system treats the level as missing.
4. **Given** missing approvers, **When** an administrator opens the approver assignment view,
   **Then** they see the list of Business Units without a Plant Manager or Regional Approver.

---

### User Story 4 - Reassign approvers as a workflow exception (Priority: P2)

A CEA Administrator can reassign the approver of a pending step of a submitted request, for
example when the approver left or is unavailable, recording the reason.

**Why this priority**: Real operations need a way to unblock requests without recreating them.

**Independent Test**: Reassign the Plant Manager step of a pending request and verify the new
approver receives it and the change is recorded with the reason.

**Acceptance Scenarios**:

1. **Given** a request pending at a step, **When** an administrator reassigns it to another valid
   approver with a reason, **Then** the new approver becomes responsible and the former one loses
   access to decide.
2. **Given** a reassignment, **When** it is saved, **Then** who, when, previous approver, new
   approver, and reason are recorded in the history.

---

### Edge Cases

- A Plant Manager or Regional Approver is the same person as the Creator (the step is skipped, as
  defined in the Roles and Security spec).
- The same person is both the Creator's manager and the Plant Manager; the system still requires
  a separate decision and history record for each level.
- A Plant Business Unit has no parent Region assigned in the hierarchy.
- An approver is deactivated while having pending decisions (administrator reassignment is
  required; see the Users and Master Data spec).
- Two administrators change the same assignment at the same time.
- A Creator is assigned directly to a Region Business Unit: the Plant Manager level is omitted. A
  Creator assigned to a Company or Enterprise Business Unit has no Region, so the Regional
  Approver level is also omitted and only the direct manager applies.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let CEA Administrators assign one Plant Manager to each Plant
  Business Unit and one Regional Approver to each Region Business Unit.
- **FR-002**: The system MUST allow only active users with the CEA Internal Approvals role to be
  assigned as Plant Manager or Regional Approver.
- **FR-003**: The system MUST determine the first approval level from the Creator's direct manager
  recorded on the Creator's user record, matching the manager's email to an active registered user
  with the CEA Internal Approvals role.
- **FR-004**: The system MUST determine the second level from the Plant Manager of the Creator's
  Plant Business Unit and the third level from the Regional Approver of the Region that contains
  that plant. If the Creator belongs to a Region, the Plant Manager level is omitted; if the
  Creator belongs to a Company or Enterprise Business Unit, both the Plant Manager and Regional
  Approver levels are omitted.
- **FR-005**: The system MUST resolve the approvers when the request is submitted and keep them
  with the request. When one person holds more than one level, the system MUST still require a
  separate decision and history record for each level.
- **FR-006**: The system MUST block submission when any required approval level has no active
  approver, and MUST show the Creator which level is missing.
- **FR-007**: The system MUST show administrators the Business Units that lack a Plant Manager or
  Regional Approver.
- **FR-008**: The system MUST let CEA Administrators reassign the approver of a pending step of a
  submitted request, requiring a reason.
- **FR-009**: The system MUST record every assignment and reassignment (who, when, previous value,
  new value, reason) in the audit history.
- **FR-010**: The system MUST apply the skip rule of the Roles and Security spec when the resolved
  approver of a level is the Creator.
- **FR-011**: The system MUST allow a Business Unit's approver to be changed or removed. When the
  approver of a Business Unit changes, approval levels not yet decided on requests in progress
  MUST update automatically to the new approver, levels already decided MUST keep their original
  approver, and each automatic update MUST be recorded in the history. If the Business Unit is
  left without an approver, the affected pending levels MUST be flagged for an administrator.
- **FR-012**: The system MUST use CEA Administrators only for Initial Review, Revision Review, and
  final processing, not as chain approvers.

### Key Entities *(include if feature involves data)*

- **Approver Assignment**: The link between a Business Unit (Plant or Region), the approver role it
  provides (Plant Manager or Regional Approver), and the assigned user, with active status.
- **Resolved Approver**: The approver determined for each approval level of a specific request, kept
  with that request.
- **Approval Level**: One step of the chain: direct manager, Plant Manager, or Regional Approver.
- **Reassignment Record**: The history of a reassignment with who, when, previous approver, new
  approver, and reason.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of submitted requests have an active approver resolved for every required
  level.
- **SC-002**: 0 requests are submitted while a required approver is missing or inactive.
- **SC-003**: 100% of approvers resolved for test requests match the expected manager, Plant
  Manager, and Regional Approver for the Creator's Business Unit.
- **SC-004**: An administrator can assign or change an approver of a Business Unit in under 1
  minute.
- **SC-005**: 100% of assignments and reassignments appear in the history with their reason.

## Assumptions

- Users, their direct manager data, and Business Units are maintained in the Users and Master Data
  spec; roles and permissions are defined in the Roles and Security spec.
- There is exactly one Plant Manager per Plant and one Regional Approver per Region at a time.
- Approval order is fixed: direct manager, Plant Manager, Regional Approver, as defined in the
  constitution.
- The Enterprise-level approver scope is not defined in the source documents and is out of scope
  until confirmed.
- Delegation, temporary substitutes, and automatic escalation for unavailable approvers are out of
  scope; an administrator reassigns manually.
- How a request is routed through the steps, and what happens when an approver rejects, is defined
  in the Approval Chain and Rejection specs.

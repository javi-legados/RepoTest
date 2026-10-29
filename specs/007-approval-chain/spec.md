# Feature Specification: Approval Chain

**Feature Branch**: `007-approval-chain`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Sequential approval chain of a CEA request: Manager, Plant Manager, and Regional Approver approve in order; each level can approve or reject; approving advances the request to the next level, and the last approval sends it to the CEA Administrators for final processing."

## Clarifications

### Session 2026-10-29

- Q: When an approver rejects after earlier levels already approved, what happens to those prior approvals? → A: All prior approvals are invalidated (kept in history); after revision the chain restarts from the first applicable level.
- Q: If an approver is deactivated or loses the role while a request is pending at their level, what happens? → A: The request stays on hold at that level, the CEA Administrators are notified, and it resumes when a new active approver is assigned.
- Q: Should the system send reminders for requests pending too long? → A: Yes, an email reminder to the pending approver after N days pending (N configurable by the CEA Administrators); no escalation or automatic approval.
- Q: If two approvers try to decide the same level at once, which decision prevails? → A: The first completed decision closes the level; the second is blocked with a clear message.
- Q: What can an approver see of earlier levels' decisions? → A: The full decision history of the request (approver, date, comments).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Approve a request at my level (Priority: P1)

An approver (Manager, Plant Manager, or Regional Approver) sees the requests pending their approval, reviews the data and attachments, and approves. The request then advances to the next level.

**Why this priority**: Approval is the core purpose of the platform.

**Independent Test**: Release a request with all three levels defined and have each approver approve in turn; verify the request advances level by level.

**Acceptance Scenarios**:

1. **Given** a request pending at the Manager level, **When** the Manager approves, **Then** the request becomes pending at the Plant Manager level and the decision, approver, and date are recorded.
2. **Given** a request pending at the Plant Manager level, **When** the Plant Manager approves, **Then** the request becomes pending at the Regional Approver level.
3. **Given** a request pending at the Regional level, **When** the Regional Approver approves, **Then** the request becomes approved and goes to the CEA Administrators for final processing.
4. **Given** an approver, **When** they open their pending list, **Then** they see only the requests pending at their level within their BU hierarchy.

---

### User Story 2 - Reject a request with comments (Priority: P1)

An approver rejects a request by entering mandatory rejection comments. The request leaves the chain and returns to the Creator.

**Why this priority**: Rejection is the only alternative outcome and drives the revision process.

**Independent Test**: Reject a request at each level without comments (blocked) and with comments (returned to the Creator).

**Acceptance Scenarios**:

1. **Given** a pending request, **When** an approver rejects it with comments, **Then** the request is returned to the Creator, and the decision, comments, approver, and date are recorded.
2. **Given** an approver tries to reject without comments, **When** they confirm, **Then** the system blocks the rejection and requires comments.
3. **Given** a rejected request, **When** it is returned to the Creator, **Then** the Creator can edit and resubmit it (handled in the Rejection and Revision Review spec).

---

### User Story 3 - Follow the level order and skipped levels (Priority: P1)

The chain always follows the order Manager, Plant Manager, Regional Approver. Levels that do not apply to the Creator are skipped, and a level where the approver is also the Creator is skipped and recorded.

**Why this priority**: The order and the skip rules make sure the right people approve the right requests.

**Independent Test**: Submit requests from a Plant Creator, a Region Creator, and a Company Creator and verify the levels each one goes through.

**Acceptance Scenarios**:

1. **Given** a Creator in a Plant BU, **When** the request enters the chain, **Then** it goes through Manager, Plant Manager, and Regional levels in that order.
2. **Given** a Creator in a Region BU, **When** the request enters the chain, **Then** it skips the Plant Manager level, as defined in the Approver Assignment spec.
3. **Given** an approver who is also the Creator of the request, **When** the request reaches their level, **Then** the level is skipped and the skip is recorded.
4. **Given** the same person holds two levels, **When** the request reaches each level, **Then** that person approves once per level.

---

### User Story 4 - See where the request is in the chain (Priority: P2)

The Creator, the approvers with access, and the CEA Administrators see the current level and the decision history of the chain.

**Why this priority**: It gives visibility into who the request is waiting on.

**Independent Test**: Open a request in the middle of the chain and verify the current level, the pending approver, and the past decisions are shown.

**Acceptance Scenarios**:

1. **Given** a request in the chain, **When** an authorized user opens it, **Then** the current level, the pending approver, and each past decision with date and comments are shown.

---

### Edge Cases

- An approver is deactivated or loses the role while a request is pending at their level: the request stays on hold at that level, the CEA Administrators are notified, and it resumes when a new active approver is assigned.
- The approver of a level changes while the request is pending at that level (the pending level moves to the new approver, as defined in the Approver Assignment spec).
- Two people try to decide the same pending level at the same time: the first completed decision closes the level and the second is blocked with a clear message (FR-014).
- A pending request is not decided for a long time: a reminder is sent to the approver after N days (FR-013).
- The Regional approver rejects after Manager and Plant Manager have already approved: those approvals are invalidated (kept in history) and the chain restarts after the revision.
- A read-only user (CEA Approvals) tries to approve.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST route a released request through the approval levels in this fixed order: Manager, Plant Manager, Regional Approver, skipping levels that do not apply to the Creator under the Approver Assignment spec.
- **FR-002**: The system MUST allow only the assigned approver of the current level to approve or reject the request at that level.
- **FR-003**: On approval, the system MUST record the approver, decision, and date and advance the request to the next applicable level; after the last level, it MUST route the request to the CEA Administrators for final processing.
- **FR-004**: On rejection, the system MUST require rejection comments, record the approver, decision, comments, and date, remove the request from the chain, invalidate all prior approvals (kept in the history), and return it to the Creator; after the revision, the chain MUST restart from the first applicable level.
- **FR-005**: The system MUST skip a level when the approver is also the Creator of the request, and MUST record the skip.
- **FR-006**: The system MUST require the same person to approve once per level when they hold more than one level.
- **FR-007**: The system MUST show each approver only the requests pending at their level or already decided by them, within their BU hierarchy, as defined in the Security and Roles spec.
- **FR-008**: The system MUST prevent CEA Approvals (read-only) and CEA Creators without an approval role from approving or rejecting.
- **FR-009**: The system MUST show the current level, the pending approver, and the full history of decisions (approver, date, comments, including earlier levels) of a request to every user authorized to open it, approvers included.
- **FR-010**: The system MUST request an email notification to the next approver after each approval, to the CEA Administrators after the final approval, and to the Creator after a rejection; the content and delivery are defined in the Notifications spec.
- **FR-011**: The system MUST not allow a decided level to be decided again unless the request is resubmitted.
- **FR-013**: The system MUST send an email reminder to the approver of the current level when a request has been pending for N days (N configurable by the CEA Administrators; content and delivery defined in the Notifications spec); it MUST NOT escalate or approve automatically.
- **FR-014**: When two approvers try to decide the same level concurrently, the system MUST accept the first completed decision and block the second with a clear message; there is no reservation of the level.
- **FR-012**: If the approver of the current level is deactivated or loses the role, the system MUST keep the request on hold at that level, notify the CEA Administrators, and resume the request when a new active approver is assigned.

### Key Entities *(include if feature involves data)*

- **Approval Step**: One level of the chain for a request, with the level (Manager, Plant Manager, Regional), the assigned approver, the status (pending, approved, rejected, skipped), the decision date, and the comments.
- **CEA Request**: The request, with the status pending approval at a given level, approved, or returned to the Creator.
- **Decision**: The record of an approval or rejection with approver, date, and comments.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of requests follow the level order Manager, Plant Manager, Regional Approver, with applicable skips, in acceptance tests.
- **SC-002**: 0 requests reach the CEA Administrators for final processing without every applicable level approved.
- **SC-003**: 100% of rejections include comments.
- **SC-004**: 100% of decisions are recorded with approver, date, and outcome.
- **SC-005**: An approver can approve or reject a request in under 2 minutes from opening it.

## Assumptions

- Approver resolution, skipped levels for Region, Company, and Enterprise Creators, and approver changes follow the Approver Assignment spec.
- The review after a rejection and the resubmission are defined in the Rejection and Revision Review spec.
- Final processing is defined in the Final Processing spec.
- Email delivery is defined in the Notifications spec.
- The source documents do not define a time limit for approvers to decide; reminders are sent after N days (FR-013), but no escalation or automatic approval is part of this spec.

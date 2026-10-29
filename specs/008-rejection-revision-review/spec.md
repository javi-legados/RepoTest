# Feature Specification: Rejection and Revision Review

**Feature Branch**: `008-rejection-revision-review`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "When an approver rejects a CEA request, it returns to the Creator with comments. The Creator updates and resubmits it to the CEA Administrators, who perform a Revision Review; after the review, the request re-enters the approval workflow."

## Clarifications

### Session 2026-10-29

- Q: Should the number of reject-and-revise cycles be limited? → A: No limit; every cycle is recorded in the history.
- Q: If the Creator is deactivated while the request is returned, what happens? → A: The request stays on hold, the CEA Administrators are notified, and they may reassign the Creator.
- Q: Must the Creator explain the corrections when resubmitting? → A: An optional correction note, visible in the history.
- Q: If the approver who rejected is no longer active when the request is released, how is the level resolved? → A: Approvers are resolved from those current at release time; the original rejection stays only in the history.
- Q: What if a returned request is not corrected for a long time? → A: An email reminder to the Creator after N days (configurable by the CEA Administrators); no automatic closure.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct a rejected request (Priority: P1)

The Creator receives a rejected request, reads the rejection comments, edits the form and attachments, and resubmits it.

**Why this priority**: Without it, a rejection ends the request with no way forward.

**Independent Test**: Reject a request, edit it as the Creator, and resubmit; verify it reaches the CEA Administrators for Revision Review.

**Acceptance Scenarios**:

1. **Given** a request rejected by an approver, **When** the Creator opens it, **Then** the rejection comments, the approver, and the date are visible and the request is editable.
2. **Given** the Creator finished the corrections, **When** they resubmit, **Then** the request goes to the CEA Administrators for Revision Review and the Creator can no longer edit it.
3. **Given** a rejected request, **When** the Creator resubmits without any change, **Then** the system accepts the resubmission only if the required-field validations of the form still pass.

---

### User Story 2 - Perform the Revision Review (Priority: P1)

One CEA Administrator reviews the revised request and either releases it to the approval chain or returns it to the Creator with comments.

**Why this priority**: The Revision Review is the gate before the request re-enters the chain.

**Independent Test**: Resubmit a corrected request and complete the review as an administrator, both releasing and returning it.

**Acceptance Scenarios**:

1. **Given** a resubmitted request, **When** an administrator releases it, **Then** it re-enters the approval chain from the first applicable level.
2. **Given** a resubmitted request, **When** an administrator returns it with comments, **Then** it goes back to the Creator, who can edit and resubmit it again.
3. **Given** a request in Revision Review, **When** an administrator opens it, **Then** they see the previous rejection comments and the history of earlier decisions.

---

### User Story 3 - Track the revision cycles (Priority: P2)

The Creator, approvers, and administrators see how many times the request has been rejected and revised, with every rejection and review outcome.

**Why this priority**: It gives context to reviewers and approvers about why the request changed.

**Independent Test**: Run two reject-and-revise cycles and verify the request shows both cycles in order.

**Acceptance Scenarios**:

1. **Given** a request with several revisions, **When** an authorized user opens it, **Then** each cycle shows the rejection comments, the resubmission date, and the review outcome.

---

### Edge Cases

- The approver who rejected is no longer active when the request is revised: approvers are resolved at release time and the original rejection stays only in the history (FR-006).
- The Creator is deactivated while the request is returned to them: the request stays on hold, the CEA Administrators are notified, and they may reassign the Creator (FR-011).
- No active CEA Administrator exists when the Creator resubmits (same rule as initial submission).
- The first approver is missing or inactive when the Revision Review is released.
- A request is rejected many times in a row: there is no limit on revision cycles and each cycle is recorded (FR-010).
- A returned request is never corrected by the Creator: a reminder is sent after N days and the request is never closed automatically (FR-013).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST return a rejected request to the Creator in an editable state, with the rejection comments, approver, and date visible.
- **FR-002**: The system MUST allow the Creator to edit the form and attachments of a returned request under the same rules as the form and attachments specs.
- **FR-003**: The system MUST send a resubmitted request to the CEA Administrators for Revision Review and lock it against Creator edits.
- **FR-004**: The system MUST block resubmission, keeping the request returned to the Creator, if no active CEA Administrator exists.
- **FR-005**: The system MUST let one CEA Administrator complete the Revision Review by releasing the request or returning it to the Creator with mandatory comments.
- **FR-006**: On release, the system MUST re-enter the approval chain from the first applicable level, resolving the approvers current at release time (not the one who rejected), as defined in the Approval Chain and Approver Assignment specs.
- **FR-007**: The system MUST block the release, keeping the request in Revision Review and notifying the CEA Administrators, if the first approver is missing or inactive.
- **FR-008**: The system MUST record each rejection, resubmission, and review outcome with person, date, and comments, and show this history to authorized users.
- **FR-009**: The system MUST request an email to the CEA Administrators when a revised request is submitted, to the first approver when it is released, and to the Creator when it is returned; content and delivery are defined in the Notifications spec.
- **FR-010**: The system MUST NOT limit the number of rejection and revision cycles of a request.
- **FR-012**: The system MUST let the Creator add an optional correction note when resubmitting, and MUST show it in the revision history.
- **FR-013**: The system MUST send an email reminder to the Creator when a returned request has not been resubmitted after N days (N configurable by the CEA Administrators; content defined in the Notifications spec) and MUST NOT close it automatically.
- **FR-011**: If the Creator is deactivated while the request is returned, the system MUST keep it on hold, notify the CEA Administrators, and allow them to reassign the Creator.

### Key Entities *(include if feature involves data)*

- **CEA Request**: The request with the status returned to the Creator, in Revision Review, or in approval.
- **Revision Cycle**: One rejection followed by a resubmission and a review outcome, with rejection comments, approver, resubmission date, and reviewer decision.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of rejected requests return to the Creator with the rejection comments visible.
- **SC-002**: 0 revised requests re-enter the approval chain without a completed Revision Review.
- **SC-003**: 100% of revision cycles are recorded with person, date, and comments.
- **SC-004**: A Creator can find the rejection comments and start correcting in under 1 minute from opening the request.

## Assumptions

- The Revision Review follows the same rules as the Initial Review of the Submission and Initial Review spec (one administrator, release or return with comments, no reservation, an administrator may review their own request).
- The approval chain after release is defined in the Approval Chain spec, which restarts from the first applicable level.
- Email content and delivery are defined in the Notifications spec.
- Final processing and the full audit history are defined in their own specs.

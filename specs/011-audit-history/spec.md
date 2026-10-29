# Feature Specification: Audit and History

**Feature Branch**: `011-audit-history`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Audit trail and history of the CEA request: every status change, decision, comment, edit, attachment, notification outcome, and administrative change is recorded and viewable by authorized users."

## Clarifications

### Session 2026-10-29

- Q: How long are the history and audit records kept? → A: Indefinitely, for as long as the request exists.
- Q: Who can see the administrative audit outside a request? → A: Only the CEA Administrators.
- Q: Are Creator changes made while the request is a Draft recorded? → A: No; only the creation is recorded and the field and attachment history starts at submission.
- Q: Can the history of a request be exported? → A: No; it can only be viewed on screen in this version.
- Q: Can read-only users (CEA Approvals) see the full history including comments? → A: Yes, the full history with comments, only for the requests they can already see.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the full history of a request (Priority: P1)

An authorized user opens a request and sees a chronological timeline of everything that happened: creation, submission, reviews, approvals, rejections, revisions, final processing, and completion.

**Why this priority**: The history explains where the request is and how it got there.

**Independent Test**: Run a request through a rejection and a completion and verify the timeline shows every event in order.

**Acceptance Scenarios**:

1. **Given** a request that went through several steps, **When** an authorized user opens its history, **Then** each event shows the type, the person, the date and time, and the comments.
2. **Given** a request with several revision cycles, **When** the history is opened, **Then** the cycles appear in chronological order.
3. **Given** an approver, **When** they open a request they can see, **Then** they see its full history, as defined in the Approval Chain spec.

---

### User Story 2 - Audit changes to data (Priority: P1)

A CEA Administrator can see who changed what in a request, including administrative corrections, with the old and new values.

**Why this priority**: Changes to approved data must be traceable.

**Independent Test**: Edit fields of a request and correct approved data during Final Processing; verify each change is recorded with old and new values.

**Acceptance Scenarios**:

1. **Given** a field is changed, **When** the change is saved, **Then** the history records the field, the old value, the new value, the person, and the date.
2. **Given** an attachment is added or removed, **When** the action completes, **Then** the history records the file name, the action, the person, and the date.

---

### User Story 3 - Audit administrative and system events (Priority: P2)

A CEA Administrator can review administrative changes (roles, approver assignments) and system events (failed emails, blocked releases) outside a single request.

**Why this priority**: It supports control over who can approve and over the health of the workflow.

**Independent Test**: Change an approver assignment and block a release; verify both appear in an administrative audit view.

**Acceptance Scenarios**:

1. **Given** an approver assignment or role is changed, **When** an administrator opens the administrative audit, **Then** the change appears with the old value, new value, person, and date.
2. **Given** an email failed or a release was blocked, **When** an administrator opens the administrative audit, **Then** the event appears with its reason.

---

### Edge Cases

- A user tries to edit or delete a history entry.
- The person who made a change is later deactivated or deleted.
- A request has a very long history.
- A change is made by the system instead of a person.
- A user without access to a request tries to see its history.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST record in a request's history every status change, submission, review outcome, approval, rejection, resubmission, skip, final processing action, and completion, with the person or system, the date and time, and the comments.
- **FR-002**: The system MUST record every change to the request's form fields made after submission with the field, the old value, the new value, the person, and the date; changes made while the request is a Draft are not recorded, only its creation.
- **FR-003**: The system MUST record every attachment added or removed after submission with the file name, the action, the person, and the date.
- **FR-004**: The system MUST record the outcome of every notification, including failures and unsent emails with the reason.
- **FR-005**: The system MUST record changes to roles and approver assignments with the old value, the new value, the person, and the date.
- **FR-006**: The system MUST NOT allow any user to edit or delete history entries.
- **FR-007**: The system MUST show the full history of a request, with comments and in chronological order, to every user authorized to open that request, including read-only CEA Approvals users for the requests they can already see.
- **FR-008**: The system MUST give only CEA Administrators a view of administrative and system events across requests.
- **FR-011**: The system MUST provide the history for on-screen viewing only; export of the history is out of scope.
- **FR-009**: The system MUST keep the person's name in the history entries even if the user is later deactivated.
- **FR-010**: The system MUST keep history and audit records indefinitely, for as long as the request exists, with no automatic purge or archival.

### Key Entities *(include if feature involves data)*

- **History Entry**: One recorded event of a request, with the event type, the person or system, the date and time, the old and new values when relevant, and the comments.
- **Administrative Audit Entry**: One recorded event not tied to a single request, such as a role or approver assignment change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of status changes, decisions, and data changes in acceptance tests appear in the history.
- **SC-002**: 0 history entries can be edited or deleted by any user.
- **SC-003**: 100% of entries record the person or system and the date and time.
- **SC-004**: An authorized user can open the history of a request in under 1 minute.

## Assumptions

- The events to record are produced by the previous specs; this spec defines how they are recorded and shown.
- Visibility of a request's history follows the access rules of the Security and Roles spec.
- History and audit records are kept indefinitely while the request exists (FR-010); archival is not part of this spec.
- Reporting, analytics, and export of the history are out of scope.

# Feature Specification: Email Notifications

**Feature Branch**: `009-email-notifications`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Email notifications of the CEA request workflow: submission, release, approvals, rejection, revised submission, completion of approvals, final processing, and reminders defined in earlier specs."

## Clarifications

### Session 2026-10-29

- Q: What should the system do if an email fails to send? → A: Retry automatically; if it still fails, record the failure and alert the CEA Administrators. The workflow action is never blocked.
- Q: Do the CEA Administrators receive individual emails or one to a shared mailbox? → A: An individual email to each active CEA Administrator.
- Q: In what language are the emails written? → A: English only.
- Q: What if a recipient has no valid email or is deactivated at sending time? → A: Do not send, record the reason, and alert the CEA Administrators.
- Q: If one person would receive several emails for the same event, one per role or one consolidated? → A: One consolidated email per person and event, listing all expected actions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Be notified when it is my turn (Priority: P1)

Each person who must act on a request (CEA Administrators, approvers, the Creator) receives an email at the moment the request needs their action.

**Why this priority**: The workflow depends on people knowing when a request is waiting on them.

**Independent Test**: Move a request through the whole workflow and verify each expected email is sent to the right recipients.

**Acceptance Scenarios**:

1. **Given** a Creator submits a request, **When** the submission completes, **Then** the CEA Administrators receive an email.
2. **Given** an administrator releases a request, **When** the release completes, **Then** the first approver receives an email.
3. **Given** an approver approves, **When** the request advances, **Then** the next approver receives an email.
4. **Given** the last approval is recorded, **When** the request goes to final processing, **Then** the CEA Administrators receive an email.

---

### User Story 2 - Be informed of rejections and returns (Priority: P1)

The Creator receives an email with the comments whenever the request is rejected or returned by an administrator.

**Why this priority**: The Creator must act on the comments to move the request forward.

**Independent Test**: Reject and return requests and verify the Creator email includes the comments.

**Acceptance Scenarios**:

1. **Given** an approver rejects a request, **When** the rejection is recorded, **Then** the Creator receives an email with the rejection comments.
2. **Given** an administrator returns a request, **When** the return is recorded, **Then** the Creator receives an email with the comments.
3. **Given** a revised request is submitted, **When** the resubmission completes, **Then** the CEA Administrators receive an email.

---

### User Story 3 - Know that the request is complete (Priority: P2)

The Creator receives an email confirming that all approvals are complete and the final CEA package is being prepared.

**Why this priority**: It closes the loop with the Creator.

**Independent Test**: Complete the final approval and verify the Creator receives the confirmation.

**Acceptance Scenarios**:

1. **Given** all approvals are complete, **When** the request goes to final processing, **Then** the Creator receives a confirmation email.

---

### User Story 4 - Receive reminders and alerts (Priority: P2)

Approvers and Creators receive reminders for pending items, and the CEA Administrators receive alerts about blocked requests.

**Why this priority**: Reminders and alerts are defined by earlier specs and need one consistent mechanism.

**Independent Test**: Leave a request pending beyond N days and block a release for a missing approver; verify the reminder and the alert.

**Acceptance Scenarios**:

1. **Given** a request pending at an approver beyond N days, **When** the threshold is reached, **Then** the approver receives a reminder.
2. **Given** a release blocked by a missing or inactive approver, **When** the block occurs, **Then** the CEA Administrators receive an alert.

---

### Edge Cases

- A recipient has no email address or an invalid one: no email is sent, the reason is recorded, and the CEA Administrators are alerted (FR-012).
- The email service is unavailable when a notification must be sent: the system retries automatically; if it still fails, it records the failure and alerts the CEA Administrators (FR-009).
- The recipient is deactivated at the time of sending: handled like a missing email address (FR-012).
- The same person is the recipient of several notifications for the same event: one consolidated email is sent listing all expected actions (FR-013).
- A notification refers to a request the recipient can no longer see.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST send an email to the CEA Administrators when a request is submitted or a revised request is resubmitted.
- **FR-002**: The system MUST send an email to the first approver when an administrator releases a request, and to the next approver after each approval.
- **FR-003**: The system MUST send an email to the CEA Administrators when all applicable approvals are complete.
- **FR-004**: The system MUST send an email to the Creator, including the comments, when an approver rejects the request or an administrator returns it.
- **FR-005**: The system MUST send an email to the Creator confirming that all approvals are complete and the final CEA package is being prepared.
- **FR-006**: The system MUST send the reminders and alerts defined in earlier specs: reminders to approvers and Creators after N days, and alerts to the CEA Administrators for blocked requests or on-hold levels.
- **FR-007**: Each email MUST identify the request and the action expected from the recipient, and MUST include a link to the request.
- **FR-008**: The system MUST send emails only to active users with a valid email address and MUST record the sending outcome.
- **FR-010**: Emails addressed to the CEA Administrators MUST be sent individually to each active CEA Administrator, not to a shared mailbox.
- **FR-011**: All emails MUST be written in English, with no per-user language preference.
- **FR-012**: If a recipient has no valid email address or is deactivated at sending time, the system MUST NOT send the email, MUST record the reason, and MUST alert the CEA Administrators.
- **FR-013**: When one person is the recipient of several notifications for the same event, the system MUST send one consolidated email listing all the actions expected from them.
- **FR-009**: If an email fails to send, the system MUST retry automatically; if it still fails, it MUST record the failure and alert the CEA Administrators, and MUST NOT block the workflow action that triggered it.

### Key Entities *(include if feature involves data)*

- **Notification**: A message triggered by a workflow event, with the event type, the recipient, the request, and the sending outcome.
- **Recipient**: The user or role group that receives the notification.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the workflow events listed in this spec produce the expected email in acceptance tests.
- **SC-002**: Emails are delivered to the recipient within 5 minutes of the event under normal conditions.
- **SC-003**: 100% of rejection and return emails include the comments.
- **SC-004**: 100% of sending outcomes are recorded.

## Assumptions

- Events are defined by the Submission, Approval Chain, Rejection, and Final Processing specs; this spec defines the delivery and content rules.
- The same message content applies to all recipients of a role group.
- Notification content is in English only.
- No notification channel other than email is in scope.

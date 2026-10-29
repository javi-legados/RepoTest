# Feature Specification: Final Processing

**Feature Branch**: `010-final-processing`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "After all required approvals, the request is routed to the CEA Administrators, who use the approved information to prepare the standard CEA layout and supporting documentation, and then complete the request."

## Clarifications

### Session 2026-10-29

- Q: Can an administrator complete the request without attaching any final package file? → A: Yes, attaching final package files is optional.
- Q: After completion, can the final package be corrected or replaced? → A: No; Completed is final and nothing can be changed.
- Q: If the administrator finds an error in the approved information during Final Processing, what can they do? → A: Correct it directly, with every change recorded (field, old value, new value, person, date).
- Q: How are conflicts avoided when two administrators work on the same request? → A: No reservation; the first to complete wins and concurrent edits of the same data are blocked with a message.
- Q: Which file rules apply to final package files? → A: The same rules as request attachments (25 MB per file, closed list of types, 20 files maximum), counted separately from the Creator's attachments.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prepare the final CEA package (Priority: P1)

A CEA Administrator opens a fully approved request, reviews its approved information, prepares the standard CEA layout and supporting documentation, and attaches the final package to the request.

**Why this priority**: Preparing the package is the purpose of the whole workflow.

**Independent Test**: Take a fully approved request, attach the final package, and complete it; verify the request closes with the package stored.

**Acceptance Scenarios**:

1. **Given** a request with all applicable approvals, **When** an administrator opens it, **Then** it shows the approved information, the attachments, and the full approval history.
2. **Given** a request in Final Processing, **When** an administrator attaches the final package files, **Then** the files are stored on the request and distinguished from the Creator's attachments.
3. **Given** the final package is ready, **When** the administrator completes the request, **Then** the request becomes Completed and read-only.

---

### User Story 2 - Confirm completion to the Creator (Priority: P1)

The Creator is informed that all approvals are complete and, when the request is completed, can see the final package.

**Why this priority**: It closes the loop with the person who started the process.

**Independent Test**: Complete a request and verify the Creator is notified and can open the final package.

**Acceptance Scenarios**:

1. **Given** all approvals are complete, **When** the request enters Final Processing, **Then** the Creator is notified that the final package is being prepared.
2. **Given** a Completed request, **When** the Creator opens it, **Then** they can see the request, the history, and the final package.

---

### User Story 3 - Work final processing among administrators (Priority: P2)

Any CEA Administrator can pick up requests in Final Processing, and the list shows which are pending and which are completed.

**Why this priority**: Several administrators share the workload.

**Independent Test**: Have two administrators open the Final Processing list and verify both see the same pending requests.

**Acceptance Scenarios**:

1. **Given** requests in Final Processing, **When** an administrator opens the list, **Then** they see all pending requests with the approval date and the Creator.

---

### Edge Cases

- No active CEA Administrator exists when the last approval is recorded.
- An administrator completes the request without attaching any final package file: allowed, as the package may be delivered outside the platform (FR-004).
- An administrator needs to correct the final package after completion: not allowed; Completed is final and nothing can be changed (FR-010).
- The administrator finds an error in the approved information during preparation: they may correct it directly and every change is recorded (FR-006, FR-011).
- Two administrators work on the same request at the same time: there is no reservation; the first to complete closes the request and concurrent edits of the same data are blocked with a message (FR-012).
- The request is the administrator's own request.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST place a fully approved request in Final Processing and make it visible to the CEA Administrators.
- **FR-002**: The system MUST show the approved information, the attachments, and the full approval history to the administrator during Final Processing.
- **FR-003**: The system MUST let a CEA Administrator attach final package files to the request and MUST distinguish them from the Creator's attachments.
- **FR-004**: The system MUST let a CEA Administrator mark the request as Completed, with or without final package files attached, after which it becomes read-only.
- **FR-005**: The system MUST prevent users other than CEA Administrators from attaching final package files or completing the request.
- **FR-006**: The system MUST NOT allow anyone but a CEA Administrator to change the approved information during Final Processing.
- **FR-011**: The system MUST let a CEA Administrator correct the approved information directly during Final Processing, and MUST record every change (field, old value, new value, person, date) and show it in the history; the approvals are not repeated.
- **FR-007**: The system MUST let the Creator and authorized users see the Completed request and its final package.
- **FR-008**: The system MUST request an email to the Creator when Final Processing starts, as defined in the Email Notifications spec.
- **FR-010**: The system MUST NOT allow any change to a Completed request, including its final package files; administrators MUST confirm before completing.
- **FR-012**: The system MUST NOT reserve a request for one administrator; the first administrator to complete it closes it, and concurrent edits of the same data MUST be blocked with a clear message.
- **FR-013**: The system MUST apply to final package files the same rules as request attachments (25 MB per file, closed list of file types, 20 files maximum), counted separately from the Creator's attachments.
- **FR-009**: The system MUST record who completed the request and when.

### Key Entities *(include if feature involves data)*

- **CEA Request**: The request with the status Final Processing or Completed.
- **Final Package File**: A file attached by an administrator as part of the final CEA package, with name, uploader, and date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of fully approved requests appear in the Final Processing list.
- **SC-002**: 0 requests are Completed without every applicable approval.
- **SC-003**: 100% of Completed requests record who completed them and when.
- **SC-004**: An administrator can find a pending request and open it in under 1 minute.

## Assumptions

- The standard CEA layout is prepared outside the platform from the approved information; the platform stores the resulting files.
- The same file type, size (25 MB per file), and count (20 files) rules as the Request Attachments spec apply to final package files, counted separately from the Creator's attachments.
- The next business process after completion is out of scope.
- Email content and delivery are defined in the Email Notifications spec, and the audit history in the Audit and History spec.

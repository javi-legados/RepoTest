# Feature Specification: Submission and Initial Review

**Feature Branch**: `006-submission-initial-review`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Submission of a CEA request by the Creator to the CEA Administrators, and the Initial Review in which one CEA Administrator validates the request before it enters the management approval chain."

## Clarifications

### Session 2026-10-29

- Q: ¿Puede el CEA Administrator rechazar o devolver la solicitud al Creator durante la Revisión Inicial? → A: Sí; puede devolverla al Creator con comentarios obligatorios, y el Creator corrige y reenvía.
- Q: ¿Puede un CEA Administrator hacer la Revisión Inicial de su propia solicitud? → A: Sí, puede revisarla.
- Q: ¿Qué pasa si el primer aprobador no existe o está inactivo al liberar? → A: Se bloquea la liberación; la solicitud sigue en Revisión Inicial y se avisa a los administradores para corregir y reintentar.
- Q: ¿Cómo se maneja una Revisión Inicial empezada pero no terminada? → A: No hay reserva; cualquier administrador puede completarla y la primera acción completada la cierra.
- Q: ¿Qué pasa si no hay ningún CEA Administrator activo al enviar? → A: Se bloquea el envío con un mensaje claro y la solicitud sigue como Draft.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit a request for review (Priority: P1)

A Creator who has completed a Draft submits it to the CEA Administrators. The system checks that the request is complete, changes its status to pending Initial Review, and locks it from further edits by the Creator.

**Why this priority**: Submission is the entry point to the whole approval process.

**Independent Test**: Complete a Draft, submit it, and verify the status changes, the Creator can no longer edit it, and the CEA Administrators are informed.

**Acceptance Scenarios**:

1. **Given** a Draft that passes all form validations, **When** the Creator submits it, **Then** the request status becomes pending Initial Review and the submission date and Creator are recorded.
2. **Given** a Draft with missing or invalid fields, **When** the Creator tries to submit, **Then** submission is blocked and every problem is listed.
3. **Given** a submitted request, **When** the Creator opens it, **Then** the Creator can view it but cannot edit it.
4. **Given** a submitted request, **When** the submission completes, **Then** an email notification is requested for the CEA Administrators (delivery is defined in the Notifications spec).

---

### User Story 2 - Perform the Initial Review (Priority: P1)

A CEA Administrator opens a request pending Initial Review, reviews it, and completes the review. Only one CEA Administrator performs the review.

**Why this priority**: The review validates the request before it reaches the managers.

**Independent Test**: With two administrators, have one complete the review and verify the other cannot complete the same review.

**Acceptance Scenarios**:

1. **Given** a request pending Initial Review, **When** a CEA Administrator opens it, **Then** they can view all its data and attachments.
2. **Given** two CEA Administrators viewing the same pending request, **When** one completes the review, **Then** the request moves on and the other can no longer act on that review.
3. **Given** a request pending Initial Review, **When** the administrator completes the review, **Then** the review result, the administrator, and the date are recorded.
4. **Given** a request pending Initial Review, **When** the administrator returns it to the Creator with comments, **Then** the request is returned to the Creator for correction, the comments and administrator are recorded, and the Creator can edit and resubmit it.
5. **Given** an administrator returns a request without comments, **When** they confirm, **Then** the system blocks the return and requires comments.

---

### User Story 3 - Release the request to the approval chain (Priority: P1)

After the Initial Review, the CEA Administrator releases the request to the management approvals, starting at the first required approval level for that Creator.

**Why this priority**: This hands the request to the approvers resolved by the Approver Assignment spec.

**Independent Test**: Complete an Initial Review and verify the request becomes pending the first approver defined for that Creator.

**Acceptance Scenarios**:

1. **Given** a completed Initial Review, **When** the administrator releases the request, **Then** the status becomes pending approval at the first required approval level for that Creator.
2. **Given** the first required approver is not defined or not active, **When** the administrator tries to release, **Then** the system blocks the release, the request stays pending Initial Review, and the CEA Administrators are told which approver is missing so they can fix the assignment and retry.
3. **Given** a release, **When** it completes, **Then** an email notification is requested for the first approver (delivery is defined in the Notifications spec).

---

### User Story 4 - Track the status of a submitted request (Priority: P2)

The Creator and the CEA Administrators see the current status and the date of the last status change of the request.

**Why this priority**: Users need to know where the request is without asking.

**Independent Test**: Submit a request and verify the Creator sees the status at each stage.

**Acceptance Scenarios**:

1. **Given** a submitted request, **When** the Creator opens it, **Then** the current status and the date of the last status change are shown.
2. **Given** an Initial Review in progress, **When** an administrator opens the request, **Then** the submission date and Creator are shown.

---

### Edge Cases

- A Creator submits a request that has no attachments (allowed).
- The Creator clicks submit twice: only one submission is created.
- An administrator who is also the Creator of the request: they may perform the Initial Review of their own request.
- No active CEA Administrator exists when a request is submitted: submission is blocked with a clear message and the request stays a Draft.
- The Creator's data (BU, manager) changes between submission and release.
- An administrator opens a review but does not complete it: there is no reservation, so any administrator can complete it, and the first completed action closes the review.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a Creator or CEA Administrator to submit a Draft request, MUST apply all form validations of the CEA Request Form spec at submission, and MUST block the submission, keeping the request as a Draft, when no active CEA Administrator exists.
- **FR-002**: The system MUST change the status to pending Initial Review on submission and record who submitted it and when.
- **FR-003**: The system MUST prevent the Creator from editing a request while it is pending Initial Review or in the approval chain.
- **FR-004**: The system MUST make a request pending Initial Review visible to all CEA Administrators, and exactly ONE CEA Administrator MUST complete each Initial Review. Opening a request MUST NOT reserve it: any administrator can complete the review, and the first completed action (release or return) closes it; later attempts by other administrators MUST be rejected.
- **FR-005**: The system MUST record the administrator, date, outcome (released or returned), and comments of each Initial Review.
- **FR-011**: The system MUST allow the CEA Administrator to return a request pending Initial Review to the Creator, MUST require comments for the return, and MUST let the Creator edit and resubmit it. A request resubmitted after an Initial Review return goes through the Initial Review again.
- **FR-012**: The system MUST allow a CEA Administrator to perform the Initial Review of a request they created themselves.
- **FR-006**: The system MUST NOT release a request to the approval chain until the Initial Review is completed.
- **FR-007**: On release, the system MUST route the request to the first required approval level for that Creator, using the approver resolution of the Approver Assignment spec, and MUST block the release when that approver is missing or inactive; in that case the request MUST stay pending Initial Review, the system MUST tell the CEA Administrators which approver is missing, and the release MAY be retried after the assignment is fixed. The system MUST NOT skip the level.
- **FR-008**: The system MUST prevent a duplicate submission of the same request (double submit).
- **FR-009**: The system MUST show the Creator and CEA Administrators the current status and the date of the last status change.
- **FR-010**: The system MUST request an email notification to the CEA Administrators on submission and to the first approver on release; the content and delivery are defined in the Notifications spec.

### Key Entities *(include if feature involves data)*

- **CEA Request**: The request, now with submission data (submitted by, submitted on) and a status of pending Initial Review once submitted.
- **Initial Review**: A review record with the administrator who performed it, the date, the outcome (released or returned), and comments.
- **Request Status**: The stage of the request: Draft, pending Initial Review, pending approval, and others defined in later specs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Creator can submit a complete request in under 1 minute.
- **SC-002**: 0 requests enter the approval chain without a completed Initial Review in acceptance tests.
- **SC-003**: 100% of completed Initial Reviews show exactly one administrator as owner.
- **SC-004**: 100% of invalid submissions list every missing or invalid field to the Creator.

## Assumptions

- Review of resubmitted (rejected) requests is defined in the Rejection and Revision Review spec; this spec covers the first submission.
- Approver resolution and skipped levels follow the Approver Assignment spec.
- Email delivery is defined in the Notifications spec.
- The source workflow describes the Initial Review as a validation; the administrator may release the request or return it to the Creator with comments. The notification for an Initial Review return is defined in the Notifications spec, and the Revision Review after approver rejections is defined in the Rejection and Revision Review spec.
- Visibility and permissions follow the Security and Roles spec.

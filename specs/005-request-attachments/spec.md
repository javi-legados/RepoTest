# Feature Specification: Request Attachments

**Feature Branch**: `005-request-attachments`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Attachments of a CEA request: supporting documentation (quotations, technical specifications, drawings, financial analysis, vendor proposals, reports, images, other) uploaded as multiple files to justify the request, uploadable by Creators and CEA Administrators and visible to approvers."

## Clarifications

### Session 2026-10-29

- Q: ¿Qué límite de tamaño por archivo se permite? → A: 25 MB por archivo.
- Q: ¿Qué tipos de archivo se permiten? → A: Lista cerrada: PDF, Office (Word/Excel/PowerPoint), JPG/PNG, CSV/TXT, ZIP y planos DWG/DXF.
- Q: ¿Cuántos archivos como máximo por solicitud? → A: 20 archivos.
- Q: ¿Qué pasa si se sube un archivo con el mismo nombre que uno ya adjunto? → A: Se rechaza el nuevo archivo.
- Q: ¿Puede el Creator agregar o quitar archivos cuando la solicitud es devuelta para corrección? → A: Sí, puede agregar y quitar mientras esté en Draft o devuelta para corrección.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload supporting files to a request (Priority: P1)

A Creator adds one or more files (quotations, drawings, reports, images, etc.) to a request Draft to justify the project, and can see the list of files attached.

**Why this priority**: Approvers rely on the supporting documentation to decide; without it the request cannot be justified.

**Independent Test**: Open a Draft, upload several files at once, and verify they all appear in the attachment list with name, size, uploader, and upload date.

**Acceptance Scenarios**:

1. **Given** a Draft request, **When** the Creator selects several files and uploads them, **Then** all valid files are attached and listed.
2. **Given** a request with attachments, **When** the Creator saves the Draft and reopens it, **Then** the attachments are still listed and available.
3. **Given** an upload that includes an invalid file, **When** the Creator uploads, **Then** the invalid file is rejected with a clear reason and the valid files are still attached.

---

### User Story 2 - Remove or replace attachments while the request is editable (Priority: P1)

The Creator removes a wrong file or uploads a corrected version while the request is a Draft or has been returned for correction.

**Why this priority**: Creators must be able to correct mistakes before approvers see the request.

**Independent Test**: Attach a file, remove it, and verify it no longer appears; attach another with the same name and verify both are handled according to the rules.

**Acceptance Scenarios**:

1. **Given** an editable request with attachments, **When** the Creator removes one, **Then** it disappears from the list and the others remain.
2. **Given** a request that is not editable (for example under review), **When** the Creator opens the attachments, **Then** they can view and download files but cannot add or remove them.

---

### User Story 3 - View and download attachments during review (Priority: P1)

Approvers and CEA Administrators open a request they are allowed to see and view or download its attachments to evaluate it.

**Why this priority**: The approval decision depends on the supporting information.

**Independent Test**: As an approver with access to a request, open it, and download each attachment; as a user without access, verify attachments are not reachable.

**Acceptance Scenarios**:

1. **Given** an approver who can see a request, **When** they open it, **Then** they can view and download all its attachments but cannot add, change, or remove them.
2. **Given** a read-only user (CEA Approvals) who can see a request within their BU hierarchy, **When** they open it, **Then** they can view and download its attachments but not modify them.
3. **Given** a user who cannot see a request, **When** they try to reach its attachments, **Then** access is denied.
4. **Given** a CEA Administrator, **When** they prepare the final documentation, **Then** they can access all attachments of the request.

---

### User Story 4 - Administrators add supporting files (Priority: P2)

A CEA Administrator uploads additional supporting documentation to a request during review or final processing.

**Why this priority**: The roles definition allows administrators to upload attachments; it supports the final document package.

**Independent Test**: As an administrator, upload a file to a request under review and verify it is listed with the administrator as uploader.

**Acceptance Scenarios**:

1. **Given** a request under review, **When** a CEA Administrator uploads a file, **Then** it is attached and shows the administrator as uploader.
2. **Given** an approver (CEA Internal Approvals), **When** they try to upload, **Then** the action is not available.

---

### Edge Cases

- A Creator uploads a file with the same name as an existing attachment: the new file is rejected with a clear reason; the Creator must rename it or remove the existing one first.
- A file exceeds 25 MB or its type is not in the allowed list.
- An upload is interrupted or fails midway.
- The Creator uploads more than the maximum of 20 files per request: the extra files are rejected with a clear reason.
- A Draft is deleted: its attachments are removed with it.
- A request with no attachments is submitted.
- The Creator edits attachments after a rejection: allowed until the request is resubmitted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a Creator to attach multiple files, up to 20 per request, to a request that is a Draft or has been returned to the Creator for correction.
- **FR-002**: The system MUST allow uploading several files in one action.
- **FR-003**: The system MUST list each attachment with its name, size, uploader, and upload date.
- **FR-004**: The system MUST allow the Creator to add and remove attachments while the request is a Draft or has been returned to the Creator for correction (rejected), and MUST NOT allow it in any other status.
- **FR-005**: The system MUST allow CEA Administrators to upload attachments to a request; CEA Internal Approvals and CEA Approvals MUST NOT be able to upload, modify, or remove attachments.
- **FR-006**: The system MUST allow every user who can see a request to view and download its attachments, and MUST deny access to users who cannot see the request.
- **FR-007**: The system MUST reject, with a clear reason, files larger than 25 MB each, files whose type is not in the allowed list (PDF, Word, Excel, PowerPoint, JPG, PNG, CSV, TXT, ZIP, DWG, DXF), and files whose name matches an existing attachment of the same request, without blocking the valid files of the same upload.
- **FR-008**: The system MUST keep attachments with the request when it is saved, submitted, rejected, returned for revision, or approved.
- **FR-009**: The system MUST remove the attachments of a Draft when the Draft is deleted.
- **FR-010**: The system MUST NOT modify the contents of an uploaded file.

### Key Entities *(include if feature involves data)*

- **Attachment**: A file linked to one CEA request, with name, size, type, uploader, and upload date.
- **CEA Request**: The request to which attachments belong (defined in the CEA Request Form spec).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Creator can attach 5 files to a request in under 2 minutes.
- **SC-002**: 100% of attachments of a saved request are available when the request is reopened.
- **SC-003**: 0 users without access to a request can view or download its attachments in acceptance tests.
- **SC-004**: 100% of disallowed or oversized files are rejected with a visible reason.

## Assumptions

- The form fields are defined in the CEA Request Form spec; this spec covers only the Attachments section.
- Visibility of a request follows the Security and Roles spec; attachments inherit that visibility.
- Submitting a request without attachments is allowed, because the form describes attachments as optional supporting documentation. This may be revisited in the Submission spec.
- Allowed file types are PDF, Word, Excel, PowerPoint, JPG, PNG, CSV, TXT, ZIP, DWG, and DXF; the maximum is 20 files per request.
- Retention and deletion of attachments after final processing are out of scope.

# Feature Specification: Security Roles and Business Unit Access

**Feature Branch**: `002-security-roles-access`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Security: the four security roles (CEA Creators, CEA Internal Approvals, CEA Approvals, CEA Administrators), their permission matrix, and data visibility by Business Unit hierarchy (Enterprise > Company > Region > Plant) for the CEA Request Management platform."

## Clarifications

### Session 2026-10-29

- Q: Can an internal approver see all requests in their Business Unit hierarchy, or only those at their approval step or already decided by them? → A: Only requests currently at their approval step or already decided by them (least privilege), always within their Business Unit hierarchy.
- Q: Do read-only users (CEA Approvals) see requests of all Business Units or only their own hierarchy? → A: Only requests within their own Business Unit hierarchy, read-only.
- Q: What happens when the approver of a step is also the Creator of the request? → A: The step is skipped automatically and the request moves to the next level, with the skip recorded in the history.## User Scenarios & Testing *(mandatory)*
- Q: When does a change of roles or Business Unit take effect for a user with an open session? → A: Immediately; permissions are checked on every action.## User Scenarios & Testing *(mandatory)*
- Q: What happens to pending requests when an approver loses the role or changes Business Unit? → A: The change is allowed and the affected requests are flagged for an administrator to reassign (workflow exception).## User Scenarios & Testing *(mandatory)*### User Story 1 - Creators work only with their own requests (Priority: P1)

A user with the CEA Creators role can create requests, upload attachments, and edit their own
requests while in Draft or after a rejection. They see only the requests they created, and
cannot change a request that is pending review or approval, or already approved.

**Why this priority**: Creating requests is the entry point of the whole process, and protecting
a submitted request from changes is the core approval control.

**Independent Test**: Sign in as a Creator, create and submit a request, verify it can no longer
be edited, and verify requests of other Creators are not visible.

**Acceptance Scenarios**:

1. **Given** a Creator, **When** they create a request and upload attachments, **Then** the request
   is saved in Draft and remains editable.
2. **Given** a Creator with a request pending review or approval, **When** they try to edit it or
   its attachments, **Then** the system blocks the change.
3. **Given** a request returned after rejection, **When** the Creator opens it, **Then** they can
   edit it, and can see the rejection comments.
4. **Given** a request created by another user, **When** the Creator looks for it, **Then** it is
   not visible to them.
5. **Given** an approved request, **When** the Creator tries to edit it, **Then** the system
   blocks the change.

---

### User Story 2 - Internal approvers act only on requests in their hierarchy (Priority: P1)

A user with the CEA Internal Approvals role can see requests at their approval step or already
decided by them, inside their Business Unit hierarchy, and approve or reject those at their step
with mandatory comments. They cannot create
requests or change request data or attachments.

**Why this priority**: The approval chain is only reliable if approvers can decide and nothing
else, and only on the requests they are responsible for.

**Independent Test**: Sign in as an approver of one plant and verify they can approve or reject a
request of that plant, but cannot see or act on a request of another plant, and cannot edit it.

**Acceptance Scenarios**:

1. **Given** a request assigned to the approver, **When** they approve or reject it with a
   comment, **Then** the decision and comment are recorded.
2. **Given** an approver deciding on a request, **When** they leave the comment empty, **Then**
   the system blocks the decision.
3. **Given** a request from a Business Unit outside the approver's hierarchy, **When** the
   approver searches, **Then** it is not visible and cannot be acted upon.
4. **Given** an approver, **When** they try to create a request or edit request data or
   attachments, **Then** the action is not available.
5. **Given** a request that is not at the approver's step, **When** the approver tries to decide,
   **Then** the system blocks the decision.

---

### User Story 3 - Read-only consultation across the platform (Priority: P2)

A user with the CEA Approvals role has read-only access to all requests within their Business Unit
hierarchy, including history, status, comments, approvals, and attachments, and cannot take any
workflow action.

**Why this priority**: Gives management and auditors visibility without risk of changing data.

**Independent Test**: Sign in as a CEA Approvals user, open requests from different plants, and
verify that no create, edit, approve, reject, or attachment change action is available.

**Acceptance Scenarios**:

1. **Given** a read-only user, **When** they open a request within their Business Unit hierarchy,
   **Then** they see its data,
   history, comments, approvals, and attachments.
2. **Given** a read-only user, **When** they look for a request outside their hierarchy, **Then**
   it is not visible.
3. **Given** a read-only user, **When** they look for create, edit, approve, reject, or upload
   actions, **Then** none are available.

---

### User Story 4 - Administrators manage the platform and all requests (Priority: P2)

A user with the CEA Administrators role can see all requests, perform initial and revision
reviews, handle workflow exceptions, manage roles and reference data, and access all records for
reporting and auditing. They can also create and edit requests, and add comments. They approve or
reject only at Initial Review and Revision Review (one administrator is enough), never in the
approval chain.

**Why this priority**: Operations depend on administrators unblocking and supporting the process.

**Independent Test**: Sign in as an administrator, open any request, perform a review, and verify
that approve and reject actions are not available to them.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** they search requests, **Then** they see all requests of
   all Business Units.
2. **Given** a request awaiting initial or revision review, **When** one administrator approves
   or rejects it with a comment, **Then** the decision is recorded and applies to the request.
3. **Given** a request at an approval-chain step, **When** an administrator looks at it, **Then**
   approve and reject actions are not available to them.

---

### User Story 5 - Visibility follows the Business Unit hierarchy (Priority: P1)

A user sees records owned by their own Business Unit and the Business Units below it
(Enterprise sees all; Company sees its regions and plants; Region sees its plants; Plant sees only
its plant), subject to the limits of their role.

**Why this priority**: Prevents exposing requests of other companies, regions, or plants.

**Independent Test**: Create requests in two plants of different regions and verify that a
Region user sees only their region's plants, and a Plant user sees only their plant.

**Acceptance Scenarios**:

1. **Given** a user in the Enterprise Business Unit, **When** they search, **Then** they see
   requests of all companies, regions, and plants.
2. **Given** a user in a Company Business Unit, **When** they search, **Then** they see its
   regions and plants but not other companies.
3. **Given** a user in a Region Business Unit, **When** they search, **Then** they see the plants
   of that region only.
4. **Given** a user in a Plant Business Unit, **When** they search, **Then** they see only that
   plant's requests.
5. **Given** a user moved to another Business Unit, **When** the change is saved, **Then** their
   visibility reflects the new Business Unit immediately, even in an open session.

---

### Edge Cases

- A user holds more than one role; permissions MUST be the combination, but the Creator
  restriction of not editing submitted requests still applies to requests they created.
- A Creator who is also an approver tries to approve their own request; the step is skipped
  automatically and recorded in the history.
- An approver's Business Unit changes while a request is waiting for their decision; the change
  is allowed and the request is flagged for an administrator to reassign.
- A user with no role or no Business Unit signs in.
- An administrator needs to act on a request while no approver is available (workflow exception).
- A role is removed from a user who has pending work; the removal is allowed and the affected
  requests are flagged for an administrator to reassign.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide exactly four security roles: CEA Creators, CEA Internal
  Approvals, CEA Approvals, and CEA Administrators.
- **FR-002**: CEA Creators MUST be able to create requests, complete and submit the form, upload
  attachments, and edit their own requests only in Draft or Rejected status.
- **FR-003**: CEA Creators MUST be able to view only the requests they created, and MUST NOT be
  able to modify a request while it is pending review or approval, or after it is approved.
- **FR-004**: CEA Internal Approvals MUST be able to view only requests that are currently at
  their approval step or that they already decided, within their Business Unit hierarchy, and to
  approve or reject those at their step.
- **FR-005**: The system MUST require a comment for every approve and reject action by CEA
  Internal Approvals.
- **FR-006**: CEA Internal Approvals MUST NOT be able to create requests, edit request data, or
  modify attachments.
- **FR-007**: CEA Approvals MUST have read-only access to all requests within their Business Unit
  hierarchy, including history, status, comments, approvals, and attachments, and MUST NOT be able
  to create, edit, approve, reject, or modify attachments.
- **FR-008**: CEA Administrators MUST be able to view all requests, perform initial and revision
  reviews, manage workflow exceptions (restart or reassign), maintain reference data, manage roles
  and permissions, and access all records for reporting and auditing.
- **FR-009**: CEA Administrators MUST be able to create and edit requests, upload attachments,
  and add comments. They MUST be able to approve or reject a request only at Initial Review and
  Revision Review, with a mandatory comment, and MUST NOT approve or reject at the approval-chain
  steps.
- **FR-010**: The system MUST apply the permission matrix of the User Roles document as the
  authoritative definition of what each role can do.
- **FR-011**: The system MUST organize data ownership by Business Unit (Enterprise > Company >
  Region > Plant) and MUST show a user the records of their Business Unit and those below it, and
  no others.
- **FR-012**: The system MUST deny access to users without at least one role and one Business
  Unit.
- **FR-013**: When a user has several roles, the system MUST grant the combination of their
  permissions, except that no user MAY approve or reject a request they created; when the approver of a step is
  the Creator, the system MUST skip that step automatically, move the request to the next level,
  and record the skip in the history.
- **FR-014**: The system MUST enforce these permissions in the platform itself, not only by
  hiding actions in the user interface.
- **FR-015**: The system MUST record denied attempts to approve, reject, or edit outside role
  permissions so they can be reviewed in auditing.
- **FR-016**: A change in a user's roles or Business Unit MUST take effect immediately, including
  for open sessions (permissions are checked on every action), and MUST NOT alter request history.

- **FR-017**: When an approver loses the role or changes Business Unit while having pending
  decisions, the system MUST allow the change and MUST flag the affected requests for an
  administrator to reassign.

### Key Entities *(include if feature involves data)*

- **Security Role**: One of the four roles, with the permissions defined in the matrix.
- **Permission Matrix**: The per-role capabilities (create, submit, view own, view all, edit
  draft, edit rejected, approve, reject, add comments, upload attachments, initial review,
  revision review, platform administration).
- **Business Unit**: A node of the Enterprise > Company > Region > Plant hierarchy that owns
  records and determines visibility.
- **User Assignment**: The link between a user, their roles, and their Business Unit.
- **Access Denial Record**: A log of blocked actions with user, action, request, and time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of the capabilities in the permission matrix behave as
  allowed or denied for each role.
- **SC-002**: 0 requests are visible to users outside the Business Unit hierarchy of the record,
  verified with one test user per level (Enterprise, Company, Region, Plant).
- **SC-003**: 0 submitted or approved requests can be modified by their Creator.
- **SC-004**: 100% of approve and reject actions have a comment recorded.
- **SC-005**: 0 users can approve or reject a request they created, and 0 administrator decisions
  occur outside Initial and Revision Review.
- **SC-006**: An administrator can change a user's role or Business Unit in under 2 minutes, and
  the change is effective immediately, including for open sessions.

## Assumptions

- Users and their attributes are registered per the Users and Master Data spec; this spec only
  defines what registered users can do.
- Request routing and who is the approver at each step are defined in the Approver Assignment and
  Approval Chain specs; this spec defines the permissions that make those steps possible.
- A user belongs to exactly one Business Unit but may hold several roles.
- Approvers see only requests currently at their approval step or already decided by them, and
  only within their Business Unit hierarchy; they do not see other requests of their hierarchy.
- The scope of Enterprise-level approvers is not fully defined in the source document and is
  treated as the same as other approvers (limited to requests of their hierarchy) until confirmed.
- Read-only users see requests of their own Business Unit hierarchy only (this spec overrides the
  roles document, which says "all requests"; users who need all requests are assigned to the
  Enterprise Business Unit).
- Administrators are not chain approvers; they decide only at Initial and Revision Review, where
  one administrator's decision is enough. The role matrix document lists them as unable to
  approve, which this spec overrides for those two review steps.

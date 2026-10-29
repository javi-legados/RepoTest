# Feature Specification: Users and Master Data

**Feature Branch**: `001-users-master-data`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Users and master data: mandatory user attributes (SAP Number, Name, Email, Department, Manager Name, Manager Email, Business Unit) and catalogs of plants and regions, needed for approval routing and data access in the CEA Request Management platform."

## Clarifications

### Session 2026-10-29

- Q: Must a user's direct manager be registered with the approver role before the user can submit requests? → A: The user can be registered with an unregistered manager (with a warning), but the Creator cannot submit requests until the manager is registered with the CEA Internal Approvals role.
- Q: What happens to in-progress requests when a user is deactivated? → A: Deactivation is blocked while the user has own pending requests or requests awaiting their approval; an administrator must reassign them first.
- Q: How is the Business Unit determined for a user who works across several plants or regions? → A: Exactly one Business Unit per user; users covering several plants are assigned to the higher-level Business Unit (Region or Company).
- Q: Which language must the screens and emails use? → A: English only.
- Q: What data volume is expected? → A: Up to 500 users and 50 plants.
## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register a user with complete data (Priority: P1)

A CEA Administrator registers a person in the platform, capturing SAP Number, name, corporate
email, department, direct manager name and email, and a Business Unit, and assigns at least one
security role. Nobody can use the platform until registered.

**Why this priority**: Every other capability (creating requests, routing to the direct manager,
visibility by Business Unit) depends on complete and correct user records.

**Independent Test**: Register a user with all mandatory data and verify the user can sign in and
is shown with the assigned role and Business Unit.

**Acceptance Scenarios**:

1. **Given** an administrator on the user registration form, **When** all mandatory attributes
   are provided with at least one role and one Business Unit, **Then** the user is saved and can
   access the platform.
2. **Given** a registration with any mandatory attribute missing, **When** the administrator
   tries to save, **Then** the system blocks the save and identifies the missing attributes.
3. **Given** a SAP Number that already belongs to another user, **When** the administrator saves,
   **Then** the system rejects the record as a duplicate.
4. **Given** a person that is not registered, **When** they try to access the platform, **Then**
   access is denied.

---

### User Story 2 - Keep user and manager information up to date (Priority: P2)

A CEA Administrator updates a user's department, direct manager, Business Unit, or roles when the
person's organizational situation changes, so that approvals and visibility stay correct.

**Why this priority**: Stale manager or Business Unit data sends approvals to the wrong person or
exposes the wrong records.

**Independent Test**: Change a user's direct manager and verify that a new request from that user
shows the new manager as first approver, while already submitted requests keep their history.

**Acceptance Scenarios**:

1. **Given** an existing user, **When** the administrator changes the manager name and email,
   **Then** new requests from that user route to the new manager.
2. **Given** an existing user, **When** the administrator moves the user to another Business
   Unit, **Then** the user's visibility changes to that Business Unit and those below it.
3. **Given** a user with requests in progress, **When** the manager data changes, **Then** the
   change is recorded in history and requests already in an approval step are not silently
   re-routed.

---

### User Story 3 - Maintain plant and region catalogs (Priority: P2)

A CEA Administrator maintains the catalog of plants and regions, organized in the Business Unit
hierarchy (Enterprise > Company > Region > Plant), so users and requests can be assigned to a
valid location.

**Why this priority**: The request form's Project Location list and the Business Unit assignment
of every user come from these catalogs.

**Independent Test**: Add a plant under a region and verify it appears as a selectable
location and as a Business Unit assignment option.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** a new plant is created under a region, **Then** it is
   available for user assignment and as a project location.
2. **Given** a plant with users or requests associated, **When** the administrator tries to
   delete it, **Then** the system prevents deletion and offers to deactivate it instead.
3. **Given** an inactive plant, **When** a Creator fills a new request, **Then** the plant is not
   offered as a project location.

---

### User Story 4 - Review the user directory (Priority: P3)

A CEA Administrator searches and reviews users by name, SAP Number, department, role, or Business
Unit to audit that data is complete.

**Why this priority**: Supports ongoing data quality but is not needed to start operating.

**Independent Test**: Filter the user list by Business Unit and verify that only matching users
appear and incomplete records are easy to identify.

**Acceptance Scenarios**:

1. **Given** registered users, **When** the administrator filters by Business Unit or role,
   **Then** only matching users are listed.
2. **Given** users with incomplete mandatory data, **When** the administrator reviews the
   directory, **Then** those records are flagged.

---

### Edge Cases

- A user's direct manager is not registered in the platform.
- A user is their own manager, or manager relationships form a loop.
- A user is assigned to more than one security role.
- A user's email or SAP Number is changed to a value used by another user.
- A user is deactivated while they own draft or in-progress requests, or have requests awaiting
  their decision (deactivation is blocked until reassigned).
- A manager leaves the company and has direct reports pointing to them.
- A Business Unit is assigned to a level that does not match the hierarchy (for example a plant
  under another plant).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST require every user to be registered before accessing any
  application or service of the platform.
- **FR-002**: The system MUST require for every user: SAP Number, Name, Email, Department,
  Manager Name, Manager Email, and Business Unit; a record missing any of them MUST NOT be saved.
- **FR-003**: The system MUST require each user to have at least one security role and exactly
  one Business Unit.
- **FR-004**: The system MUST enforce a unique SAP Number and a unique corporate Email per user.
- **FR-005**: The system MUST validate that Email and Manager Email have a valid email format.
- **FR-006**: The system MUST use the user's Manager Email as the identity of the first approver
  when a request is routed.
- **FR-006a**: The system MUST allow registering a user whose manager is not yet registered,
  showing a warning, and MUST NOT allow that user to submit a request until the manager is
  registered with the CEA Internal Approvals role.
- **FR-007**: The system MUST reject a user being their own manager.
- **FR-008**: The system MUST allow CEA Administrators, and only them, to create, update, and
  deactivate users and to assign roles and Business Units.
- **FR-008a**: The system MUST block deactivating a user who has own requests in Draft, review,
  or approval, or requests awaiting their decision, until an administrator reassigns them.
- **FR-009**: The system MUST maintain a catalog of Business Units in the hierarchy Enterprise >
  Company > Region > Plant, where each Region belongs to one Company and each Plant to one Region.
- **FR-010**: The system MUST provide the active plants as the list of project locations for the
  CEA Request form and the list of Business Units for user assignment.
- **FR-011**: The system MUST NOT allow deleting a plant, region, or company that has users or
  requests associated; it MUST allow deactivating it instead, and inactive entries MUST NOT be
  offered for new assignments.
- **FR-012**: The system MUST record who changed user, manager, role, and Business Unit data, what
  changed, and when.
- **FR-013**: The system MUST let administrators search and filter users by name, SAP Number,
  department, role, and Business Unit, and identify records with incomplete data.
- **FR-014**: Changes to a user's manager or Business Unit MUST apply to new requests and MUST NOT
  alter the approvers or history of requests already submitted.

### Key Entities *(include if feature involves data)*

- **User**: A person registered in the platform. Attributes: SAP Number, Name, Email, Department,
  Manager Name, Manager Email, Business Unit, one or more security roles, active/inactive status.
- **Security Role**: CEA Creators, CEA Internal Approvals, CEA Approvals, or CEA Administrators;
  permissions are defined in the security spec.
- **Business Unit**: A node in the hierarchy with a level (Enterprise, Company, Region, Plant), a
  name, a parent, and an active/inactive status. Users and requests belong to one Business Unit.
- **Plant**: A Business Unit of level Plant, representing a manufacturing site; used as the
  project location of a request.
- **User Change Record**: History of changes to a user's data (who, what, when).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of registered users have all mandatory attributes, a role, and a Business Unit.
- **SC-002**: An administrator can register a new user with complete data in under 3 minutes.
- **SC-003**: 100% of attempts to save a user with missing mandatory data or a duplicate SAP
  Number are blocked with a message identifying the problem.
- **SC-004**: 100% of requests created after a manager change show the updated manager as first
  approver.
- **SC-005**: An administrator can locate any user by name or SAP Number in under 30 seconds.
- **SC-006**: Zero plants, regions, or companies with associated users or requests can be deleted.

## Assumptions

- Users sign in with their corporate account; this spec covers registration and data quality, not
  how sign-in itself works.
- The user directory is maintained manually by CEA Administrators; automatic synchronization with
  SAP or a corporate directory is out of scope.
- Manager Name and Manager Email are stored on the user record and are not required to match
  another registered user at registration time; a warning is shown when the manager is not
  registered, and request submission is blocked until the manager is registered as an approver.
- Each user belongs to exactly one Business Unit; users that need broader visibility are assigned
  to a higher-level Business Unit.
- The security role permissions and Business Unit visibility rules are defined in the Roles and
  Security spec; the assignment of Plant Manager and Regional Approver per Business Unit is
  defined in the Approver Assignment spec.
- Initial catalogs of plants and regions will be provided by the business before go-live.
- All user-facing text (screens, catalog labels, and email notifications) is in English only.
- Expected volume is up to 500 users and 50 plants; simple filtered lists are sufficient.

# Tasks: Email Notifications

**Input**: `specs/009-email-notifications/` (plan.md, spec.md, research.md, data-model.md, contracts/notification-events.md, quickstart.md)
**Prerequisites**: `CEAPlatform` solution from Spec 1 (solution, folder layout, `CEA Administrators` role, "CEA Administration" app, `cea_` prefix); `CeaRequest` and workflow events from Specs 3–8 and 10; Office 365 Outlook connection owned by a service account. Tests are not requested by the spec; validation is done through quickstart.md scenarios and flow run checks (Polish phase). No plug-ins: plan.md Complexity Tracking reports "No violations" (cloud flows + Outlook connector only).

**Format**: `- [ ] T### [P] [US#] Description with path` — `[P]` = parallelizable (different files, no dependency on incomplete tasks).

## Phase 1: Setup

- [ ] T001 Reuse the `CEAPlatform` unmanaged solution and `cea` publisher from Spec 1 (do not recreate); confirm `solution/CEAPlatform/{Tables,Flows,ModelDrivenApp}` exist and add `solution/CEAPlatform/Tables/NotificationRequest/`, `solution/CEAPlatform/Tables/NotificationOutcome/` and `solution/CEAPlatform/Tables/EmailTemplate/`
- [ ] T002 [P] Create `tests/flows/` with a `README.md` describing the flow run tests (per-event, forced failure/retry, invalid address) per plan.md
- [ ] T003 [P] Create the Office 365 Outlook connection owned by a service account and a connection reference `cea_OutlookServiceAccount` in `solution/CEAPlatform/Flows/ConnectionReferences.md` (research.md R2)

## Phase 2: Foundational (blocks all user stories)

- [ ] T004 Create table `cea_notificationrequest` in `solution/CEAPlatform/Tables/NotificationRequest/` with columns: Event Type Choice (Submitted, Resubmitted, Released, Approved Next Level, All Approved, Rejected, Returned, Final Completed, Approver Reminder, Creator Reminder, Alert Blocked, Alert On Hold, Alert Delivery Failure, Alert Invalid Recipient); Request Lookup `CeaRequest` (table from Spec 3/4); Recipient Group Choice (Administrators, Creator, Approver); Recipient Lookup User (nullable for Administrators; User from Spec 1); Comments Multiline (for rejection/return); Event Id Text (groups consolidation); Status Choice (Queued, Sent, Failed, Skipped)
- [ ] T005 [P] Create table `cea_notificationoutcome` in `solution/CEAPlatform/Tables/NotificationOutcome/` with columns: Notification Request (lookup), Recipient (lookup User), Sent On, Attempts, Result Choice (Sent, Failed, Skipped), Reason
- [ ] T006 [P] Create table `cea_emailtemplate` in `solution/CEAPlatform/Tables/EmailTemplate/` with columns: Event Type, Subject, Body (English), Expected Action text (FR-011, research.md R7)
- [ ] T007 Configure security in `solution/CEAPlatform/SecurityRoles/`: `CEA Administrators` (role from Spec 1) read access to `cea_notificationrequest` and `cea_notificationoutcome` and read/write on `cea_emailtemplate`; remove update/delete on `cea_notificationoutcome` for every role (outcomes are immutable history); write access to `cea_notificationrequest` for the workflow-action identities of Specs 6, 7, 8 and 10 (detailed matrix in Spec 2)
- [ ] T008 Create the dispatch flow skeleton `solution/CEAPlatform/Flows/DispatchNotifications.json` triggered on create of `cea_notificationrequest` with status Queued, running asynchronously so the triggering workflow action is never blocked (FR-009, research.md R1)
- [ ] T009 Implement recipient resolution in `solution/CEAPlatform/Flows/DispatchNotifications.json`: Recipient Group Administrators expands to each active `CEA Administrators` user individually, never a shared mailbox (FR-010, R3); Creator and Approver use the Recipient lookup
- [ ] T010 Implement the pre-send check in `solution/CEAPlatform/Flows/DispatchNotifications.json`: recipient must be an active user with a valid email format; otherwise do not send, set Status Skipped, write a `cea_notificationoutcome` with Result Skipped and Reason, and enqueue an Alert Invalid Recipient request (FR-008, FR-012, R5)
- [ ] T011 Implement consolidation in `solution/CEAPlatform/Flows/DispatchNotifications.json`: group queued rows by recipient and Event Id and send one email listing all expected actions (FR-013, R4)
- [ ] T012 Implement the send step using Office 365 Outlook "Send an email (V2)" with template lookup from `cea_emailtemplate`, English only, including request identifier, expected action and request link (FR-007, FR-011, R2, R7) in `solution/CEAPlatform/Flows/DispatchNotifications.json`; if the recipient cannot see the request, include only the identifier (R10)
- [ ] T013 Configure the retry policy on the send action (3 attempts, exponential backoff) in `solution/CEAPlatform/Flows/DispatchNotifications.json`; on final failure set Status Failed, write the outcome with Attempts and Reason, and enqueue an Alert Delivery Failure request (FR-009, R6)
- [ ] T014 Implement outcome recording for every send, skip and failure (Sent On, Attempts, Result, Reason) in `solution/CEAPlatform/Flows/DispatchNotifications.json` (FR-008, SC-004)
- [ ] T015 Create the alert flow `solution/CEAPlatform/Flows/AlertAdministrators.json` sending Alert Blocked, Alert On Hold, Alert Delivery Failure and Alert Invalid Recipient to each active administrator, with a loop guard so alert emails never create further failure alerts (R9)
- [ ] T016 Create the retry flow `solution/CEAPlatform/Flows/RetryFailedNotifications.json` that re-processes rows left Queued after a transient outage, without duplicating sends
- [ ] T017 [P] Add the "Notification Log" view (Event Type, Request, Recipient, Status, Attempts, Result, Reason, Sent On) for administrators in `solution/CEAPlatform/ModelDrivenApp/Views/NotificationLog.xml` and add it to the "CEA Administration" sitemap from Spec 1

**Checkpoint**: queue, templates, dispatch, retry, alert and log exist; user stories can start.

## Phase 3: User Story 1 — Be notified when it is my turn (Priority: P1) 🎯 MVP

**Goal**: Each person who must act (CEA Administrators, approvers) receives an email at the moment the request needs their action.
**Independent Test**: Submit, release, approve through the chain and verify each expected email reaches the right recipients, each administrator with their own copy (quickstart scenarios 1, 5, 9). This story is independently testable.

- [ ] T018 [P] [US1] Create English templates for Submitted, Resubmitted, Released and Approved Next Level (and the administrator copy of All Approved) in `solution/CEAPlatform/Tables/EmailTemplate/data/turn-templates.csv`, each with request id, expected action and link (FR-001, FR-002, FR-003, FR-007)
- [ ] T019 [US1] Wire the Submission event of Spec 6: write a `cea_notificationrequest` (Event Type Submitted, Recipient Group Administrators) in the same transaction as submission, documented in `specs/009-email-notifications/contracts/notification-events.md` (FR-001)
- [ ] T020 [US1] Wire the release and approval-chain events of Spec 7: Released to the first approver and Approved Next Level to the next approver (Recipient Group Approver), documented in `specs/009-email-notifications/contracts/notification-events.md` (FR-002)
- [ ] T021 [US1] Wire the "all applicable approvals complete" event of Spec 7: write All Approved for Recipient Group Administrators (and Creator, shared with US3) with a common Event Id so one person with several roles gets one consolidated email (FR-003, FR-013)
- [ ] T022 [US1] Publish the solution and run the dispatch flow end to end for a request moving through submit → release → approvals, confirming each administrator receives an individual email

**Checkpoint**: US1 independently usable (MVP).

## Phase 4: User Story 2 — Be informed of rejections and returns (Priority: P1)

**Goal**: The Creator receives an email with the comments whenever the request is rejected or returned; administrators are told of revised submissions.
**Independent Test**: Reject and return requests and verify the Creator email includes the comments; resubmit and verify administrators are notified (quickstart scenarios 2, 3). This story is independently testable.

- [ ] T023 [P] [US2] Create English templates for Rejected and Returned with a Comments placeholder in `solution/CEAPlatform/Tables/EmailTemplate/data/rejection-templates.csv` (FR-004, SC-003)
- [ ] T024 [US2] Wire the rejection event of Spec 8 (approver rejects): write Event Type Rejected, Recipient Group Creator, with Comments copied from the rejection, documented in `specs/009-email-notifications/contracts/notification-events.md` (FR-004)
- [ ] T025 [US2] Wire the administrator return event of Spec 8: write Event Type Returned, Recipient Group Creator, with Comments (FR-004)
- [ ] T026 [US2] Ensure `DispatchNotifications.json` blocks sending Rejected/Returned notifications whose Comments are empty (marks Failed with Reason and alerts administrators), so 100% of these emails include comments (SC-003)
- [ ] T027 [US2] Wire the revised-request resubmission event: write Event Type Resubmitted, Recipient Group Administrators (FR-001), reusing the Resubmitted template from T018

## Phase 5: User Story 3 — Know that the request is complete (Priority: P2)

**Goal**: The Creator receives a confirmation that all approvals are complete and the final CEA package is being prepared.
**Independent Test**: Complete the final approval and verify the Creator receives the confirmation (quickstart scenario 4). This story is independently testable.

- [ ] T028 [P] [US3] Create the English template for All Approved (Creator copy: "final CEA package is being prepared") and Final Completed (completion notice from Spec 10) in `solution/CEAPlatform/Tables/EmailTemplate/data/completion-templates.csv` (FR-005)
- [ ] T029 [US3] Add the Creator row (Event Type All Approved, Recipient Group Creator) to the final-approval hook from T021, sharing its Event Id (FR-005)
- [ ] T030 [US3] Wire the Final Processing completion event of Spec 10: write Event Type Final Completed, Recipient Group Creator, documented in `specs/009-email-notifications/contracts/notification-events.md`

## Phase 6: User Story 4 — Receive reminders and alerts (Priority: P2)

**Goal**: Approvers and Creators receive reminders for pending items after N days, and CEA Administrators receive alerts for blocked requests or on-hold levels.
**Independent Test**: Leave a request pending beyond N days and block a release for a missing approver; verify the reminder and the alert (quickstart scenario 8). This story is independently testable.

- [ ] T031 [P] [US4] Create English templates for Approver Reminder, Creator Reminder, Alert Blocked, Alert On Hold, Alert Delivery Failure and Alert Invalid Recipient in `solution/CEAPlatform/Tables/EmailTemplate/data/reminder-alert-templates.csv` (FR-006)
- [ ] T032 [US4] Create the scheduled flow `solution/CEAPlatform/Flows/PendingReminders.json` that enqueues Approver Reminder / Creator Reminder rows for items pending beyond N days (N as defined in earlier specs; read from the environment variable of Spec 7) (FR-006, R8)
- [ ] T033 [US4] Wire the blocked-release alert of Spec 7 (missing or inactive approver) and the on-hold-level alert: write Alert Blocked / Alert On Hold rows for Recipient Group Administrators, documented in `specs/009-email-notifications/contracts/notification-events.md` (FR-006)
- [ ] T034 [US4] Verify Alert Delivery Failure and Alert Invalid Recipient rows created by T010 and T013 are routed through `AlertAdministrators.json` and do not recurse (FR-009, FR-012, R9)

## Phase 7: Polish & Cross-Cutting

- [ ] T035 [P] Write flow run checks in `tests/flows/dispatch.tests.md` covering every event row of the table in `contracts/notification-events.md` (recipients, content, English only, link) and the rule that one consolidated email is sent per person and event
- [ ] T036 [P] Write Web API rule checks in `tests/flows/notification-rules.tests.ps1`: outcomes cannot be updated or deleted; every `cea_notificationrequest` ends with exactly one outcome per recipient (Sent, Failed or Skipped); workflow actions still succeed when the mail connector fails (SC-004, FR-009)
- [ ] T037 Run all quickstart.md scenarios 1–9 in a clean Dev environment (including forced connector failure and a blank/deactivated recipient email) and note results in `specs/009-email-notifications/quickstart.md`
- [ ] T038 Measure delivery latency (event to inbox) under normal conditions against the 5-minute target and record it in `specs/009-email-notifications/quickstart.md` (SC-002)
- [ ] T039 Confirm that no plug-in was introduced and that the Complexity Tracking entry in `specs/009-email-notifications/plan.md` ("No violations") is still accurate
- [ ] T040 Export the solution (`pac solution export` + `unpack`) into `solution/CEAPlatform/` and commit

## Dependencies & Execution Order

- Phase 1 → Phase 2 → user stories. Phase 2 blocks everything (queue tables, dispatch, send, retry, alert).
- US1 (P1) has no dependency on other stories → MVP; it creates the shared All Approved hook (T021).
- US2 (P1) is independent of US1 beyond the reused Resubmitted template (T018); independently testable.
- US3 depends on T021 for the shared Event Id but is independently testable.
- US4 depends only on Phase 2 (alert flow, templates) and the event definitions of Specs 7 and 8.
- Polish after all desired stories. Wiring tasks depend on the sending specs (6, 7, 8, 10) exposing their events.

## Parallel Opportunities

- T002/T003; T005/T006; T018/T023/T028/T031 (template data files); T035/T036.
- After Phase 2, US1, US2 and US4 can proceed in parallel by different people.

## Implementation Strategy

1. Setup + Foundational.
2. US1 → validate → MVP.
3. US2 (also P1), then US3 and US4 (P2).
4. Polish, then export the solution.

**Totals**: 40 tasks — Setup 3, Foundational 14, US1 5, US2 5, US3 3, US4 4, Polish 6.

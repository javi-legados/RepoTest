# Implementation Plan: Email Notifications

**Branch**: `009-email-notifications` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

## Summary

Central notification mechanism: workflow actions of Specs 6, 7, 8 and 10 write `NotificationRequest` rows in the same transaction; one Power Automate flow consumes them, resolves recipients (each active administrator individually, consolidated per person and event), validates address and state, sends the English email via the Office 365 Outlook connector with retries, and records the outcome. Failures and unsendable recipients alert administrators and never block the workflow.

## Technical Context

**Language/Version**: Power Automate cloud flows; Office 365 Outlook connector; email templates in English
**Primary Dependencies**: Specs 1–8, 10; connection owned by a service account
**Storage**: `NotificationRequest` and `NotificationOutcome` tables; templates in `EmailTemplate` table
**Testing**: Flow run tests per event, forced failure/retry test, invalid-address test, quickstart.md
**Target Platform**: Power Platform environment
**Project Type**: Power Platform solution
**Performance Goals**: Delivered within 5 minutes of the event
**Constraints**: English only; email only; never block workflow; one email per person and event
**Scale/Scope**: Low volume; up to ~10 recipients per event

## Constitution Check

| Principle / Constraint | Status | Notes |
|---|---|---|
| Standard capabilities first | Pass | Cloud flow + Outlook connector |
| Justify complexity | Pass | No custom code |
| Every status change sends an email | Pass | Every action writes a request row |
| Immutable history | Pass | Outcomes recorded |
| Workflow not blocked | Pass | Asynchronous queue table |

## Project Structure

```text
specs/009-email-notifications/
├── plan.md  research.md  data-model.md  quickstart.md
└── contracts/notification-events.md
solution/CEAPlatform/
├── Tables/   # NotificationRequest, NotificationOutcome, EmailTemplate
├── Flows/    # Dispatch notifications, Retry, Alert administrators
└── ModelDrivenApp/  # Notification log view for administrators
tests/flows/
```

**Structure Decision**: Queue table decouples senders from delivery.

## Complexity Tracking

No violations.

# Feature Specification: CEA Request Form

**Feature Branch**: `004-cea-request-form`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "CEA Request form: requester data, project schedule, supplemental/addendum, project category, currency, financial data, monetary values tables with subtotals and grand total, monthly spending forecast that must total 100%, and project details, saved as a Draft before submission."

## Clarifications

### Session 2026-10-29

- Q: ¿Qué campos son obligatorios para guardar un Draft? → A: Todos los campos de la sección 1 (Requester Data) y la sección 2 (Project Category) del formulario; el resto puede quedar incompleto hasta el envío.
- Q: ¿Qué pasa si un mes de pronóstico cae fuera del calendario del proyecto? → A: Se muestra una advertencia, pero se permite guardar y enviar.## User Scenarios & Testing *(mandatory)*
- Q: ¿Qué pasa si el pronóstico tiene dos líneas para el mismo año y mes? → A: Se bloquea; cada año/mes solo puede aparecer una vez.## User Scenarios & Testing *(mandatory)*
- Q: ¿Se puede enviar con Grand Total igual a cero? → A: No; el Grand Total debe ser mayor a cero.## User Scenarios & Testing *(mandatory)*### User Story 1 - Create and save a request Draft (Priority: P1)
- Q: ¿Qué pasa si Project in Plan = Yes y el Budgeted Amount es menor al Grand Total? → A: Se muestra una advertencia visible, pero se permite guardar y enviar.## User Scenarios & Testing *(mandatory)*### User Story 1 - Create and save a request Draft (Priority: P1)
A CEA Creator opens a new request, sees their name, location, department, and the current date
filled in automatically, completes the project data, and saves it as a Draft that they can
reopen and continue later.

**Why this priority**: The form is the core of the platform; every later step depends on its data.

**Independent Test**: Create a request, fill part of the form, save, close, reopen, and verify
the data is kept and the system fields are correct.

**Acceptance Scenarios**:

1. **Given** a Creator, **When** they open a new request, **Then** Project Manager, Location,
   Department, and Date are filled automatically and cannot be edited.
2. **Given** a partially completed form, **When** the Creator saves, **Then** a Draft is saved
   without requiring all fields.
3. **Given** a saved Draft, **When** the Creator reopens it, **Then** all entered data is shown
   and still editable.
4. **Given** a Draft, **When** the Creator deletes or abandons it, **Then** it is not sent to
   anyone for review.

---

### User Story 2 - Describe the project, schedule, and supplemental status (Priority: P1)

The Creator enters the start date, the estimated completion date, whether the request is a
Supplemental / Addendum, and the project description. If it is a Supplemental / Addendum, they
choose a previous CEA they created; if not, they enter the project name and select the plant.

**Why this priority**: These fields identify what the request is and where it applies.

**Independent Test**: Toggle Supplemental / Addendum between Yes and No and verify the right
fields appear and the right values are required.

**Acceptance Scenarios**:

1. **Given** Supplemental / Addendum = Yes, **When** the Creator opens the form, **Then** they can
   choose an Existing CEA Reference from the CEAs they previously created, and the project name
   and location fields are hidden.
2. **Given** Supplemental / Addendum = No, **When** the Creator opens the form, **Then** they must
   enter a Request Project Name and select a Project Location from the plant list.
3. **Given** a completion date earlier than the start date, **When** the Creator saves for
   submission, **Then** the system blocks it and explains why.
4. **Given** a project description summary longer than 300 characters, **When** the Creator types
   it, **Then** the system does not accept more than 300 characters.

---

### User Story 3 - Select category, currency, and enter financial data (Priority: P1)

The Creator selects one project category and one currency, states whether the project is in the
plan, enters the investment required, and, for categories that need them, the additional
financial metrics.

**Why this priority**: Approvers decide based on these financial data.

**Independent Test**: Choose each category and verify that the additional financial metrics
appear only for the four categories that require them.

**Acceptance Scenarios**:

1. **Given** the category Capacity Requirements, Cost Savings, Innovation, or New Facilities,
   **When** selected, **Then** Pay Back (Years), IRR (%), and NPV are shown and required.
2. **Given** any other category, **When** selected, **Then** those metrics are hidden and not
   required.
3. **Given** Project in Plan = Yes, **When** the Creator continues, **Then** Budgeted Amount is
   shown and required; if No, it is hidden.
4. **Given** the six currencies (USD, EUR, GBP, UAH, CNY, AUD), **When** the Creator selects one,
   **Then** all amounts of the request are expressed in that currency.
5. **Given** the form, **When** the Creator enters Non-Capitalized Expenses and Write-Off, **Then**
   both are saved as currency amounts.

---

### User Story 4 - Itemize monetary values with automatic totals (Priority: P1)

The Creator adds cost lines in five groups (Modifications to Existing Building, Non-Capitalized
Expenses, Processing System, Packaging Equipment, Others), each with a description and a cost.
The system calculates each subtotal and a read-only Grand Total.

**Why this priority**: The total is the amount approvers authorize and the basis of the forecast.

**Independent Test**: Add lines to each group and verify the subtotals and Grand Total are
correct and update when a line changes or is deleted.

**Acceptance Scenarios**:

1. **Given** a group, **When** the Creator adds, edits, or removes lines, **Then** its subtotal
   updates immediately.
2. **Given** the Others group, **When** the Creator opens it, **Then** it is pre-filled with
   Freight, Commissioning Services, Electrical Installation, Mechanical Installation, Custom Fees,
   and Taxes, which the Creator completes with costs.
3. **Given** costs in all groups, **When** they change, **Then** the Grand Total always equals the
   sum of all costs and cannot be edited.
4. **Given** a cost line with a negative or non-numeric amount, **When** the Creator saves,
   **Then** the system rejects the value.

---

### User Story 5 - Distribute the spending forecast by month (Priority: P1)

The Creator defines how the total is spent over time, with year, month, percentage, and comments
per line. The system shows the calculated amount per line, the total calculated, and what is left,
and requires the percentages to add up to exactly 100% before the request can be submitted.

**Why this priority**: The forecast is required for submission and for financial planning.

**Independent Test**: Enter percentages that add to 90%, then 100%, and verify that submission
readiness changes and the amounts are calculated from the Grand Total.

**Acceptance Scenarios**:

1. **Given** forecast lines, **When** the Creator enters percentages, **Then** each line shows its
   amount, calculated as the percentage of the Grand Total.
2. **Given** percentages that add up to less or more than 100%, **When** the Creator tries to
   submit, **Then** the system blocks submission and shows the difference.
3. **Given** a forecast, **When** shown in the summary, **Then** Total equals the Grand Total,
   Calculated is the amount allocated, and Left is Total minus Calculated.
4. **Given** the Grand Total changes after the forecast was entered, **When** the Creator reopens
   the forecast, **Then** the amounts are recalculated from the percentages.

---

### User Story 6 - Detailed project description (Priority: P2)

The Creator writes a detailed description covering objectives, scope, expected benefits,
operational impact, and implementation details.

**Why this priority**: Gives approvers the context to decide, but is plain text.

**Independent Test**: Enter a long, multiline description and verify it is saved and shown in full.

**Acceptance Scenarios**:

1. **Given** the Project Details section, **When** the Creator enters multiline text, **Then** it
   is saved exactly as entered.
2. **Given** an empty detailed description, **When** the Creator tries to submit, **Then** the
   system blocks submission.

---

### Edge Cases

- A Creator changes the currency after entering amounts; amounts are kept as entered and only the
  currency label changes (no conversion).
- A Creator switches Supplemental / Addendum from No to Yes after entering a name and location;
  the hidden values are discarded.
- A Creator changes the category from one needing financial metrics to one that does not, after
  entering Pay Back, IRR, and NPV; the hidden values are discarded.
- The Creator has no previously submitted CEAs, so the Existing CEA Reference list is empty.
- Project in Plan = Yes and the Budgeted Amount is lower than the Grand Total: the system shows a
  visible warning but allows saving and submitting.
- A forecast has two lines for the same year and month: the system blocks it; each year/month
  can appear only once.
- A forecast month falls outside the project schedule dates: the system shows a warning but
  allows saving and submitting.
- The Grand Total is zero when the Creator tries to submit: submission is blocked.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST fill Project Manager, Location, Department, and Date automatically
  from the Creator and the current date, and these fields MUST NOT be editable.
- **FR-002**: The system MUST allow the Creator to save the request as a Draft only when all
  fields of section 1 (Requester Data) and section 2 (Project Category) of the form are
  completed; the remaining sections MAY be incomplete. The Creator MUST be able to reopen and
  edit the Draft until it is submitted.
- **FR-003**: The system MUST capture Start Date and Estimated Completion Date as calendar dates,
  and the completion date MUST NOT be earlier than the start date.
- **FR-004**: The system MUST require the Creator to answer Supplemental / Addendum (Yes or No).
- **FR-005**: When Supplemental / Addendum = Yes, the system MUST require an Existing CEA
  Reference chosen from the CEAs previously submitted by that Creator.
- **FR-006**: When Supplemental / Addendum = No, the system MUST require a Request Project Name
  and a Project Location chosen from the plant catalog.
- **FR-007**: The system MUST limit the Project Description Summary to 300 characters.
- **FR-008**: The system MUST require exactly one Project Category from: Asset Replacement,
  Capacity Requirements, Cost Savings, Disposal, Innovation, Modification of Existing Facilities,
  New Facilities, Operational Requirements, Quality Improvement, Regulatory Compliance.
- **FR-009**: The system MUST require exactly one Currency Type from: USD, EUR, GBP, UAH, CNY, AUD.
- **FR-010**: The system MUST capture Project in Plan (Yes or No) and, when Yes, a Budgeted Amount.
- **FR-011**: The system MUST capture Investment Required, Non-Capitalized Expenses for this
  Project, and Write-Off as currency amounts.
- **FR-012**: When the category is Capacity Requirements, Cost Savings, Innovation, or New
  Facilities, the system MUST require Pay Back (whole number of years), IRR (percentage), and NPV
  (currency amount), and MUST hide them for other categories.
- **FR-013**: The system MUST provide five cost groups (Modifications to Existing Building,
  Non-Capitalized Expenses, Processing System, Packaging Equipment, Others), each as a table of
  lines with a free-text description and a cost, and each with an automatically calculated
  subtotal.
- **FR-014**: The system MUST pre-fill the Others group with Freight, Commissioning Services,
  Electrical Installation, Mechanical Installation, Custom Fees, and Taxes.
- **FR-015**: The system MUST calculate a read-only Grand Total equal to the sum of all cost lines
  of all groups.
- **FR-016**: The system MUST provide a spending forecast with lines of year, month, percentage,
  and comments, and MUST show Total (Grand Total), Calculated (percentage applied to the Total),
  and Left (Total minus Calculated).
- **FR-017**: The system MUST require the forecast percentages to add up to exactly 100% before
  the request can be submitted. When a forecast month falls outside the project's Start Date to
  Estimated Completion Date range, the system MUST show a warning but MUST NOT block saving or
  submission. Each year/month MUST appear at most once in the forecast; duplicates MUST be blocked.
- **FR-018**: The system MUST capture a Detailed Project Description as multiline text.
- **FR-019**: The system MUST validate, when the Creator submits, that all required fields for the
  chosen options are complete, and MUST list each missing or invalid field. The Grand Total MUST
  be greater than zero to submit. If Project in Plan = Yes and the Budgeted Amount is lower than
  the Grand Total, the system MUST show a visible warning but MUST NOT block saving or submission.
- **FR-020**: The system MUST discard the values of fields that become hidden when the Creator
  changes Supplemental / Addendum, Project in Plan, or Project Category.
- **FR-021**: The system MUST NOT convert amounts between currencies; all amounts of a request are
  in the selected currency.

### Key Entities *(include if feature involves data)*

- **CEA Request**: The request with status Draft until submitted; includes requester data,
  schedule, supplemental status, category, currency, financial data, and project descriptions.
- **Cost Line**: A description and cost in one of the five cost groups.
- **Forecast Line**: A year, month, percentage, calculated amount, and comments.
- **Project Category**: One of the ten allowed categories, indicating whether additional
  financial metrics apply.
- **Currency**: One of the six allowed currencies.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Creator can complete and save a full request in under 20 minutes.
- **SC-002**: 100% of Grand Totals, subtotals, and forecast amounts equal the sum or percentage of
  their source values in acceptance tests.
- **SC-003**: 0 requests can be submitted with forecast percentages different from 100%.
- **SC-004**: 100% of required fields for the chosen options are validated on submission, and the
  Creator sees every missing field in one message.
- **SC-005**: 100% of Creators in acceptance tests can reopen a saved Draft with all data intact.

## Assumptions

- Submission itself, the review and approval chain, and notifications are defined in the
  Submission and Initial Review, Approval Chain, and Notifications specs; this spec defines the
  form data and its validation.
- Attachments are defined in the Attachments spec and are not part of this spec.
- Who can create and edit requests is defined in the Roles and Security spec.
- Amounts are entered by the Creator in the selected currency; currency conversion is out of
  scope.
- The plant list comes from the catalog in the Users and Master Data spec.
- Amounts and percentages accept two decimal places.
- A Budgeted Amount lower than the Grand Total is allowed and only shown as information to
  approvers.
- Each request receives a unique request identifier when first saved; the format is defined in the
  Audit and History spec.

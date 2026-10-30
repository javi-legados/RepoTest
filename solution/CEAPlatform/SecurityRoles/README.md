# Security roles (Spec 001)

Provisioned by `tools/provision-001-roles.mjs`.

## CEA Administrators
- Global Create/Read/Write/Delete on `cea_company`, `cea_region`, `cea_plant`.
- Global Create/Read/Write on users (`systemuser`) and business units.
- Read only on `cea_userchangerecord`. **No role** (including this one) is granted Create/Write/Delete on it,
  so the change history cannot be edited or deleted through the app. System Administrator keeps all
  platform privileges by design.

## Access of registered vs. unregistered identities (FR-001)
- The role is attached to the model-driven app `CEA Administration`; the app is only visible to users holding it.
- A user is "registered" when a Dataverse user record exists with the mandatory CEA fields and at least one CEA role.
- Unregistered identities receive no CEA role and therefore see no CEA app or data.
- The other roles (CEA Creators, CEA Internal Approvals, CEA Approvals) are defined in Spec 2.

## Manager registration (FR-006a)
`cea_managerregistered` is recalculated by the `UserValidation` plug-in whenever a user is created or the Manager
Email changes. It is not refreshed when the manager is registered later; the User form warning is a live check,
and Spec 2 must re-check the manager at submission time.

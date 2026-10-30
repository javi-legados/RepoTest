# Business Unit ownership (Spec 2, FR-011)

- Each user belongs to one Business Unit (Spec 1); Companies, Regions and Plants have linked BUs (`cea_level` 2/3/4) created by `CatalogBusinessUnitSync`.
- Request tables (Spec 4) must be **user/team-owned** so privilege depth (Business Unit / Parent-Child BU) applies. The owner is the Creator, so the owning BU is the Creator's BU.
- Role depth: Creators = User; Internal Approvals/Approvals = Parent-Child BU (read); Administrators = Global.
- App access (FR-012): the "CEA Administration" app is restricted to roles; users with no role or no BU have no access.

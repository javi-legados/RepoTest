# Contract: Revision Actions

| Action | Caller | Inputs | Preconditions | Effect |
|---|---|---|---|---|
| ResubmitRequest | Creator | Request, Correction Note (optional) | Returned; form validations pass; active administrator exists | Pending Revision Review; cycle row updated; notification to administrators |
| ReleaseToApproval (Revision) | Administrator | Request | Revision review Open; first approver active | Chain restarts at first applicable level with current approvers |
| ReturnToCreator (Revision) | Administrator | Request, Comments (required) | Revision review Open | Returned to Creator; notification |

Scheduled: Creator reminder after N days returned; hold when the Creator is inactive. No automatic closure.

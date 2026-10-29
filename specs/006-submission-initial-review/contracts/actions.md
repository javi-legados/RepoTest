# Contract: Actions

| Action | Caller | Inputs | Preconditions | Effect |
|---|---|---|---|---|
| SubmitRequest | Creator or Administrator | Request | Draft; Spec 4 validations pass; active administrator exists | Status = Pending Initial Review; Submitted By/On; Initial Review (Open); notification request to administrators |
| ReleaseToApproval | Administrator | Request | Review Open; first approver resolvable and active | Review Released; status = Pending Approval at first level; notification request to the approver |
| ReturnToCreator | Administrator | Request, Comments | Review Open; comments not empty | Review Returned; request editable by Creator; notification request to Creator |

Errors: validation list, no active administrator, review already closed, missing approver (names the level), empty comments.

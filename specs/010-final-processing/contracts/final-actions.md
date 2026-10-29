# Contract: Final Processing Actions

| Action | Caller | Inputs | Preconditions | Effect |
|---|---|---|---|---|
| (automatic) | Last approval | | All applicable levels approved | Status Final Processing; notification to administrators and Creator |
| AddFinalFile | Administrator | File | Final Processing; file rules; ≤ 20 final files | Stored with Package = Final |
| CorrectApprovedData | Administrator | Field edit | Final Processing | Updated; Data Correction Record written; approvals unchanged; stale edit rejected |
| CompleteRequest | Administrator | Request, Confirmation = true | Final Processing | Completed By/On; status Completed; all further changes rejected; Creator notified |

Errors: not an administrator, already completed, missing confirmation, concurrent edit conflict, invalid final file.

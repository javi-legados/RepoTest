# Connection references

| Reference | Connector | Used by | Current owner |
|---|---|---|---|
| `cea_OutlookServiceAccount` | Office 365 Outlook (`shared_office365`) | `SendPendingEmails` | Development account JGARCIAJ@gruma.com |
| `cea_DataverseInvoker` | Microsoft Dataverse (`shared_commondataserviceforapps`) | `PendingReminders`, `SendPendingEmails` | Development account JGARCIAJ@gruma.com |

## Notes
- In dev both flows use embedded connections of the developer account. Before production, create the Outlook connection under a service account (research.md R2) and rebind the references.
- The flows are solution-aware (`tools/provision-flows.mjs` creates the connection references and the flows in `CEAPlatform`; exported under `src/Workflows`). The JSON files here are the source definitions the script reads.
- Known limitations: the email stays in Pending Send in Dataverse after delivery; emails queued before the flow existed are not resent.

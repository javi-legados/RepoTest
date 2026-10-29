# Contract: Attachment Rules

| Rule | Result |
|---|---|
| File > 25 MB | Rejected with reason |
| Type not in PDF, Word, Excel, PowerPoint, JPG, PNG, CSV, TXT, ZIP, DWG, DXF | Rejected with reason |
| Same name as existing attachment | Rejected; rename or remove first |
| More than 20 files | Extra files rejected |
| Batch with invalid and valid files | Valid files attach |
| Creator add/remove | Only Draft or Rejected |
| Administrator add | Any status; shows administrator as uploader |
| Approver / read-only add or remove | Not available and denied server-side |
| View/download | Any user who can see the request |
| Draft deleted | Attachments deleted |

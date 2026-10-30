import { readFileSync } from 'node:fs';
import { dv } from './dv.mjs';

const refs = [
  { logical: 'cea_OutlookServiceAccount', display: 'CEA Outlook Service Account', connector: 'shared_office365', connection: 'shared-office365-374fd49c-a671-457c-818b-45fe449d6c08' },
  { logical: 'cea_DataverseInvoker', display: 'CEA Dataverse', connector: 'shared_commondataserviceforapps', connection: 'shared-commondataser-db59ba09-4ba2-4793-afa1-388336c511b1' },
];
for (const r of refs) {
  const ex = await dv('GET', `connectionreferences?$filter=connectionreferencelogicalname eq '${r.logical}'&$select=connectionreferenceid`);
  const body = {
    connectionreferencelogicalname: r.logical,
    connectionreferencedisplayname: r.display,
    connectorid: `/providers/Microsoft.PowerApps/apis/${r.connector}`,
    connectionid: r.connection,
  };
  if (ex.value.length) { await dv('PATCH', `connectionreferences(${ex.value[0].connectionreferenceid})`, { connectionid: r.connection }); console.log('ref updated', r.logical); }
  else { await dv('POST', 'connectionreferences', body); console.log('ref created', r.logical); }
}

const flows = [
  { file: 'PendingReminders.json', logicals: { shared_commondataserviceforapps: 'cea_DataverseInvoker' } },
  { file: 'SendPendingEmails.json', logicals: { shared_commondataserviceforapps: 'cea_DataverseInvoker', shared_office365: 'cea_OutlookServiceAccount' } },
];
for (const f of flows) {
  const j = JSON.parse(readFileSync(`solution/CEAPlatform/Flows/${f.file}`, 'utf8'));
  const connectionReferences = {};
  for (const [api, logical] of Object.entries(f.logicals))
    connectionReferences[api] = { runtimeSource: 'embedded', connection: { connectionReferenceLogicalName: logical }, api: { name: api } };
  const clientdata = JSON.stringify({ properties: { connectionReferences, definition: j.definition }, schemaVersion: '1.0.0.0' });
  const ex = await dv('GET', `workflows?$filter=name eq '${j.displayName}' and category eq 5&$select=workflowid`);
  let id;
  if (ex.value.length) { id = ex.value[0].workflowid; await dv('PATCH', `workflows(${id})`, { clientdata }); }
  else {
    const c = await dv('POST', 'workflows', { name: j.displayName, type: 1, category: 5, primaryentity: 'none', businessprocesstype: 0, scope: 4, clientdata }, { Prefer: 'return=representation' });
    id = c.workflowid;
  }
  console.log('flow', j.displayName, id);
  await dv('PATCH', `workflows(${id})`, { statecode: 1, statuscode: 2 });
  console.log('activated');
}

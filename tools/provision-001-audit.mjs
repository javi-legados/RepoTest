// T018: native Dataverse auditing on systemuser (tracked CEA columns) as a second audit source. Idempotent.
import { dv } from './dv.mjs';

const org = (await dv('GET', 'organizations?$select=organizationid,isauditenabled')).value[0];
if (!org.isauditenabled) await dv('PATCH', `organizations(${org.organizationid})`, { isauditenabled: true });
console.log('org audit enabled');

const ent = await dv('GET', `EntityDefinitions(LogicalName='systemuser')?$select=MetadataId,IsAuditEnabled`);
if (!ent.IsAuditEnabled.Value) {
  await dv('PUT', `EntityDefinitions(LogicalName='systemuser')`, { ...(await dv('GET', `EntityDefinitions(LogicalName='systemuser')`)), IsAuditEnabled: { Value: true, CanBeChanged: true } }, { 'MSCRM.MergeLabels': 'true' });
}
console.log('systemuser audit enabled');

for (const a of ['cea_sapnumber', 'cea_department', 'cea_managername', 'cea_manageremail', 'cea_managerregistered', 'businessunitid', 'internalemailaddress', 'lastname']) {
  try {
    const cur = await dv('GET', `EntityDefinitions(LogicalName='systemuser')/Attributes(LogicalName='${a}')`);
    if (cur.IsAuditEnabled && cur.IsAuditEnabled.Value) continue;
    await dv('PUT', `EntityDefinitions(LogicalName='systemuser')/Attributes(LogicalName='${a}')`,
      { ...cur, IsAuditEnabled: { Value: true, CanBeChanged: true } }, { 'MSCRM.MergeLabels': 'true' });
    console.log('+ audit', a);
  } catch (e) { console.log('! audit', a, e.message.slice(0, 200)); }
}
await dv('POST', 'PublishAllXml', {});

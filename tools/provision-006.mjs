// Spec 006 foundational provisioning (T003-T007). Idempotent.
import { dv, ensureTable, ensureLookup, stringAttr, choiceAttr, dateAttr, memoAttr } from './dv.mjs';

const lbl = (t) => ({ '@odata.type': 'Microsoft.Dynamics.CRM.Label', LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: t, LanguageCode: 1033 }] });
const levels = [[1, 'Direct Manager'], [2, 'Plant Manager'], [3, 'Regional Approver']];

// New status value (T004)
const st = await dv('GET', `EntityDefinitions(LogicalName='cea_request')/Attributes(LogicalName='cea_status')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options)`);
if (!st.OptionSet.Options.find((o) => o.Value === 9)) {
  await dv('POST', 'InsertOptionValue', { AttributeLogicalName: 'cea_status', EntityLogicalName: 'cea_request', Value: 9, Label: lbl('Returned to Creator') });
  console.log('+ status Returned to Creator = 9');
}

// Request additions (T003)
const add = async (attr) => { await import('./dv.mjs').then((m) => m.ensureAttribute('cea_request', attr)); };
await add(dateAttr('cea_SubmittedOn', 'Submitted On'));
await add(dateAttr('cea_StatusChangedOn', 'Status Changed On'));
await add(choiceAttr('cea_CurrentLevel', 'Current Level', levels));
await ensureLookup('cea_request', 'systemuser', 'cea_submittedby_request', 'cea_SubmittedById', 'Submitted By');

// Initial Review (T005)
await ensureTable({
  SchemaName: 'cea_initialreview', display: 'Initial Review', plural: 'Initial Reviews',
  primary: { schema: 'cea_Name', display: 'Name', max: 200 }, ownership: 'UserOwned', audit: true,
}, [
  choiceAttr('cea_State', 'State', [[1, 'Open'], [2, 'Released'], [3, 'Returned']], { required: true }),
  choiceAttr('cea_Outcome', 'Outcome', [[1, 'Released'], [2, 'Returned']]),
  dateAttr('cea_ReviewedOn', 'Reviewed On'),
  memoAttr('cea_Comments', 'Comments', { max: 4000 }),
]);
await ensureLookup('cea_initialreview', 'cea_request', 'cea_request_initialreview', 'cea_RequestId', 'Request', { required: true });
await ensureLookup('cea_initialreview', 'systemuser', 'cea_reviewedby_initialreview', 'cea_ReviewedById', 'Reviewed By');
const rel = await dv('GET', `RelationshipDefinitions(SchemaName='cea_request_initialreview')`);
if (rel.CascadeConfiguration.Delete !== 'Cascade') {
  rel.CascadeConfiguration.Delete = 'Cascade';
  await dv('PUT', `RelationshipDefinitions(${rel.MetadataId})`, rel, { 'MSCRM.MergeLabels': 'true' });
}

// Roles (T006, T007): nobody can write reviews directly; actions write them as the system.
const root = (await dv('GET', 'businessunits?$select=businessunitid&$filter=parentbusinessunitid eq null')).value[0];
async function grant(roleName, entity, verbs, depth) {
  const role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${roleName}' and parentroleid eq null`)).value[0];
  const names = verbs.map((v) => `prv${v}${entity}`);
  const found = (await dv('GET', `privileges?$select=privilegeid,name&$filter=${names.map((n) => `name eq '${n}'`).join(' or ')}`)).value;
  await dv('POST', `roles(${role.roleid})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, { Privileges: found.map((p) => ({ PrivilegeId: p.privilegeid, Depth: depth, BusinessUnitId: root.businessunitid })) });
  console.log('~ role', roleName, found.length);
}
await grant('CEA Creators', 'cea_initialreview', ['Read'], 'Basic');
await grant('CEA Administrators', 'cea_initialreview', ['Read'], 'Global');
for (const r of ['CEA Internal Approvals', 'CEA Approvals']) await grant(r, 'cea_initialreview', ['Read'], 'Deep');
await dv('POST', 'PublishAllXml', {});
console.log('done');

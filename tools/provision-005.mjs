// Spec 005 foundational provisioning (T004-T007, T018, T022). Idempotent.
import { dv, ensureTable, ensureLookup, stringAttr, choiceAttr, dateAttr, intAttr } from './dv.mjs';

await ensureTable({
  SchemaName: 'cea_requestattachment', display: 'Request Attachment', plural: 'Request Attachments',
  primary: { schema: 'cea_FileName', display: 'File Name', max: 255 }, ownership: 'UserOwned',
}, [
  {
    '@odata.type': 'Microsoft.Dynamics.CRM.FileAttributeMetadata', SchemaName: 'cea_File',
    DisplayName: { '@odata.type': 'Microsoft.Dynamics.CRM.Label', LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: 'File', LanguageCode: 1033 }] },
    RequiredLevel: { Value: 'None', CanBeChanged: true }, MaxSizeInKB: 25600,
  },
  intAttr('cea_Size', 'Size (bytes)', { max: 2147483647 }),
  stringAttr('cea_Type', 'Type', { max: 20 }),
  dateAttr('cea_UploadedOn', 'Uploaded On'),
  choiceAttr('cea_Package', 'Package', [[1, 'Request'], [2, 'Final']], { required: false }),
]);
await ensureLookup('cea_requestattachment', 'cea_request', 'cea_request_attachment', 'cea_RequestId', 'Request', { required: true });
await ensureLookup('cea_requestattachment', 'systemuser', 'cea_systemuser_attachment', 'cea_UploadedById', 'Uploaded By');

const rel = await dv('GET', `RelationshipDefinitions(SchemaName='cea_request_attachment')`);
if (rel.CascadeConfiguration.Delete !== 'Cascade') {
  rel.CascadeConfiguration.Delete = 'Cascade';
  await dv('PUT', `RelationshipDefinitions(${rel.MetadataId})`, rel, { 'MSCRM.MergeLabels': 'true' });
  console.log('~ cascade delete');
}

const root = (await dv('GET', 'businessunits?$select=businessunitid&$filter=parentbusinessunitid eq null')).value[0];
async function grant(roleName, entity, verbs, depth) {
  const role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${roleName}' and parentroleid eq null`)).value[0];
  const names = verbs.map((v) => `prv${v}${entity}`);
  const found = (await dv('GET', `privileges?$select=privilegeid,name&$filter=${names.map((n) => `name eq '${n}'`).join(' or ')}`)).value;
  await dv('POST', `roles(${role.roleid})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, {
    Privileges: found.map((p) => ({ PrivilegeId: p.privilegeid, Depth: depth, BusinessUnitId: root.businessunitid })),
  });
  console.log('~ role', roleName, found.length);
}
const E = 'cea_requestattachment';
await grant('CEA Creators', E, ['Create', 'Read', 'Delete', 'Append', 'AppendTo'], 'Basic');
await grant('CEA Administrators', E, ['Create', 'Read', 'Append', 'AppendTo'], 'Global');
for (const r of ['CEA Internal Approvals', 'CEA Approvals']) await grant(r, E, ['Read'], 'Deep');
await dv('POST', 'PublishAllXml', {});
console.log('done');

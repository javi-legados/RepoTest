// Spec 008 provisioning: revision cycles, review type, CreatorReminderDays and cea_ResubmitRequest. Idempotent. Run after register-plugins.mjs.
import { dv, ensureTable, ensureLookup, ensureAttribute, boolAttr, choiceAttr, dateAttr, memoAttr, intAttr, SOLUTION } from './dv.mjs';

await ensureAttribute('cea_initialreview', choiceAttr('cea_ReviewType', 'Review Type', [[1, 'Initial'], [2, 'Revision']]));
await ensureTable({
  SchemaName: 'cea_revisioncycle', display: 'Revision Cycle', plural: 'Revision Cycles',
  primary: { schema: 'cea_Name', display: 'Name', max: 200 }, ownership: 'UserOwned', audit: true,
}, [
  intAttr('cea_Cycle', 'Cycle', { min: 1, max: 999 }),
  memoAttr('cea_RejectionComments', 'Rejection Comments', { max: 4000 }),
  dateAttr('cea_RejectedOn', 'Rejected On'),
  dateAttr('cea_ResubmittedOn', 'Resubmitted On'),
  memoAttr('cea_CorrectionNote', 'Correction Note', { max: 4000 }),
  choiceAttr('cea_ReviewOutcome', 'Review Outcome', [[1, 'Released'], [2, 'Returned']]),
]);
await ensureLookup('cea_revisioncycle', 'cea_request', 'cea_request_revisioncycle', 'cea_RequestId', 'Request', { required: true });
await ensureLookup('cea_revisioncycle', 'systemuser', 'cea_rejectedby_revisioncycle', 'cea_RejectedById', 'Rejected By');
await ensureLookup('cea_revisioncycle', 'systemuser', 'cea_reviewedby_revisioncycle', 'cea_ReviewedById', 'Reviewed By');
const rel = await dv('GET', `RelationshipDefinitions(SchemaName='cea_request_revisioncycle')`);
if (rel.CascadeConfiguration.Delete !== 'Cascade') {
  rel.CascadeConfiguration.Delete = 'Cascade';
  await dv('PUT', `RelationshipDefinitions(${rel.MetadataId})`, rel, { 'MSCRM.MergeLabels': 'true' });
}

const root = (await dv('GET', 'businessunits?$select=businessunitid&$filter=parentbusinessunitid eq null')).value[0];
async function grant(roleName, entity, verbs, depth) {
  const role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${roleName}' and parentroleid eq null`)).value[0];
  const names = verbs.map((v) => `prv${v}${entity}`);
  const found = (await dv('GET', `privileges?$select=privilegeid,name&$filter=${names.map((n) => `name eq '${n}'`).join(' or ')}`)).value;
  await dv('POST', `roles(${role.roleid})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, { Privileges: found.map((p) => ({ PrivilegeId: p.privilegeid, Depth: depth, BusinessUnitId: root.businessunitid })) });
  console.log('~ role', roleName, entity, found.length);
}
// Append-only: no role gets Write/Delete; the actions write the rows as the system.
await grant('CEA Creators', 'cea_revisioncycle', ['Read'], 'Basic');
await grant('CEA Administrators', 'cea_revisioncycle', ['Read'], 'Global');
for (const r of ['CEA Internal Approvals', 'CEA Approvals']) await grant(r, 'cea_revisioncycle', ['Read'], 'Deep');

const seed = await dv('GET', `cea_platformsettings?$select=cea_platformsettingid&$filter=cea_name eq 'CreatorReminderDays'`);
if (!seed.value.length) await dv('POST', 'cea_platformsettings', { cea_name: 'CreatorReminderDays', cea_value: '5' });

const H = { 'MSCRM.SolutionUniqueName': SOLUTION };
const name = 'cea_ResubmitRequest';
const t = (await dv('GET', `plugintypes?$select=plugintypeid&$filter=typename eq 'CEAPlatform.Plugins.ResubmitRequest'`)).value[0];
if (!t) throw new Error('register the plug-in type first');
let api = (await dv('GET', `customapis?$select=customapiid&$filter=uniquename eq '${name}'`)).value[0];
if (!api) {
  await dv('POST', 'customapis', { uniquename: name, name: 'Resubmit Request', displayname: 'Resubmit Request', description: 'Resubmit Request', bindingtype: 0, isfunction: false, isprivate: false, allowedcustomprocessingsteptype: 0, 'PluginTypeId@odata.bind': `/plugintypes(${t.plugintypeid})` }, H);
  api = (await dv('GET', `customapis?$select=customapiid&$filter=uniquename eq '${name}'`)).value[0];
  console.log('+ api', name);
}
const bind = `/customapis(${api.customapiid})`;
for (const [p, type_, ent] of [['Request', 5, 'cea_request'], ['CorrectionNote', 10, null]]) {
  if ((await dv('GET', `customapirequestparameters?$select=customapirequestparameterid&$filter=uniquename eq '${p}' and _customapiid_value eq ${api.customapiid}`)).value.length) continue;
  await dv('POST', 'customapirequestparameters', { uniquename: p, name: p, displayname: p, description: p, type: type_, isoptional: p !== 'Request', ...(ent ? { logicalentityname: ent } : {}), 'CustomAPIId@odata.bind': bind }, H);
}
if (!(await dv('GET', `customapiresponseproperties?$select=customapiresponsepropertyid&$filter=uniquename eq 'Result' and _customapiid_value eq ${api.customapiid}`)).value.length)
  await dv('POST', 'customapiresponseproperties', { uniquename: 'Result', name: 'Result', displayname: 'Result', description: 'Result', type: 10, 'CustomAPIId@odata.bind': bind }, H);
await dv('POST', 'PublishAllXml', {});
console.log('done');

// Spec 011 provisioning: cea_historyentry, cea_administrativeauditentry, security, views. Idempotent. Run provision-004-forms.mjs afterwards for the History tab.
import { dv, ensureTable, ensureLookup, stringAttr, choiceAttr, dateAttr, memoAttr, intAttr, SOLUTION } from './dv.mjs';

const events = [[1, 'Created'], [2, 'Submitted'], [3, 'Review Released'], [4, 'Review Returned'], [5, 'Approved'], [6, 'Rejected'], [7, 'Skipped'], [8, 'Resubmitted'], [9, 'Reassigned'],
  [10, 'Field Changed'], [11, 'Attachment Added'], [12, 'Attachment Removed'], [13, 'Data Corrected'], [14, 'Notification Outcome'], [15, 'Hold'], [16, 'Resume'], [17, 'Completed']];
await ensureTable({ SchemaName: 'cea_historyentry', display: 'History Entry', plural: 'History Entries', primary: { schema: 'cea_Name', display: 'Name', max: 200 }, ownership: 'UserOwned' }, [
  choiceAttr('cea_EventType', 'Event Type', events, { required: true }),
  stringAttr('cea_ActorName', 'Actor Name', { max: 200 }),
  dateAttr('cea_OccurredOn', 'Occurred On'),
  stringAttr('cea_Field', 'Field', { max: 200 }),
  stringAttr('cea_OldValue', 'Old Value', { max: 500 }),
  stringAttr('cea_NewValue', 'New Value', { max: 500 }),
  memoAttr('cea_Comments', 'Comments', { max: 4000 }),
  intAttr('cea_Cycle', 'Cycle', { min: 0, max: 999 }),
]);
await ensureTable({ SchemaName: 'cea_administrativeauditentry', display: 'Administrative Audit Entry', plural: 'Administrative Audit Entries', primary: { schema: 'cea_Name', display: 'Name', max: 200 }, ownership: 'OrganizationOwned' }, [
  choiceAttr('cea_EventType', 'Event Type', [[1, 'Role Changed'], [2, 'Approver Assignment Changed'], [3, 'Email Failure'], [4, 'Release Blocked'], [5, 'Other']], { required: true }),
  stringAttr('cea_ActorName', 'Actor Name', { max: 200 }),
  dateAttr('cea_OccurredOn', 'Occurred On'),
  memoAttr('cea_OldValue', 'Old Value', { max: 1000 }),
  memoAttr('cea_NewValue', 'New Value', { max: 1000 }),
  memoAttr('cea_Reason', 'Reason', { max: 2000 }),
]);
await ensureLookup('cea_historyentry', 'cea_request', 'cea_request_historyentry', 'cea_RequestId', 'Request', { required: true });
await ensureLookup('cea_historyentry', 'systemuser', 'cea_actor_historyentry', 'cea_ActorId', 'Actor');
await ensureLookup('cea_administrativeauditentry', 'systemuser', 'cea_actor_adminauditentry', 'cea_ActorId', 'Actor');
const rel = await dv('GET', "RelationshipDefinitions(SchemaName='cea_request_historyentry')");
if (rel.CascadeConfiguration.Delete !== 'Cascade') { rel.CascadeConfiguration.Delete = 'Cascade'; await dv('PUT', `RelationshipDefinitions(${rel.MetadataId})`, rel, { 'MSCRM.MergeLabels': 'true' }); }

const root = (await dv('GET', 'businessunits?$select=businessunitid&$filter=parentbusinessunitid eq null')).value[0];
async function grant(roleName, entity, verbs, depth) {
  const role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${roleName}' and parentroleid eq null`)).value[0];
  const names = verbs.map((v) => `prv${v}${entity}`);
  const found = (await dv('GET', `privileges?$select=privilegeid,name&$filter=${names.map((n) => `name eq '${n}'`).join(' or ')}`)).value;
  await dv('POST', `roles(${role.roleid})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, { Privileges: found.map((p) => ({ PrivilegeId: p.privilegeid, Depth: depth, BusinessUnitId: root.businessunitid })) });
  console.log('~ role', roleName, entity, found.length);
}
// Read only: entries are written by the plug-ins as the system.
await grant('CEA Creators', 'cea_historyentry', ['Read'], 'Basic');
await grant('CEA Administrators', 'cea_historyentry', ['Read'], 'Global');
for (const r of ['CEA Internal Approvals', 'CEA Approvals']) await grant(r, 'cea_historyentry', ['Read'], 'Deep');
await grant('CEA Administrators', 'cea_administrativeauditentry', ['Read'], 'Global');

const vw = async (entity, vname, cols, order) => {
  const fetchxml = `<fetch version="1.0" mapping="logical"><entity name="${entity}">${cols.map((c) => `<attribute name="${c[0]}"/>`).join('')}<order attribute="${order}" descending="true"/></entity></fetch>`;
  const layoutxml = `<grid name="resultset" object="0" jump="${cols[0][0]}" select="1" icon="1" preview="1"><row name="result" id="${entity}id">${cols.map((c) => `<cell name="${c[0]}" width="${c[1]}"/>`).join('')}</row></grid>`;
  const q = (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${vname}' and returnedtypecode eq '${entity}'`)).value[0];
  if (q) await dv('PATCH', `savedqueries(${q.savedqueryid})`, { fetchxml, layoutxml });
  else await dv('POST', 'savedqueries', { name: vname, returnedtypecode: entity, querytype: 0, fetchxml, layoutxml, isdefault: false });
  return (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${vname}' and returnedtypecode eq '${entity}'`)).value[0].savedqueryid;
};
const v1 = await vw('cea_administrativeauditentry', 'Administrative Audit', [['cea_eventtype', 170], ['cea_actorname', 150], ['cea_occurredon', 130], ['cea_oldvalue', 250], ['cea_newvalue', 250], ['cea_reason', 250]], 'cea_occurredon');
const v2 = await vw('cea_historyentry', 'All History', [['cea_occurredon', 130], ['cea_requestid', 150], ['cea_eventtype', 150], ['cea_actorname', 150], ['cea_field', 180], ['cea_oldvalue', 150], ['cea_newvalue', 150]], 'cea_occurredon');
const app = (await dv('GET', "appmodules?$select=appmoduleid&$filter=uniquename eq 'cea_ceaadmin'", null, { 'MSCRM.IncludeUnpublished': 'true' })).value[0];
const comps = [];
for (const e of ['cea_historyentry', 'cea_administrativeauditentry']) comps.push({ '@odata.type': 'Microsoft.Dynamics.CRM.entity', entityid: (await dv('GET', `EntityDefinitions(LogicalName='${e}')?$select=MetadataId`)).MetadataId });
for (const id of [v1, v2]) comps.push({ '@odata.type': 'Microsoft.Dynamics.CRM.savedquery', savedqueryid: id });
await dv('POST', 'AddAppComponents', { AppId: app.appmoduleid, Components: comps }, { 'MSCRM.SolutionUniqueName': SOLUTION });
const sm = (await dv('GET', "sitemaps?$select=sitemapid&$filter=sitemapnameunique eq 'cea_ceaadmin'")).value[0];
const cur = (await dv('GET', `sitemaps(${sm.sitemapid})?$select=sitemapxml`)).sitemapxml;
let xml = cur;
for (const [id, ent, title] of [['sa_adminaudit', 'cea_administrativeauditentry', 'Administrative Audit'], ['sa_allhistory', 'cea_historyentry', 'All History']])
  if (!xml.includes(`Id="${id}"`)) xml = xml.replace('</Group></Area>', `<SubArea Id="${id}" Entity="${ent}" Title="${title}"/></Group></Area>`);
if (xml !== cur) await dv('PATCH', `sitemaps(${sm.sitemapid})`, { sitemapxml: xml });
await dv('POST', 'PublishAllXml', {});
console.log('done');

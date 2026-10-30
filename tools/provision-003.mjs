// Spec 003 foundational provisioning (T003-T009, T013, T014). Idempotent.
import { dv, ensureTable, ensureLookup, stringAttr, boolAttr, choiceAttr, dateAttr, SOLUTION } from './dv.mjs';

const levels = [[1, 'Direct Manager'], [2, 'Plant Manager'], [3, 'Regional Approver']];

await ensureTable({
  SchemaName: 'cea_approverassignment', display: 'Approver Assignment', plural: 'Approver Assignments',
  primary: { schema: 'cea_Name', display: 'Name', max: 300 }, ownership: 'OrganizationOwned', audit: true,
}, [
  choiceAttr('cea_RoleType', 'Role Type', [[1, 'Plant Manager'], [2, 'Regional Approver']], { required: true }),
  choiceAttr('cea_Status', 'State', [[1, 'Active'], [2, 'Inactive']], { required: true }),
]);
await ensureLookup('cea_approverassignment', 'businessunit', 'cea_bu_approverassignment', 'cea_BusinessUnitId', 'Business Unit', { required: true });
await ensureLookup('cea_approverassignment', 'systemuser', 'cea_approver_approverassignment', 'cea_ApproverId', 'Approver', { required: true });

await ensureTable({
  SchemaName: 'cea_resolvedapprover', display: 'Resolved Approver', plural: 'Resolved Approvers',
  primary: { schema: 'cea_Name', display: 'Name', max: 300 }, ownership: 'UserOwned',
}, [
  stringAttr('cea_RequestReference', 'Request Reference', { max: 100 }),
  choiceAttr('cea_Level', 'Level', levels, { required: true }),
  boolAttr('cea_Decided', 'Decided', false),
  boolAttr('cea_Skipped', 'Skipped', false),
  boolAttr('cea_NeedsReassignment', 'Needs Reassignment', false),
]);
await ensureLookup('cea_resolvedapprover', 'systemuser', 'cea_approver_resolvedapprover', 'cea_ApproverId', 'Approver');

await ensureTable({
  SchemaName: 'cea_reassignmentrecord', display: 'Reassignment Record', plural: 'Reassignment Records',
  primary: { schema: 'cea_Name', display: 'Summary', max: 300 }, ownership: 'OrganizationOwned',
}, [
  stringAttr('cea_RequestReference', 'Request Reference', { max: 100 }),
  choiceAttr('cea_Level', 'Level', levels, { required: true }),
  stringAttr('cea_Reason', 'Reason', { required: true, max: 1000 }),
  dateAttr('cea_ChangedOn', 'Changed On', { required: true }),
]);
await ensureLookup('cea_reassignmentrecord', 'systemuser', 'cea_prev_reassignmentrecord', 'cea_PreviousApproverId', 'Previous Approver');
await ensureLookup('cea_reassignmentrecord', 'systemuser', 'cea_new_reassignmentrecord', 'cea_NewApproverId', 'New Approver');
await ensureLookup('cea_reassignmentrecord', 'systemuser', 'cea_changedby_reassignmentrecord', 'cea_ChangedById', 'Changed By');

// Roles (T008)
const root = (await dv('GET', 'businessunits?$select=businessunitid&$filter=parentbusinessunitid eq null')).value[0];
async function grant(roleName, entries) {
  const role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${roleName}' and parentroleid eq null`)).value[0];
  const wanted = [];
  for (const [entity, verbs, depth] of entries) for (const v of verbs) wanted.push({ n: `prv${v}${entity}`, depth });
  const found = (await dv('GET', `privileges?$select=privilegeid,name&$filter=${wanted.map((w) => `name eq '${w.n}'`).join(' or ')}`)).value;
  const list = wanted.filter((w) => found.find((p) => p.name === w.n)).map((w) => ({
    PrivilegeId: found.find((p) => p.name === w.n).privilegeid, Depth: w.depth, BusinessUnitId: root.businessunitid,
  }));
  const missing = wanted.filter((w) => !found.find((p) => p.name === w.n)).map((w) => w.n);
  if (missing.length) console.log('  missing privileges:', missing.join(', '));
  await dv('POST', `roles(${role.roleid})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, { Privileges: list });
  console.log('~ role', roleName);
}
await grant('CEA Administrators', [
  ['cea_approverassignment', ['Create', 'Read', 'Write', 'Delete', 'Append', 'AppendTo'], 'Global'],
  ['cea_resolvedapprover', ['Read', 'Write', 'AppendTo'], 'Global'],
  ['cea_reassignmentrecord', ['Create', 'Read', 'Append', 'AppendTo'], 'Global'],
]);
for (const r of ['CEA Creators', 'CEA Internal Approvals', 'CEA Approvals']) {
  await grant(r, [['cea_resolvedapprover', ['Read', 'AppendTo'], 'Basic']]);
}

// Views (T013)
async function ensureView(name, entity, pk, cols, order, filter = '') {
  const fetchxml = `<fetch version="1.0" mapping="logical"><entity name="${entity}">${cols.map((c) => `<attribute name="${c[0]}"/>`).join('')}<attribute name="${pk}"/><order attribute="${order}" descending="false"/>${filter}</entity></fetch>`;
  const layoutxml = `<grid name="resultset" object="0" jump="${cols[0][0]}" select="1" icon="1" preview="1"><row name="result" id="${pk}">${cols.map((c) => `<cell name="${c[0]}" width="${c[1]}"/>`).join('')}</row></grid>`;
  let q = (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${name}' and returnedtypecode eq '${entity}'`)).value[0];
  if (q) await dv('PATCH', `savedqueries(${q.savedqueryid})`, { fetchxml, layoutxml });
  else await dv('POST', 'savedqueries', { name, returnedtypecode: entity, querytype: 0, fetchxml, layoutxml, isdefault: false });
  return (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${name}' and returnedtypecode eq '${entity}'`)).value[0].savedqueryid;
}
const vAssign = await ensureView('All Approver Assignments', 'cea_approverassignment', 'cea_approverassignmentid',
  [['cea_businessunitid', 220], ['cea_roletype', 140], ['cea_approverid', 220], ['cea_status', 100]], 'cea_businessunitid');
const vReass = await ensureView('All Reassignment Records', 'cea_reassignmentrecord', 'cea_reassignmentrecordid',
  [['cea_changedon', 160], ['cea_requestreference', 140], ['cea_level', 130], ['cea_previousapproverid', 200], ['cea_newapproverid', 200], ['cea_reason', 260], ['cea_changedbyid', 180]], 'cea_changedon');
const vPending = await ensureView('Requests Needing Reassignment', 'cea_resolvedapprover', 'cea_resolvedapproverid',
  [['cea_requestreference', 140], ['cea_level', 130], ['cea_approverid', 220]], 'cea_requestreference',
  '<filter type="and"><condition attribute="cea_needsreassignment" operator="eq" value="1"/><condition attribute="cea_decided" operator="eq" value="0"/></filter>');
await ensureView('Business Units without approver (Plants)', 'businessunit', 'businessunitid', [['name', 240], ['cea_level', 100]], 'name',
  '<filter type="and"><condition attribute="cea_level" operator="eq" value="4"/></filter>');

// App + sitemap (T009)
const app = (await dv('GET', `appmodules?$select=appmoduleid&$filter=uniquename eq 'cea_ceaadmin'`, null, { 'MSCRM.IncludeUnpublished': 'true' })).value[0];
const comps = [];
for (const e of ['cea_approverassignment', 'cea_resolvedapprover', 'cea_reassignmentrecord']) {
  const md = await dv('GET', `EntityDefinitions(LogicalName='${e}')?$select=MetadataId`);
  comps.push({ '@odata.type': 'Microsoft.Dynamics.CRM.entity', entityid: md.MetadataId });
}
for (const id of [vAssign, vReass, vPending]) comps.push({ '@odata.type': 'Microsoft.Dynamics.CRM.savedquery', savedqueryid: id });
await dv('POST', 'AddAppComponents', { AppId: app.appmoduleid, Components: comps }, { 'MSCRM.SolutionUniqueName': SOLUTION });
const sm = (await dv('GET', `sitemaps?$select=sitemapid,sitemapxml&$filter=sitemapnameunique eq 'cea_ceaadmin'`)).value[0];
if (!sm.sitemapxml.includes('cea_approverassignment')) {
  const subs = '<SubArea Id="sa_approvers" Entity="cea_approverassignment" Title="Approver Assignments"/>' +
    '<SubArea Id="sa_reassign" Entity="cea_reassignmentrecord" Title="Reassignment Records"/>' +
    '<SubArea Id="sa_resolved" Entity="cea_resolvedapprover" Title="Resolved Approvers"/>';
  await dv('PATCH', `sitemaps(${sm.sitemapid})`, { sitemapxml: sm.sitemapxml.replace('</Group></Area>', subs + '</Group></Area>') });
}
await dv('POST', 'PublishAllXml');
console.log('done');

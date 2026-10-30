// Spec 010 provisioning: Final Processing status, completion columns, cea_datacorrectionrecord, cea_CompleteRequest, views. Idempotent. Run after register-plugins.mjs.
import { dv, ensureTable, ensureLookup, ensureAttribute, stringAttr, dateAttr, SOLUTION } from './dv.mjs';

const H = { 'MSCRM.SolutionUniqueName': SOLUTION };
const attr = await dv('GET', "EntityDefinitions(LogicalName='cea_request')/Attributes(LogicalName='cea_status')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options)");
if (!attr.OptionSet.Options.some((o) => o.Value === 10)) {
  await dv('POST', 'InsertOptionValue', { EntityLogicalName: 'cea_request', AttributeLogicalName: 'cea_status', Value: 10, Label: { LocalizedLabels: [{ Label: 'Final Processing', LanguageCode: 1033 }] } });
  console.log('+ status 10 Final Processing');
}
await ensureAttribute('cea_request', dateAttr('cea_CompletedOn', 'Completed On'));
await ensureLookup('cea_request', 'systemuser', 'cea_completedby_request', 'cea_CompletedById', 'Completed By');

await ensureTable({ SchemaName: 'cea_datacorrectionrecord', display: 'Data Correction Record', plural: 'Data Correction Records', primary: { schema: 'cea_Name', display: 'Name', max: 200 }, ownership: 'OrganizationOwned' }, [
  stringAttr('cea_Field', 'Table / Field', { max: 200 }),
  stringAttr('cea_OldValue', 'Old Value', { max: 500 }),
  stringAttr('cea_NewValue', 'New Value', { max: 500 }),
  dateAttr('cea_ChangedOn', 'Changed On'),
]);
await ensureLookup('cea_datacorrectionrecord', 'cea_request', 'cea_request_datacorrectionrecord', 'cea_RequestId', 'Request', { required: true });
await ensureLookup('cea_datacorrectionrecord', 'systemuser', 'cea_changedby_datacorrectionrecord', 'cea_ChangedById', 'Changed By');
const rel = await dv('GET', "RelationshipDefinitions(SchemaName='cea_request_datacorrectionrecord')");
if (rel.CascadeConfiguration.Delete !== 'Cascade') { rel.CascadeConfiguration.Delete = 'Cascade'; await dv('PUT', `RelationshipDefinitions(${rel.MetadataId})`, rel, { 'MSCRM.MergeLabels': 'true' }); }

const root = (await dv('GET', 'businessunits?$select=businessunitid&$filter=parentbusinessunitid eq null')).value[0];
async function grant(roleName, entity, verbs, depth) {
  const role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${roleName}' and parentroleid eq null`)).value[0];
  const names = verbs.map((v) => `prv${v}${entity}`);
  const found = (await dv('GET', `privileges?$select=privilegeid,name&$filter=${names.map((n) => `name eq '${n}'`).join(' or ')}`)).value;
  await dv('POST', `roles(${role.roleid})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, { Privileges: found.map((p) => ({ PrivilegeId: p.privilegeid, Depth: depth, BusinessUnitId: root.businessunitid })) });
  console.log('~ role', roleName, entity, found.length);
}
await grant('CEA Administrators', 'cea_datacorrectionrecord', ['Read'], 'Global');

const name = 'cea_CompleteRequest';
const t = (await dv('GET', "plugintypes?$select=plugintypeid&$filter=typename eq 'CEAPlatform.Plugins.CompleteRequest'")).value[0];
if (!t) throw new Error('register the plug-in type first');
let api = (await dv('GET', `customapis?$select=customapiid&$filter=uniquename eq '${name}'`)).value[0];
if (!api) {
  await dv('POST', 'customapis', { uniquename: name, name: 'Complete Request', displayname: 'Complete Request', description: 'Complete Request', bindingtype: 0, isfunction: false, isprivate: false, allowedcustomprocessingsteptype: 0, 'PluginTypeId@odata.bind': `/plugintypes(${t.plugintypeid})` }, H);
  api = (await dv('GET', `customapis?$select=customapiid&$filter=uniquename eq '${name}'`)).value[0];
  console.log('+ api', name);
}
for (const [p, type_, ent] of [['Request', 5, 'cea_request'], ['Confirmation', 0, null]]) {
  if ((await dv('GET', `customapirequestparameters?$select=customapirequestparameterid&$filter=uniquename eq '${p}' and _customapiid_value eq ${api.customapiid}`)).value.length) continue;
  await dv('POST', 'customapirequestparameters', { uniquename: p, name: p, displayname: p, description: p, type: type_, isoptional: false, ...(ent ? { logicalentityname: ent } : {}), 'CustomAPIId@odata.bind': `/customapis(${api.customapiid})` }, H);
}

const vw = async (entity, vname, cols, order, filter) => {
  const fetchxml = `<fetch version="1.0" mapping="logical"><entity name="${entity}">${cols.map((c) => `<attribute name="${c[0]}"/>`).join('')}<order attribute="${order}" descending="true"/>${filter ?? ''}</entity></fetch>`;
  const layoutxml = `<grid name="resultset" object="0" jump="${cols[0][0]}" select="1" icon="1" preview="1"><row name="result" id="${entity}id">${cols.map((c) => `<cell name="${c[0]}" width="${c[1]}"/>`).join('')}</row></grid>`;
  const q = (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${vname}' and returnedtypecode eq '${entity}'`)).value[0];
  if (q) await dv('PATCH', `savedqueries(${q.savedqueryid})`, { fetchxml, layoutxml });
  else await dv('POST', 'savedqueries', { name: vname, returnedtypecode: entity, querytype: 0, fetchxml, layoutxml, isdefault: false });
  return (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${vname}' and returnedtypecode eq '${entity}'`)).value[0].savedqueryid;
};
const flt = (v) => `<filter><condition attribute="cea_status" operator="eq" value="${v}"/></filter>`;
const v1 = await vw('cea_request', 'Final Processing Queue', [['cea_requestnumber', 150], ['cea_projectname', 250], ['ownerid', 150], ['cea_statuschangedon', 130]], 'cea_statuschangedon', flt(10));
const v2 = await vw('cea_request', 'Completed Requests', [['cea_requestnumber', 150], ['cea_projectname', 250], ['cea_completedbyid', 150], ['cea_completedon', 130]], 'cea_completedon', flt(7));
const v3 = await vw('cea_datacorrectionrecord', 'Data Corrections', [['cea_requestid', 150], ['cea_field', 220], ['cea_oldvalue', 200], ['cea_newvalue', 200], ['cea_changedbyid', 150], ['cea_changedon', 130]], 'cea_changedon');
const app = (await dv('GET', "appmodules?$select=appmoduleid&$filter=uniquename eq 'cea_ceaadmin'", null, { 'MSCRM.IncludeUnpublished': 'true' })).value[0];
const comps = [{ '@odata.type': 'Microsoft.Dynamics.CRM.entity', entityid: (await dv('GET', "EntityDefinitions(LogicalName='cea_datacorrectionrecord')?$select=MetadataId")).MetadataId }];
for (const id of [v1, v2, v3]) comps.push({ '@odata.type': 'Microsoft.Dynamics.CRM.savedquery', savedqueryid: id });
await dv('POST', 'AddAppComponents', { AppId: app.appmoduleid, Components: comps }, H);
const sm = (await dv('GET', "sitemaps?$select=sitemapid&$filter=sitemapnameunique eq 'cea_ceaadmin'")).value[0];
const cur = (await dv('GET', `sitemaps(${sm.sitemapid})?$select=sitemapxml`)).sitemapxml;
let xml = cur;
for (const [id, ent, title] of [['sa_finalq', 'cea_request', 'Final Processing Queue'], ['sa_completed', 'cea_request', 'Completed Requests'], ['sa_corrections', 'cea_datacorrectionrecord', 'Data Corrections']])
  if (!xml.includes(`Id="${id}"`)) xml = xml.replace('</Group></Area>', `<SubArea Id="${id}" Entity="${ent}" Title="${title}"/></Group></Area>`);
if (xml !== cur) await dv('PATCH', `sitemaps(${sm.sitemapid})`, { sitemapxml: xml });
await dv('POST', 'PublishAllXml', {});
console.log('done');


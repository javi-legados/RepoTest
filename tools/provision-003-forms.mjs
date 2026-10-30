// Spec 003 T010/T011/T028: Approver Assignment form, lookup views, Resolved Approver form. Idempotent.
import { dv } from './dv.mjs';

const C = { text: '{4273EDBD-AC1D-40d3-9FB2-095C621B552D}', lookup: '{270BD3DB-D9AF-4782-9025-509E298DEC0A}', bool: '{67FAC785-CD58-4F9F-ABB3-4B7DDC6ED5ED}', pick: '{3EF39988-22BB-4F0B-BBBE-64B5A3748AEE}' };
const guid = () => '{' + crypto.randomUUID() + '}';
const ASSIGNABLE = '7C3E1A52-5B0D-4E1F-9A2B-0C6D8E4F1A73';
const PLANTS_REGIONS = '2B9F4D6A-8E31-4C57-B0A4-5D7E9F1C3B82';

async function ensureView(id, name, entity, pk, cols, order, filter, extra = '') {
  const fetchxml = `<fetch version="1.0" mapping="logical"><entity name="${entity}">${cols.map((c) => `<attribute name="${c[0]}"/>`).join('')}<attribute name="${pk}"/><order attribute="${order}" descending="false"/>${filter}${extra}</entity></fetch>`;
  const layoutxml = `<grid name="resultset" object="0" jump="${cols[0][0]}" select="1" icon="1" preview="1"><row name="result" id="${pk}">${cols.map((c) => `<cell name="${c[0]}" width="${c[1]}"/>`).join('')}</row></grid>`;
  const q = (await dv('GET', `savedqueries?$select=savedqueryid&$filter=savedqueryid eq ${id}`)).value[0];
  if (q) await dv('PATCH', `savedqueries(${id})`, { fetchxml, layoutxml });
  else await dv('POST', 'savedqueries', { savedqueryid: id, name, returnedtypecode: entity, querytype: 0, fetchxml, layoutxml, isdefault: false }, { 'MSCRM.SolutionUniqueName': 'CEAPlatform' });
}

await ensureView(ASSIGNABLE, 'Assignable Approvers', 'systemuser', 'systemuserid', [['fullname', 240], ['internalemailaddress', 240]], 'fullname',
  '<filter type="and"><condition attribute="isdisabled" operator="eq" value="0"/></filter>',
  '<link-entity name="systemuserroles" from="systemuserid" to="systemuserid" intersect="true"><link-entity name="role" from="roleid" to="roleid" alias="r"><filter type="and"><condition attribute="name" operator="eq" value="CEA Internal Approvals"/></filter></link-entity></link-entity>');
await ensureView(PLANTS_REGIONS, 'Plants and Regions', 'businessunit', 'businessunitid', [['name', 240], ['cea_level', 100]], 'name',
  '<filter type="and"><condition attribute="cea_level" operator="in"><value>3</value><value>4</value></condition></filter>');

const lookupCell = (f, t, view) => `<row><cell id="${guid()}" showlabel="true" colspan="1" rowspan="1"><labels><label description="${t}" languagecode="1033"/></labels><control id="${f}" classid="${C.lookup}" datafieldname="${f}"><parameters><DefaultViewId>{${view}}</DefaultViewId><AvailableViewIds>{${view}}</AvailableViewIds><DisableViewPicker>true</DisableViewPicker></parameters></control></cell></row>`;
const cell = (f, t, k, ro = false) => `<row><cell id="${guid()}" showlabel="true" colspan="1" rowspan="1"><labels><label description="${t}" languagecode="1033"/></labels><control id="${f}" classid="${C[k]}" datafieldname="${f}"${ro ? ' disabled="true"' : ''}/></cell></row>`;
const tab = (name, title, rows) => `<tab name="${name}" id="${guid()}" IsUserDefined="1" showlabel="false" expanded="true"><labels><label description="${title}" languagecode="1033"/></labels><columns><column width="100%"><sections><section name="${name}_s" showlabel="false" showbar="false" id="${guid()}" IsUserDefined="1"><labels><label description="${title}" languagecode="1033"/></labels><rows>${rows}</rows></section></sections></column></columns></tab>`;
const LIB = 'cea_/scripts/requestForm.js';
const lib = `<formLibraries><Library name="${LIB}" libraryUniqueId="${guid()}"/></formLibraries>`;

async function setMainForm(entity, formxml) {
  const f = (await dv('GET', `systemforms?$select=formid,name&$filter=objecttypecode eq '${entity}' and type eq 2`)).value[0];
  if (!f) throw new Error('no main form for ' + entity);
  await dv('PATCH', `systemforms(${f.formid})`, { formxml });
  console.log('= form', entity, f.name);
}

await setMainForm('cea_approverassignment', `<form><tabs>${tab('T1', 'Assignment',
  lookupCell('cea_businessunitid', 'Business Unit', PLANTS_REGIONS) + cell('cea_roletype', 'Role Type', 'pick') + lookupCell('cea_approverid', 'Approver', ASSIGNABLE) + cell('cea_status', 'State', 'pick'))}</tabs></form>`);

await setMainForm('cea_resolvedapprover', `<form><tabs>${tab('T1', 'Resolved Approver',
  cell('cea_requestreference', 'Request Reference', 'text', true) + cell('cea_requestid', 'Request', 'lookup', true) + cell('cea_level', 'Level', 'pick', true) + cell('cea_approverid', 'Approver', 'lookup', true) +
  cell('cea_stepstatus', 'Step Status', 'pick', true) + cell('cea_decided', 'Decided', 'bool', true) + cell('cea_needsreassignment', 'Needs Reassignment', 'bool', true))}</tabs>${lib}</form>`);

await dv('POST', 'PublishAllXml');
console.log('done');

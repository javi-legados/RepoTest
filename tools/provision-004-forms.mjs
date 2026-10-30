// Spec 004: main form, views, sitemap and app components. Idempotent.
import { dv, SOLUTION } from './dv.mjs';
import fs from 'node:fs';

const LIB = 'cea_/scripts/requestForm.js';
const js = fs.readFileSync(new URL('../solution/CEAPlatform/ModelDrivenApp/requestForm.js', import.meta.url)).toString('base64');
let wr = (await dv('GET', `webresourceset?$select=webresourceid&$filter=name eq '${LIB}'`)).value[0];
if (wr) await dv('PATCH', `webresourceset(${wr.webresourceid})`, { content: js });
else {
  await dv('POST', 'webresourceset', { name: LIB, displayname: 'CEA Request form script', webresourcetype: 3, content: js }, { 'MSCRM.SolutionUniqueName': SOLUTION });
  wr = (await dv('GET', `webresourceset?$select=webresourceid&$filter=name eq '${LIB}'`)).value[0];
}
await dv('POST', 'PublishXml', { ParameterXml: `<importexportxml><webresources><webresource>{${wr.webresourceid}}</webresource></webresources></importexportxml>` });

const C = { text: '{4273EDBD-AC1D-40d3-9FB2-095C621B552D}', lookup: '{270BD3DB-D9AF-4782-9025-509E298DEC0A}', bool: '{67FAC785-CD58-4F9F-ABB3-4B7DDC6ED5ED}', pick: '{3EF39988-22BB-4F0B-BBBE-64B5A3748AEE}', dec: '{C3EFE0C3-0EC6-42BE-8349-CBD9079AFEF7}', int: '{C6D124CA-7EDA-4A60-AEA9-7FB8D318B68F}', date: '{5B773807-9FB2-42DB-97C3-7A91EFF8ADFF}', memo: '{E0DECE4B-6FC8-4A8F-A065-082708572369}', grid: '{E7A81278-8635-4D9E-8D4D-59480B391C5B}' };
const guid = () => '{' + crypto.randomUUID() + '}';
const cell = (f, t, k = 'text', ro = false) => `<row><cell id="${guid()}" showlabel="true" colspan="1" rowspan="1"><labels><label description="${t}" languagecode="1033"/></labels><control id="${f}" classid="${C[k]}" datafieldname="${f}"${ro ? ' disabled="true"' : ''}/></cell></row>`;
const sub = (id, t, rel, viewId) => `<row><cell id="${guid()}" showlabel="true" colspan="1" rowspan="6"><labels><label description="${t}" languagecode="1033"/></labels><control id="${id}" classid="${C.grid}"><parameters><ViewId>${viewId}</ViewId><IsUserView>false</IsUserView><RelationshipName>${rel}</RelationshipName><TargetEntityType>${id.startsWith('grid_fc') ? 'cea_forecastline' : id.startsWith('grid_att') ? 'cea_requestattachment' : id.startsWith('grid_rev') ? 'cea_revisioncycle' : id.startsWith('grid_steps') ? 'cea_resolvedapprover' : id.startsWith('grid_dec') ? 'cea_approvaldecision' : id.startsWith('grid_ir') ? 'cea_initialreview' : 'cea_costline'}</TargetEntityType><AutoExpand>Fixed</AutoExpand><EnableQuickFind>false</EnableQuickFind><EnableViewPicker>false</EnableViewPicker><ViewIds/><RecordsPerPage>20</RecordsPerPage></parameters></control></cell></row>`;
const tab = (name, title, rows) => `<tab name="${name}" id="${guid()}" IsUserDefined="1" showlabel="true" expanded="true"><labels><label description="${title}" languagecode="1033"/></labels><columns><column width="100%"><sections><section name="${name}_s" showlabel="false" showbar="false" id="${guid()}" IsUserDefined="1"><labels><label description="${title}" languagecode="1033"/></labels><rows>${rows}</rows></section></sections></column></columns></tab>`;

// views
const pk = (e) => `${e}id`;
async function view(entity, name, cols, filter = '', order = 'createdon') {
  const fetchxml = `<fetch version="1.0" mapping="logical"><entity name="${entity}">${cols.map((c) => `<attribute name="${c[0]}"/>`).join('')}<order attribute="${order}" descending="false"/>${filter}</entity></fetch>`;
  const layoutxml = `<grid name="resultset" object="0" jump="${cols[0][0]}" select="1" icon="1" preview="1"><row name="result" id="${pk(entity)}">${cols.map((c) => `<cell name="${c[0]}" width="${c[1]}"/>`).join('')}</row></grid>`;
  let q = (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${name}' and returnedtypecode eq '${entity}'`)).value[0];
  if (q) await dv('PATCH', `savedqueries(${q.savedqueryid})`, { fetchxml, layoutxml });
  else await dv('POST', 'savedqueries', { name, returnedtypecode: entity, querytype: 0, fetchxml, layoutxml, isdefault: false });
  return (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${name}' and returnedtypecode eq '${entity}'`)).value[0].savedqueryid;
}
const vDrafts = await view('cea_request', 'My Drafts', [['cea_requestnumber', 120], ['cea_projectname', 200], ['cea_category', 150], ['cea_grandtotal', 120], ['createdon', 120]], '<filter><condition attribute="cea_status" operator="eq" value="1"/><condition attribute="ownerid" operator="eq-userid"/></filter>');
const vAll = await view('cea_request', 'All CEA Requests', [['cea_requestnumber', 120], ['cea_projectname', 200], ['cea_status', 120], ['cea_category', 150], ['cea_grandtotal', 120]]);
const vCost = await view('cea_costline', 'Cost Lines', [['cea_description', 250], ['cea_group', 120], ['cea_cost', 120]], '', 'cea_group');
const vFc = await view('cea_forecastline', 'Forecast Lines', [['cea_year', 80], ['cea_month', 80], ['cea_percentage', 100], ['cea_amount', 120], ['cea_comments', 200]], '', 'cea_year');

const vAtt = await view('cea_requestattachment', 'Request Attachments', [['cea_filename', 250], ['cea_size', 100], ['cea_uploadedbyid', 150], ['cea_uploadedon', 130], ['cea_package', 90]], '', 'cea_uploadedon');
const group = (n) => `<filter><condition attribute="cea_group" operator="eq" value="${n}"/></filter>`;
const groups = ['Capital Expenditure', 'Installation', 'Equipment', 'Engineering', 'Others'];
void groups; void group;

const vSteps = await view('cea_resolvedapprover', 'Approval Steps', [['cea_level', 80], ['cea_approverid', 180], ['cea_stepstatus', 110], ['cea_decidedon', 130]], '', 'cea_level');
const vDec = await view('cea_approvaldecision', 'Approval Decisions', [['cea_level', 80], ['cea_decision', 100], ['cea_approverid', 170], ['cea_decidedon', 130], ['cea_invalidated', 90], ['cea_comments', 250]], '', 'cea_decidedon');
const vPend = await view('cea_request', 'My Pending Approvals', [['cea_requestnumber', 120], ['cea_projectname', 200], ['cea_currentlevel', 90], ['cea_grandtotal', 120], ['cea_submittedon', 130]], '<filter><condition attribute="cea_status" operator="eq" value="3"/><condition attribute="cea_pendingapproverid" operator="eq-userid"/></filter>', 'cea_submittedon');
const vSet = await view('cea_platformsetting', 'Platform Settings', [['cea_name', 200], ['cea_value', 150]], '', 'cea_name');
const vRevc = await view('cea_revisioncycle', 'Revision Cycles', [['cea_cycle', 70], ['cea_rejectedbyid', 150], ['cea_rejectioncomments', 250], ['cea_rejectedon', 130], ['cea_resubmittedon', 130], ['cea_correctionnote', 200], ['cea_reviewoutcome', 100], ['cea_reviewedbyid', 150]], '', 'cea_cycle');
const vHist = await view('cea_historyentry', 'Request History', [['cea_occurredon', 130], ['cea_eventtype', 150], ['cea_actorname', 150], ['cea_cycle', 60], ['cea_field', 180], ['cea_oldvalue', 150], ['cea_newvalue', 150], ['cea_comments', 250]], '', 'cea_occurredon');
const rows11 = sub('grid_hist', 'History', 'cea_request_historyentry', vHist);
const rows10 = sub('grid_rev', 'Revision History', 'cea_request_revisioncycle', vRevc);
const vIr = await view('cea_initialreview', 'Initial Reviews', [['cea_reviewedbyid', 160], ['cea_reviewedon', 130], ['cea_outcome', 100], ['cea_comments', 300]], '', 'cea_reviewedon');
const rows9 = cell('cea_currentlevel', 'Current Level', 'int', true) + cell('cea_pendingapproverid', 'Pending Approver', 'lookup', true) + cell('cea_cycle', 'Cycle', 'int', true) + cell('cea_submittedbyid', 'Submitted By', 'lookup', true) + cell('cea_submittedon', 'Submitted On', 'date', true) + sub('grid_ir', 'Initial Reviews', 'cea_request_initialreview', vIr) + sub('grid_steps', 'Resolved Approvers', 'cea_request_resolvedapprover', vSteps) + sub('grid_dec', 'Approval Decisions', 'cea_request_approvaldecision', vDec);
const subs = (title, rel, v, id, e) => sub(id, title, rel, v);
const rows1 = cell('cea_requestnumber', 'Request ID', 'text', true) + cell('cea_status', 'Status', 'pick', true) + cell('cea_projectmanager', 'Project Manager', 'text', true) + cell('cea_location', 'Location', 'text', true) + cell('cea_department', 'Department', 'text', true) + cell('cea_date', 'Date', 'date', true);
const rows2 = cell('cea_category', 'Category', 'pick') + cell('cea_supplemental', 'Supplemental', 'bool') + cell('cea_existingceareferenceid', 'Existing CEA Reference', 'lookup') + cell('cea_projectname', 'Project Name', 'text') + cell('cea_descriptionsummary', 'Description Summary', 'text') + cell('cea_payback', 'Pay Back', 'int') + cell('cea_irr', 'IRR', 'dec') + cell('cea_npv', 'NPV', 'dec');
const rows3 = cell('cea_projectlocationid', 'Project Location', 'lookup') + cell('cea_startdate', 'Start Date', 'date') + cell('cea_estimatedcompletiondate', 'Estimated Completion Date', 'date');
const rows4 = cell('cea_currency', 'Currency', 'pick') + cell('cea_projectinplan', 'Project in Plan', 'bool') + cell('cea_budgetedamount', 'Budgeted Amount', 'dec') + cell('cea_investmentrequired', 'Investment Required', 'dec') + cell('cea_noncapitalizedexpenses', 'Non-capitalized Expenses', 'dec') + cell('cea_writeoff', 'Write-off', 'dec');
const rows5 = subs('Cost Lines', 'cea_request_costline', vCost, 'grid_cost') + ['cea_subtotal1', 'cea_subtotal2', 'cea_subtotal3', 'cea_subtotal4', 'cea_subtotal5', 'cea_grandtotal'].map((f, i) => cell(f, i < 5 ? `Subtotal ${i + 1}` : 'Grand Total', 'dec', true)).join('');
const rows6 = subs('Forecast Lines', 'cea_request_forecastline', vFc, 'grid_fc') + cell('cea_forecastcalculated', 'Forecast Calculated', 'dec', true) + cell('cea_forecastpercentage', 'Forecast %', 'dec', true) + cell('cea_forecastleft', 'Forecast Left', 'dec', true);
const rows7 = cell('cea_detaileddescription', 'Detailed Description', 'memo');

const formxml = `<form><tabs>${tab('T1', 'Requester Data', rows1)}${tab('T2', 'Project Category', rows2)}${tab('T3', 'Schedule and Project', rows3)}${tab('T4', 'Financial Data', rows4)}${tab('T5', 'Monetary Values', rows5)}${tab('T6', 'Spending Forecast', rows6)}${tab('T7', 'Project Details', rows7)}${tab('T8', 'Attachments', sub('grid_att', 'Attachments', 'cea_request_attachment', vAtt))}${tab('T9', 'Approval', rows9)}${tab('T10', 'Revision History', rows10)}${tab('T11', 'History', rows11)}</tabs>`
  + `<events><event name="onload" application="false" active="false"><Handlers><Handler functionName="CEA.RequestForm.onLoad" libraryName="${LIB}" handlerUniqueId="${guid()}" enabled="true" parameters="" passExecutionContext="true"/></Handlers></event></events>`
  + `<formLibraries><Library name="${LIB}" libraryUniqueId="${guid()}"/></formLibraries></form>`;

const NAME = 'CEA Request';
const findForm = async () => (await dv('GET', `systemforms?$select=formid&$filter=name eq '${NAME}' and objecttypecode eq 'cea_request' and type eq 2`)).value[0];
let form = await findForm();
if (!form) { await dv('POST', 'systemforms', { name: NAME, objecttypecode: 'cea_request', type: 2, formxml }, { 'MSCRM.SolutionUniqueName': SOLUTION }); form = await findForm(); console.log('+ form'); }
else { await dv('PATCH', `systemforms(${form.formid})`, { formxml }); console.log('= form updated'); }

const app = (await dv('GET', `appmodules?$select=appmoduleid&$filter=uniquename eq 'cea_ceaadmin'`, null, { 'MSCRM.IncludeUnpublished': 'true' })).value[0];
const comps = [{ '@odata.type': 'Microsoft.Dynamics.CRM.systemform', formid: form.formid }];
for (const e of ['cea_request', 'cea_costline', 'cea_forecastline', 'cea_requestattachment', 'cea_resolvedapprover', 'cea_approvaldecision', 'cea_platformsetting', 'cea_revisioncycle', 'cea_historyentry']) comps.push({ '@odata.type': 'Microsoft.Dynamics.CRM.entity', entityid: (await dv('GET', `EntityDefinitions(LogicalName='${e}')?$select=MetadataId`)).MetadataId });
for (const id of [vDrafts, vAll, vCost, vFc, vAtt, vSteps, vDec, vPend, vSet, vRevc, vHist]) comps.push({ '@odata.type': 'Microsoft.Dynamics.CRM.savedquery', savedqueryid: id });
await dv('POST', 'AddAppComponents', { AppId: app.appmoduleid, Components: comps }, { 'MSCRM.SolutionUniqueName': SOLUTION });

const sm = (await dv('GET', `sitemaps?$select=sitemapid,sitemapxml&$filter=sitemapnameunique eq 'cea_ceaadmin'`)).value[0];
if (!sm.sitemapxml.includes('cea_request')) {
  await dv('PATCH', `sitemaps(${sm.sitemapid})`, { sitemapxml: sm.sitemapxml.replace('</Group></Area>', '<SubArea Id="sa_requests" Entity="cea_request" Title="CEA Requests"/></Group></Area>') });
}
for (const [id, ent, title] of [['sa_pending', 'cea_request', 'My Pending Approvals'], ['sa_settings', 'cea_platformsetting', 'Platform Settings']]) {
  const cur = (await dv('GET', `sitemaps(${sm.sitemapid})?$select=sitemapxml`)).sitemapxml;
  if (!cur.includes(`Id="${id}"`)) await dv('PATCH', `sitemaps(${sm.sitemapid})`, { sitemapxml: cur.replace('</Group></Area>', `<SubArea Id="${id}" Entity="${ent}" Title="${title}"/></Group></Area>`) });
}
await dv('POST', 'PublishAllXml', {});
console.log('published');

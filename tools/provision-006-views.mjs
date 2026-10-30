// Spec 006: Pending Initial Review queue view, Initial Review view, sitemap entries. Idempotent.
import { dv, SOLUTION } from './dv.mjs';

async function view(entity, name, cols, filter, order) {
  const fetchxml = `<fetch version="1.0" mapping="logical"><entity name="${entity}">${cols.map((c) => `<attribute name="${c[0]}"/>`).join('')}<order attribute="${order}" descending="false"/>${filter}</entity></fetch>`;
  const layoutxml = `<grid name="resultset" object="0" jump="${cols[0][0]}" select="1" icon="1" preview="1"><row name="result" id="${entity}id">${cols.map((c) => `<cell name="${c[0]}" width="${c[1]}"/>`).join('')}</row></grid>`;
  const q = (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${name}' and returnedtypecode eq '${entity}'`)).value[0];
  if (q) await dv('PATCH', `savedqueries(${q.savedqueryid})`, { fetchxml, layoutxml });
  else await dv('POST', 'savedqueries', { name, returnedtypecode: entity, querytype: 0, fetchxml, layoutxml, isdefault: false });
  return (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${name}' and returnedtypecode eq '${entity}'`)).value[0].savedqueryid;
}
const vQueue = await view('cea_request', 'Pending Initial Review', [['cea_requestnumber', 120], ['cea_projectname', 200], ['cea_submittedbyid', 150], ['cea_submittedon', 130], ['cea_grandtotal', 120]], '<filter><condition attribute="cea_status" operator="eq" value="2"/></filter>', 'cea_submittedon');
const vRev = await view('cea_initialreview', 'Initial Reviews', [['cea_name', 200], ['cea_reviewtype', 90], ['cea_state', 90], ['cea_outcome', 90], ['cea_reviewedbyid', 150], ['cea_reviewedon', 130], ['cea_comments', 250]], '', 'createdon');

const app = (await dv('GET', `appmodules?$select=appmoduleid&$filter=uniquename eq 'cea_ceaadmin'`, null, { 'MSCRM.IncludeUnpublished': 'true' })).value[0];
const md = await dv('GET', `EntityDefinitions(LogicalName='cea_initialreview')?$select=MetadataId`);
await dv('POST', 'AddAppComponents', { AppId: app.appmoduleid, Components: [
  { '@odata.type': 'Microsoft.Dynamics.CRM.entity', entityid: md.MetadataId },
  { '@odata.type': 'Microsoft.Dynamics.CRM.savedquery', savedqueryid: vQueue },
  { '@odata.type': 'Microsoft.Dynamics.CRM.savedquery', savedqueryid: vRev },
] }, { 'MSCRM.SolutionUniqueName': SOLUTION });
const sm = (await dv('GET', `sitemaps?$select=sitemapid,sitemapxml&$filter=sitemapnameunique eq 'cea_ceaadmin'`)).value[0];
if (!sm.sitemapxml.includes('cea_initialreview')) {
  await dv('PATCH', `sitemaps(${sm.sitemapid})`, { sitemapxml: sm.sitemapxml.replace('</Group></Area>', '<SubArea Id="sa_initialreviews" Entity="cea_initialreview" Title="Initial Reviews"/></Group></Area>') });
}
await dv('POST', 'PublishAllXml', {});
console.log('done');

import { dv, SOLUTION } from './dv.mjs';
// Spec 002 T024: approvals/decisions/attachments areas. Read-only for CEA Approvals comes from role privileges, not from the UI.
const ents = [['sa_decisions', 'cea_approvaldecision', 'Approval Decisions'], ['sa_attachments', 'cea_requestattachment', 'Attachments']];
const app = (await dv('GET', "appmodules?$select=appmoduleid&$filter=uniquename eq 'cea_ceaadmin'", null, { 'MSCRM.IncludeUnpublished': 'true' })).value[0];
const comps = [];
for (const [, e] of ents) comps.push({ '@odata.type': 'Microsoft.Dynamics.CRM.entity', entityid: (await dv('GET', `EntityDefinitions(LogicalName='${e}')?$select=MetadataId`)).MetadataId });
await dv('POST', 'AddAppComponents', { AppId: app.appmoduleid, Components: comps }, { 'MSCRM.SolutionUniqueName': SOLUTION });
const sm = (await dv('GET', "sitemaps?$select=sitemapid&$filter=sitemapnameunique eq 'cea_ceaadmin'")).value[0];
const cur = (await dv('GET', `sitemaps(${sm.sitemapid})?$select=sitemapxml`)).sitemapxml;
let xml = cur;
for (const [id, ent, title] of ents)
  if (!xml.includes(`Id="${id}"`)) xml = xml.replace('</Group></Area>', `<SubArea Id="${id}" Entity="${ent}" Title="${title}"/></Group></Area>`);
if (xml !== cur) await dv('PATCH', `sitemaps(${sm.sitemapid})`, { sitemapxml: xml });
await dv('POST', 'PublishAllXml', {});
console.log('done');

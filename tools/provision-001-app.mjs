// Spec 001 app layer: views (T026-T028), model-driven app + sitemap (T009), CEA Administrators role (T010). Idempotent.
import { dv, SOLUTION } from './dv.mjs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function ensureView({ name, entity, pk, fetchFilter = '', cols, order, desc }) {
  const existing = (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${name}' and returnedtypecode eq '${entity}'`)).value[0];
  const fetchxml = `<fetch version="1.0" mapping="logical"><entity name="${entity}">${cols.map((c) => `<attribute name="${c[0]}"/>`).join('')}<attribute name="${pk}"/><order attribute="${order}" descending="false"/>${fetchFilter}</entity></fetch>`;
  const layoutxml = `<grid name="resultset" object="0" jump="${cols[0][0]}" select="1" icon="1" preview="1"><row name="result" id="${pk}">${cols.map((c) => `<cell name="${c[0]}" width="${c[1]}"/>`).join('')}</row></grid>`;
  const body = { name, returnedtypecode: entity, querytype: 0, fetchxml, layoutxml, description: desc || name, isdefault: false };
  if (existing) {
    await dv('PATCH', `savedqueries(${existing.savedqueryid})`, { fetchxml, layoutxml });
    console.log('= view', name);
    return existing.savedqueryid;
  }
  await dv('POST', 'savedqueries', body);
  console.log('+ view', name);
  return (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${name}' and returnedtypecode eq '${entity}'`)).value[0].savedqueryid;
}

const userCols = [
  ['fullname', 200], ['cea_sapnumber', 120], ['internalemailaddress', 220], ['cea_department', 150],
  ['businessunitid', 180], ['cea_managername', 180], ['cea_manageremail', 220], ['isdisabled', 80],
];
const activeOnly = '<filter type="and"><condition attribute="accessmode" operator="eq" value="0"/><condition attribute="applicationid" operator="null"/></filter>';
const incomplete =
  '<filter type="and"><condition attribute="accessmode" operator="eq" value="0"/><condition attribute="applicationid" operator="null"/>' +
  '<filter type="or">' + ['cea_sapnumber', 'cea_department', 'cea_managername', 'cea_manageremail'].map((a) => `<condition attribute="${a}" operator="null"/>`).join('') + '</filter></filter>';

const v = {};
v.users = await ensureView({ name: 'CEA Users', entity: 'systemuser', pk: 'systemuserid', fetchFilter: activeOnly, cols: userCols, order: 'fullname' });
v.incomplete = await ensureView({ name: 'CEA Incomplete Users', entity: 'systemuser', pk: 'systemuserid', fetchFilter: incomplete, cols: userCols, order: 'fullname' });
for (const [t, parent] of [['cea_company', null], ['cea_region', 'cea_companyid'], ['cea_plant', 'cea_regionid']]) {
  const cols = [['cea_name', 220], ...(parent ? [[parent, 200]] : []), ['cea_status', 100], ['createdon', 140]];
  v[t] = await ensureView({ name: `All ${{ cea_company: 'Companies', cea_region: 'Regions', cea_plant: 'Plants' }[t]}`, entity: t, pk: `${t}id`, cols, order: 'cea_name' });
}
v.active = await ensureView({
  name: 'Active Plants', entity: 'cea_plant', pk: 'cea_plantid',
  fetchFilter: '<filter type="and"><condition attribute="cea_status" operator="eq" value="1"/></filter>',
  cols: [['cea_name', 220], ['cea_regionid', 200]], order: 'cea_name',
});
v.log = await ensureView({
  name: 'All User Change Records', entity: 'cea_userchangerecord', pk: 'cea_userchangerecordid',
  cols: [['cea_changedon', 160], ['cea_userid', 200], ['cea_field', 140], ['cea_oldvalue', 200], ['cea_newvalue', 200], ['cea_changedbyid', 180]],
  order: 'cea_changedon',
});

// Model-driven app
let icon = (await dv('GET', `webresourceset?$select=webresourceid&$filter=name eq 'cea_/icons/cea.svg'`)).value[0];
if (!icon) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0b6a0b"/><text x="16" y="21" font-family="Segoe UI,Arial" font-size="12" font-weight="700" fill="#fff" text-anchor="middle">CEA</text></svg>';
  await dv('POST', 'webresourceset', { name: 'cea_/icons/cea.svg', displayname: 'CEA icon', webresourcetype: 11, content: Buffer.from(svg).toString('base64') });
  icon = (await dv('GET', `webresourceset?$select=webresourceid&$filter=name eq 'cea_/icons/cea.svg'`)).value[0];
  console.log('+ icon');
}
let app = (await dv('GET', `appmodules?$select=appmoduleid&$filter=uniquename eq 'cea_ceaadmin'`, null, {'MSCRM.IncludeUnpublished':'true'})).value[0];
if (!app) {
  await dv('POST', 'appmodules', {
    name: 'CEA Administration', uniquename: 'cea_ceaadmin', description: 'Administration of users and master data for the CEA platform',
    webresourceid: icon.webresourceid, clienttype: 4, navigationtype: 0,
  });
  app = (await dv('GET', `appmodules?$select=appmoduleid&$filter=uniquename eq 'cea_ceaadmin'`)).value[0];
  console.log('+ app');
} else console.log('= app');

const area = (id, title, subs) =>
  `<Area Id="${id}" ShowGroups="true"><Titles><Title LCID="1033" Title="${title}"/></Titles><Group Id="${id}_g" IsProfile="false"><Titles><Title LCID="1033" Title="${title}"/></Titles>${subs}</Group></Area>`;
const sub = (id, entity, title, viewId) => `<SubArea Id="${id}" Entity="${entity}" Title="${title}"/>`;
const sitemapxml =
  `<SiteMap IntroducedVersion="7.0.0.0"><Area Id="area_admin" ShowGroups="true"><Titles><Title LCID="1033" Title="Administration"/></Titles>` +
  `<Group Id="grp_users" IsProfile="false"><Titles><Title LCID="1033" Title="Users"/></Titles>` +
  sub('sa_users', 'systemuser', 'Users', v.users) + `<SubArea Id="sa_incomplete" Title="Incomplete Users" Url="/main.aspx?pagetype=entitylist&amp;etn=systemuser&amp;viewid=%7B${v.incomplete}%7D&amp;viewtype=1039"/>` +
  sub('sa_log', 'cea_userchangerecord', 'User Change Records', v.log) +
  `</Group><Group Id="grp_master" IsProfile="false"><Titles><Title LCID="1033" Title="Master Data"/></Titles>` +
  sub('sa_company', 'cea_company', 'Companies', v.cea_company) + sub('sa_region', 'cea_region', 'Regions', v.cea_region) +
  sub('sa_plant', 'cea_plant', 'Plants', v.cea_plant) + sub('sa_bu', 'businessunit', 'Business Units') +
  `</Group></Area></SiteMap>`;
let sm = (await dv('GET', `sitemaps?$select=sitemapid&$filter=sitemapnameunique eq 'cea_ceaadmin'`)).value[0];
if (!sm) {
  await dv('POST', 'sitemaps', { sitemapname: 'CEA Administration', sitemapnameunique: 'cea_ceaadmin', sitemapxml, isappaware: true });
  sm = (await dv('GET', `sitemaps?$select=sitemapid&$filter=sitemapnameunique eq 'cea_ceaadmin'`)).value[0];
  console.log('+ sitemap');
} else {
  await dv('PATCH', `sitemaps(${sm.sitemapid})`, { sitemapxml });
  console.log('~ sitemap');
}
const components = [{ '@odata.type': 'Microsoft.Dynamics.CRM.sitemap', sitemapid: sm.sitemapid }];
for (const e of ['systemuser', 'businessunit', 'cea_company', 'cea_region', 'cea_plant', 'cea_userchangerecord']) {
  const md = await dv('GET', `EntityDefinitions(LogicalName='${e}')?$select=MetadataId`);
  components.push({ '@odata.type': 'Microsoft.Dynamics.CRM.entity', entityid: md.MetadataId });
}
for (const id of Object.values(v)) components.push({ '@odata.type': 'Microsoft.Dynamics.CRM.savedquery', savedqueryid: id });
await dv('POST', 'AddAppComponents', { AppId: app.appmoduleid, Components: components }, { 'MSCRM.SolutionUniqueName': SOLUTION });
await dv('POST', 'PublishXml', { ParameterXml: '<importexportxml><appmodules><appmodule>{' + app.appmoduleid + '}</appmodule></appmodules></importexportxml>' });
console.log('app components added and published', app.appmoduleid);

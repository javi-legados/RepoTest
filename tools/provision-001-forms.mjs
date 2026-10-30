import { dv, SOLUTION } from './dv.mjs';
import fs from 'node:fs';

const LIB = 'cea_/scripts/userForm.js';
const js = fs.readFileSync(new URL('../solution/CEAPlatform/ModelDrivenApp/userForm.js', import.meta.url)).toString('base64');
let wr = (await dv('GET', `webresourceset?$select=webresourceid&$filter=name eq '${LIB}'`)).value[0];
if (wr) await dv('PATCH', `webresourceset(${wr.webresourceid})`, { content: js });
else {
  await dv('POST', 'webresourceset', { name: LIB, displayname: 'CEA User form script', webresourcetype: 3, content: js }, { 'MSCRM.SolutionUniqueName': SOLUTION });
  wr = (await dv('GET', `webresourceset?$select=webresourceid&$filter=name eq '${LIB}'`)).value[0];
}
await dv('POST', 'PublishXml', { ParameterXml: `<importexportxml><webresources><webresource>{${wr.webresourceid}}</webresource></webresources></importexportxml>` });

const T = '{4273EDBD-AC1D-40d3-9FB2-095C621B552D}';
const L = '{270BD3DB-D9AF-4782-9025-509E298DEC0A}';
const guid = () => '{' + crypto.randomUUID() + '}';
const cell = (field, text, classid = T) =>
  `<row><cell id="${guid()}" showlabel="true" colspan="1" rowspan="1"><labels><label description="${text}" languagecode="1033"/></labels><control id="${field}" classid="${classid}" datafieldname="${field}"/></cell></row>`;

const formxml = `<form><tabs><tab name="CEA_TAB" id="${guid()}" IsUserDefined="1" showlabel="true" expanded="true"><labels><label description="CEA User" languagecode="1033"/></labels><columns><column width="100%"><sections><section name="CEA_SECTION" showlabel="true" showbar="false" id="${guid()}" IsUserDefined="1"><labels><label description="User directory" languagecode="1033"/></labels><rows>`
  + cell('cea_sapnumber', 'SAP Number')
  + cell('lastname', 'Name')
  + cell('internalemailaddress', 'Email')
  + cell('cea_department', 'Department')
  + cell('cea_managername', 'Manager Name')
  + cell('cea_manageremail', 'Manager Email')
  + cell('cea_managerregistered', 'Manager Registered', '{67FAC785-CD58-4F9F-ABB3-4B7DDC6ED5ED}')
  + cell('businessunitid', 'Business Unit', L)
  + `</rows></section></sections></column></columns></tab></tabs>`
  + `<events><event name="onload" application="false" active="false"><Handlers><Handler functionName="CEA.UserForm.onLoad" libraryName="${LIB}" handlerUniqueId="${guid()}" enabled="true" parameters="" passExecutionContext="true"/></Handlers></event></events>`
  + `<formLibraries><Library name="${LIB}" libraryUniqueId="${guid()}"/></formLibraries></form>`;

const NAME = 'CEA User';
let form = (await dv('GET', `systemforms?$select=formid&$filter=name eq '${NAME}' and objecttypecode eq 'systemuser'`)).value[0];
if (!form) {
  await dv('POST', 'systemforms', { name: NAME, objecttypecode: 'systemuser', type: 2, formxml, description: 'Directory fields required by the CEA platform' }, { 'MSCRM.SolutionUniqueName': SOLUTION });
  form = (await dv('GET', `systemforms?$select=formid&$filter=name eq '${NAME}' and objecttypecode eq 'systemuser'`)).value[0];
  console.log('+ form', form.formid);
} else {
  await dv('PATCH', `systemforms(${form.formid})`, { formxml });
  console.log('= form updated');
}
const app = (await dv('GET', `appmodules?$select=appmoduleid&$filter=uniquename eq 'cea_ceaadmin'`, null, { 'MSCRM.IncludeUnpublished': 'true' })).value[0];
await dv('POST', 'AddAppComponents', { AppId: app.appmoduleid, Components: [{ '@odata.type': 'Microsoft.Dynamics.CRM.systemform', formid: form.formid }] }, { 'MSCRM.SolutionUniqueName': SOLUTION });
await dv('POST', 'PublishAllXml', {});
console.log('form added to app and published');

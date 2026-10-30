// T021/T025: main forms for the catalogs and active-only lookup views. Idempotent.
import { dv, SOLUTION } from './dv.mjs';

const TXT = '{4273EDBD-AC1D-40d3-9FB2-095C621B552D}';
const LKP = '{270BD3DB-D9AF-4782-9025-509E298DEC0A}';
const OPT = '{3EF39988-22BB-4f0b-BBBE-64B5A3748AEE}';
const guid = () => '{' + crypto.randomUUID() + '}';
const cell = (field, text, classid, disabled = false) =>
  `<row><cell id="${guid()}" showlabel="true" colspan="1" rowspan="1"><labels><label description="${text}" languagecode="1033"/></labels><control id="${field}" classid="${classid}" datafieldname="${field}" disabled="${disabled}"/></cell></row>`;

const forms = {
  cea_company: [['cea_name', 'Name', TXT], ['cea_status', 'Status', OPT], ['cea_businessunitid', 'Business Unit', LKP, true]],
  cea_region: [['cea_name', 'Name', TXT], ['cea_companyid', 'Company', LKP], ['cea_status', 'Status', OPT], ['cea_businessunitid', 'Business Unit', LKP, true]],
  cea_plant: [['cea_name', 'Name', TXT], ['cea_regionid', 'Region', LKP], ['cea_status', 'Status', OPT], ['cea_businessunitid', 'Business Unit', LKP, true]],
};
const display = { cea_company: 'Company', cea_region: 'Region', cea_plant: 'Plant' };

for (const [entity, fields] of Object.entries(forms)) {
  const xml = `<form><tabs><tab name="GENERAL" id="${guid()}" IsUserDefined="1" showlabel="false" expanded="true"><labels><label description="General" languagecode="1033"/></labels><columns><column width="100%"><sections><section name="MAIN" showlabel="false" showbar="false" id="${guid()}" IsUserDefined="1"><labels><label description="${display[entity]}" languagecode="1033"/></labels><rows>`
    + fields.map((f) => cell(...f)).join('') + `</rows></section></sections></column></columns></tab></tabs></form>`;
  const main = (await dv('GET', `systemforms?$select=formid,ismanaged&$filter=objecttypecode eq '${entity}' and type eq 2`)).value[0];
  if (main) await dv('PATCH', `systemforms(${main.formid})`, { formxml: xml });
  else await dv('POST', 'systemforms', { name: display[entity], objecttypecode: entity, type: 2, formxml: xml }, { 'MSCRM.SolutionUniqueName': SOLUTION });
  console.log('= form', entity);

  // Lookup view: only Active entries (FR-010, FR-011)
  const lv = (await dv('GET', `savedqueries?$select=savedqueryid,fetchxml&$filter=returnedtypecode eq '${entity}' and querytype eq 64`)).value;
  for (const v of lv) {
    if (v.fetchxml.includes('cea_status')) continue;
    const fetchxml = v.fetchxml.replace('</entity>', '<filter type="and"><condition attribute="cea_status" operator="eq" value="1"/></filter></entity>');
    await dv('PATCH', `savedqueries(${v.savedqueryid})`, { fetchxml });
    console.log('+ active-only lookup view', entity);
  }
}
await dv('POST', 'PublishAllXml', {});

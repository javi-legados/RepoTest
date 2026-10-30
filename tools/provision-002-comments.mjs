// Spec 002 T012: Creators add comments (Notes) on their own requests. Enables Notes on cea_request, grants annotation privileges, adds Notes tab to the main form. Idempotent.
import { dv } from './dv.mjs';

const root = (await dv('GET', 'businessunits?$select=businessunitid&$filter=parentbusinessunitid eq null')).value[0];
const def = await dv('GET', "EntityDefinitions(LogicalName='cea_request')?$select=MetadataId,HasNotes");
if (!def.HasNotes) {
  await dv('PUT', `EntityDefinitions(${def.MetadataId})`, { '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata', MetadataId: def.MetadataId, HasNotes: true }, { 'MSCRM.MergeLabels': 'true' }).catch(async (e) => {
    console.log('PUT failed, trying PATCH:', e.message.slice(0, 200));
    await dv('PATCH', `EntityDefinitions(${def.MetadataId})`, { '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata', HasNotes: true }, { 'MSCRM.MergeLabels': 'true' });
  });
  console.log('+ HasNotes on cea_request');
}

async function grant(roleName, entity, verbs, depth) {
  const role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${roleName}' and parentroleid eq null`)).value[0];
  const names = verbs.map((v) => `prv${v}${entity}`);
  const found = (await dv('GET', `privileges?$select=privilegeid,name&$filter=${names.map((n) => `name eq '${n}'`).join(' or ')}`)).value;
  await dv('POST', `roles(${role.roleid})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, { Privileges: found.map((p) => ({ PrivilegeId: p.privilegeid, Depth: depth, BusinessUnitId: root.businessunitid })) });
  console.log('~ role', roleName, entity, found.length);
}
await grant('CEA Creators', 'Note', ['Create', 'Read', 'Write', 'Append', 'AppendTo'], 'Basic');
await grant('CEA Administrators', 'Note', ['Create', 'Read', 'Write', 'Append', 'AppendTo'], 'Global');
for (const r of ['CEA Internal Approvals', 'CEA Approvals']) await grant(r, 'Note', ['Read'], 'Deep');

const f = (await dv('GET', "systemforms?$select=formid,formxml&$filter=objecttypecode eq 'cea_request' and type eq 2")).value[0];
if (!/CEA_Notes/.test(f.formxml)) {
  const g = () => '{' + crypto.randomUUID() + '}';
  const tab = `<tab name="CEA_Notes" id="${g()}" IsUserDefined="1" showlabel="true" expanded="true"><labels><label description="Comments" languagecode="1033"/></labels><columns><column width="100%"><sections><section name="CEA_Notes_s" showlabel="false" showbar="false" id="${g()}" IsUserDefined="1"><labels><label description="Comments" languagecode="1033"/></labels><rows><row><cell id="${g()}" showlabel="false" colspan="1" rowspan="1"><labels><label description="Comments" languagecode="1033"/></labels><control id="notescontrol" classid="{06375649-C143-495e-A496-C962E5B4488E}"><parameters><ShowOnMobileClient>false</ShowOnMobileClient></parameters></control></cell></row></rows></section></sections></column></columns></tab>`;
  await dv('PATCH', `systemforms(${f.formid})`, { formxml: f.formxml.replace('</tabs>', tab + '</tabs>') });
  console.log('+ Comments tab');
}
await dv('POST', 'PublishAllXml', {});
console.log('done');

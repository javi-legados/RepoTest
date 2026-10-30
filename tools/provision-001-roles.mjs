import { dv, SOLUTION } from './dv.mjs';

const ROLE = 'CEA Administrators';
const GLOBAL = 'Global';

const matrix = {
  cea_company: ['Create', 'Read', 'Write', 'Delete', 'Append', 'AppendTo', 'Assign', 'Share'],
  cea_region: ['Create', 'Read', 'Write', 'Delete', 'Append', 'AppendTo', 'Assign', 'Share'],
  cea_plant: ['Create', 'Read', 'Write', 'Delete', 'Append', 'AppendTo', 'Assign', 'Share'],
  cea_userchangerecord: ['Read', 'AppendTo'],
  systemuser: ['Create', 'Read', 'Write', 'Append', 'AppendTo', 'Assign'],
  businessunit: ['Create', 'Read', 'Write', 'Append', 'AppendTo'],
};

const priv = { systemuser: 'User', businessunit: 'BusinessUnit' };
const root = (await dv('GET', 'businessunits?$select=businessunitid&$filter=parentbusinessunitid eq null')).value[0];
let role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${ROLE}' and parentroleid eq null`)).value[0];
if (!role) {
  await dv('POST', 'roles', {
    name: ROLE,
    'businessunitid@odata.bind': `/businessunits(${root.businessunitid})`,
  }, { 'MSCRM.SolutionUniqueName': SOLUTION });
  role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${ROLE}' and parentroleid eq null`)).value[0];
  console.log('+ role', role.roleid);
}

const names = [];
for (const [entity, verbs] of Object.entries(matrix)) for (const v of verbs) names.push('prv' + v + (priv[entity] || entity));
const privs = [];
for (let i = 0; i < names.length; i += 20) {
  const f = names.slice(i, i + 20).map((n) => `name eq '${n}'`).join(' or ');
  privs.push(...(await dv('GET', `privileges?$select=privilegeid,name&$filter=${f}`)).value);
}
const missing = names.filter((n) => !privs.find((p) => p.name === n));
if (missing.length) console.log('missing privileges (skipped):', missing.join(', '));

await dv('POST', `roles(${role.roleid})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, {
  Privileges: privs.map((p) => ({ PrivilegeId: p.privilegeid, Depth: GLOBAL, BusinessUnitId: root.businessunitid })),
});
console.log('privileges assigned:', privs.length);

const app = (await dv('GET', `appmodules?$select=appmoduleid&$filter=uniquename eq 'cea_ceaadmin'`, null, { 'MSCRM.IncludeUnpublished': 'true' })).value[0];
await dv('POST', 'AddAppComponents', {
  AppId: app.appmoduleid,
  Components: [{ '@odata.type': 'Microsoft.Dynamics.CRM.role', roleid: role.roleid }],
}, { 'MSCRM.SolutionUniqueName': SOLUTION });
await dv('POST', 'PublishAllXml', {});
console.log('role added to app and published');

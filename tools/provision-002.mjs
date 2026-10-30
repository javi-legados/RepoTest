// Spec 002 foundational provisioning (T004, T005, T027 partial). Idempotent.
import { dv, ensureTable, ensureLookup, stringAttr, choiceAttr, dateAttr, SOLUTION } from './dv.mjs';

// T005: Access Denial Record (written by plug-ins in system context; no role gets Create/Write/Delete)
await ensureTable({
  SchemaName: 'cea_accessdenialrecord', display: 'Access Denial Record', plural: 'Access Denial Records',
  primary: { schema: 'cea_Name', display: 'Summary', max: 300 }, ownership: 'OrganizationOwned',
}, [
  choiceAttr('cea_Action', 'Action', [[1, 'Approve'], [2, 'Reject'], [3, 'Edit'], [4, 'Create'], [5, 'Upload'], [6, 'Other']], { required: true }),
  // The Request lookup is added when the request table of Spec 4 exists; until then a reference text is kept.
  stringAttr('cea_RequestReference', 'Request Reference', { max: 100 }),
  stringAttr('cea_Reason', 'Reason', { max: 1000 }),
  dateAttr('cea_OccurredOn', 'Occurred On', { required: true }),
]);
await ensureLookup('cea_accessdenialrecord', 'systemuser', 'cea_user_accessdenialrecord', 'cea_UserId', 'User', { required: true });

const root = (await dv('GET', 'businessunits?$select=businessunitid&$filter=parentbusinessunitid eq null')).value[0];

async function ensureRole(name, matrix, privMap = { systemuser: 'User', businessunit: 'BusinessUnit' }) {
  let role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${name}' and parentroleid eq null`)).value[0];
  if (!role) {
    await dv('POST', 'roles', { name, 'businessunitid@odata.bind': `/businessunits(${root.businessunitid})` }, { 'MSCRM.SolutionUniqueName': SOLUTION });
    role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${name}' and parentroleid eq null`)).value[0];
    console.log('+ role', name);
  } else console.log('= role', name);
  const names = [];
  for (const [entity, verbs] of Object.entries(matrix)) for (const v of verbs) names.push(`prv${v}${privMap[entity] || entity}`);
  const privs = [];
  for (let i = 0; i < names.length; i += 20) {
    const f = names.slice(i, i + 20).map((n) => `name eq '${n}'`).join(' or ');
    privs.push(...(await dv('GET', `privileges?$select=privilegeid,name&$filter=${f}`)).value);
  }
  const missing = names.filter((n) => !privs.find((p) => p.name === n));
  if (missing.length) console.log('  missing privileges (skipped):', missing.join(', '));
  if (privs.length) {
    await dv('POST', `roles(${role.roleid})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, {
      Privileges: privs.map((p) => ({ PrivilegeId: p.privilegeid, Depth: 'Global', BusinessUnitId: root.businessunitid })),
    });
  }
  return role.roleid;
}

// T004: three roles with the baseline directory access; request-table privileges are added by Specs 4-7.
const baseline = { systemuser: ['Read'], businessunit: ['Read'], cea_company: ['Read'], cea_region: ['Read'], cea_plant: ['Read'] };
for (const name of ['CEA Creators', 'CEA Internal Approvals', 'CEA Approvals']) await ensureRole(name, baseline);

// T027 (partial): Administrators read the denial log and manage roles
await ensureRole('CEA Administrators', { cea_accessdenialrecord: ['Read', 'AppendTo'], role: ['Read', 'Write', 'Assign'] });

const count = (await dv('GET', `roles?$select=name&$filter=startswith(name,'CEA ') and parentroleid eq null`)).value;
console.log('CEA roles:', count.map((r) => r.name).sort().join(', '));

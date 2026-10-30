// Web API checks for Spec 003 approver assignment rules. Run: node tests/api/approver-assignment.mjs
import { dv } from '../../tools/dv.mjs';

let failed = 0;
const pass = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) failed++; };
async function expectReject(name, fn, contains) {
  try { await fn(); pass(name, false, 'accepted'); }
  catch (e) { pass(name, !contains || e.message.includes(contains), e.message.slice(0, 300)); }
}
const make = (set, body) => dv('POST', set, body, { Prefer: 'return=representation' });
const stamp = Date.now();
const me = (await dv('GET', 'WhoAmI')).UserId;

const company = await make('cea_companies', { cea_name: `ZZ Co ${stamp}`, cea_status: 1 });
const region = await make('cea_regions', { cea_name: `ZZ Region ${stamp}`, cea_status: 1, 'cea_CompanyId@odata.bind': `/cea_companies(${company.cea_companyid})` });
const plant = await make('cea_plants', { cea_name: `ZZ Plant ${stamp}`, cea_status: 1, 'cea_RegionId@odata.bind': `/cea_regions(${region.cea_regionid})` });
const bu = async (set, id, k) => (await dv('GET', `${set}(${id})?$select=_cea_businessunitid_value`))._cea_businessunitid_value;
const cBu = await bu('cea_companies', company.cea_companyid), rBu = await bu('cea_regions', region.cea_regionid), pBu = await bu('cea_plants', plant.cea_plantid);

const assign = (buId, role, extra = {}) => make('cea_approverassignments', {
  cea_name: `ZZ ${stamp}`, cea_roletype: role, cea_status: 1,
  'cea_BusinessUnitId@odata.bind': `/businessunits(${buId})`, 'cea_ApproverId@odata.bind': `/systemusers(${me})`, ...extra,
});

await expectReject('Plant Manager on a Region BU is rejected', () => assign(rBu, 1), 'Plant business unit');
await expectReject('Regional Approver on a Plant BU is rejected', () => assign(pBu, 2), 'Region business unit');

const roleRow = (await dv('GET', `roles?$select=roleid&$filter=name eq 'CEA Internal Approvals' and parentroleid eq null`)).value[0];
const hadRole = (await dv('GET', `systemusers(${me})/systemuserroles_association?$select=roleid&$filter=roleid eq ${roleRow.roleid}`)).value.length > 0;
await expectReject('Approver without CEA Internal Approvals role is rejected', async () => { if (hadRole) throw new Error('CEA Internal Approvals role'); await assign(pBu, 1); }, 'CEA Internal Approvals');

if (!hadRole) await dv('POST', `systemusers(${me})/systemuserroles_association/$ref`, { '@odata.id': `${(await import('../../tools/dv.mjs')).ORG}/api/data/v9.2/roles(${roleRow.roleid})` });
const first = await assign(pBu, 1);
pass('Valid Plant Manager assignment is accepted', !!first.cea_approverassignmentid);
await expectReject('Second active assignment for same BU + role is rejected', () => assign(pBu, 1), 'already has an active approver');
await dv('PATCH', `cea_approverassignments(${first.cea_approverassignmentid})`, { cea_status: 2 });
const second = await assign(pBu, 1);
pass('After deactivating, a new active assignment is accepted', !!second.cea_approverassignmentid);

for (const id of [second.cea_approverassignmentid, first.cea_approverassignmentid]) await dv('DELETE', `cea_approverassignments(${id})`).catch(() => {});
if (!hadRole) await dv('DELETE', `systemusers(${me})/systemuserroles_association/$ref?$id=${(await import('../../tools/dv.mjs')).ORG}/api/data/v9.2/roles(${roleRow.roleid})`).catch((e) => console.log('  role cleanup', e.message.slice(0, 120)));
for (const [set, id] of [['cea_plants', plant.cea_plantid], ['cea_regions', region.cea_regionid], ['cea_companies', company.cea_companyid]]) await dv('DELETE', `${set}(${id})`).catch(() => {});
for (const b of [pBu, rBu, cBu]) { await dv('PATCH', `businessunits(${b})`, { isdisabled: true }).catch(() => {}); await dv('DELETE', `businessunits(${b})`).catch(() => {}); }
process.exit(failed ? 1 : 0);

// Web API checks for Spec 001 US2/US3 rules (change history, catalog sync and guards). Run: node tests/api/catalog-rules.mjs
import { dv } from '../../tools/dv.mjs';

let failed = 0;
const pass = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) failed++; };
async function expectReject(name, fn, contains) {
  try { await fn(); pass(name, false, 'accepted'); }
  catch (e) { pass(name, !contains || e.message.includes(contains), e.message.slice(0, 300)); }
}
const idOf = async (set, body) => {
  const r = await dv('POST', set, body, { Prefer: 'return=representation' });
  return r;
};
const stamp = Date.now();

// --- US3: catalog hierarchy, BU sync, guards ---
const company = await idOf('cea_companies', { cea_name: `ZZ Co ${stamp}`, cea_status: 1 });
const cBu = (await dv('GET', `cea_companies(${company.cea_companyid})?$select=_cea_businessunitid_value`))._cea_businessunitid_value;
pass('Company creation links a Business Unit', !!cBu);
const cBuRow = await dv('GET', `businessunits(${cBu})?$select=name,cea_level`);
pass('Company BU has level Company (2)', cBuRow.cea_level === 2);

await expectReject('Region without Company is rejected',
  () => dv('POST', 'cea_regions', { cea_name: `ZZ NoParent ${stamp}`, cea_status: 1 }));
const region = await idOf('cea_regions', { cea_name: `ZZ Region ${stamp}`, cea_status: 1, 'cea_CompanyId@odata.bind': `/cea_companies(${company.cea_companyid})` });
const rBu = (await dv('GET', `cea_regions(${region.cea_regionid})?$select=_cea_businessunitid_value`))._cea_businessunitid_value;
const rBuRow = await dv('GET', `businessunits(${rBu})?$select=cea_level,_parentbusinessunitid_value`);
pass('Region BU is level 3 under the Company BU', rBuRow.cea_level === 3 && rBuRow._parentbusinessunitid_value === cBu);
const plant = await idOf('cea_plants', { cea_name: `ZZ Plant ${stamp}`, cea_status: 1, 'cea_RegionId@odata.bind': `/cea_regions(${region.cea_regionid})` });
const pBu = (await dv('GET', `cea_plants(${plant.cea_plantid})?$select=_cea_businessunitid_value`))._cea_businessunitid_value;
const pBuRow = await dv('GET', `businessunits(${pBu})?$select=cea_level,_parentbusinessunitid_value`);
pass('Plant BU is level 4 under the Region BU', pBuRow.cea_level === 4 && pBuRow._parentbusinessunitid_value === rBu);

await dv('PATCH', `cea_plants(${plant.cea_plantid})`, { cea_name: `ZZ Plant renamed ${stamp}` });
pass('Renaming a Plant renames its Business Unit', (await dv('GET', `businessunits(${pBu})?$select=name`)).name === `ZZ Plant renamed ${stamp}`);

await expectReject('Deleting a Company with Regions is blocked',
  () => dv('DELETE', `cea_companies(${company.cea_companyid})`), 'in use');

await dv('PATCH', `cea_companies(${company.cea_companyid})`, { cea_status: 2 });
await expectReject('Region under an inactive Company is rejected',
  () => dv('POST', 'cea_regions', { cea_name: `ZZ Inactive ${stamp}`, cea_status: 1, 'cea_CompanyId@odata.bind': `/cea_companies(${company.cea_companyid})` }), 'inactive');

// cleanup: leaf to root; catalog rows first, then the disabled Business Units
for (const [set, id] of [['cea_plants', plant.cea_plantid], ['cea_regions', region.cea_regionid], ['cea_companies', company.cea_companyid]]) {
  try { await dv('DELETE', `${set}(${id})`); } catch (e) { console.log('  cleanup', set, e.message.slice(0, 120)); }
}
for (const bu of [pBu, rBu, cBu]) {
  try {
    await dv('PATCH', `businessunits(${bu})`, { isdisabled: true });
    await dv('DELETE', `businessunits(${bu})`);
  } catch (e) { console.log('  cleanup BU', e.message.slice(0, 120)); }
}

// --- US2: change history ---
const me = (await dv('GET', 'WhoAmI')).UserId;
const before = await dv('GET', `systemusers(${me})?$select=cea_department`);
const newDept = `Dept-${stamp}`;
await dv('PATCH', `systemusers(${me})`, { cea_department: newDept });
const recs = (await dv('GET', `cea_userchangerecords?$select=cea_field,cea_oldvalue,cea_newvalue,_cea_changedbyid_value&$filter=_cea_userid_value eq ${me} and cea_newvalue eq '${newDept}'`)).value;
pass('Changing Department writes a User Change Record', recs.length === 1 && recs[0].cea_field === 'cea_department' && recs[0]._cea_changedbyid_value === me);
if (before.cea_department) await dv('PATCH', `systemusers(${me})`, { cea_department: before.cea_department });
process.exit(failed ? 1 : 0);

// Web API checks for Spec 006. Run: node tests/api/submission-rules.mjs
import { dv } from '../../tools/dv.mjs';

let failed = 0;
const pass = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); if (!ok) failed++; };
async function reject(n, fn, has) {
  try { await fn(); pass(n, false, 'accepted'); } catch (e) { pass(n, !has || e.message.includes(has), e.message.slice(0, 300)); }
}
const act = (name, id, extra = {}) => dv('POST', name, { Request: { '@odata.type': 'Microsoft.Dynamics.CRM.cea_request', cea_requestid: id }, ...extra });
const get = (id) => dv('GET', `cea_requests(${id})?$select=cea_status,cea_submittedon,cea_statuschangedon,cea_currentlevel`);

let plant = (await dv('GET', 'cea_plants?$top=1&$select=cea_plantid')).value[0];
const created = [];
if (!plant) {
  const mk = (set, body) => dv('POST', set, body, { Prefer: 'return=representation' });
  const co = await mk('cea_companies', { cea_name: 'ZZ Spec6 Co', cea_status: 1 });
  const rg = await mk('cea_regions', { cea_name: 'ZZ Spec6 Region', cea_status: 1, 'cea_CompanyId@odata.bind': `/cea_companies(${co.cea_companyid})` });
  plant = await mk('cea_plants', { cea_name: 'ZZ Spec6 Plant', cea_status: 1, 'cea_RegionId@odata.bind': `/cea_regions(${rg.cea_regionid})` });
}

const r = await dv('POST', 'cea_requests', { cea_category: 1, cea_currency: 1 }, { Prefer: 'return=representation' });
const id = r.cea_requestid;
await reject('Incomplete request lists the problems', () => act('cea_SubmitRequest', id), 'incomplete');
await reject('Direct status edit is denied', () => dv('PATCH', `cea_requests(${id})`, { cea_status: 3 }), 'request actions');

await dv('PATCH', `cea_requests(${id})`, {
  cea_projectname: 'Test', cea_descriptionsummary: 'x', cea_startdate: '2027-01-01', cea_estimatedcompletiondate: '2027-12-31',
  cea_detaileddescription: 'detail', 'cea_ProjectLocationId@odata.bind': `/cea_plants(${plant.cea_plantid})`,
});
await dv('POST', 'cea_costlines', { cea_description: 'x', cea_group: 1, cea_cost: 100, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });
await dv('POST', 'cea_forecastlines', { cea_year: 2027, cea_month: 1, cea_percentage: 100, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });

await act('cea_SubmitRequest', id);
let s = await get(id);
pass('Submit moves to Pending Initial Review with dates', s.cea_status === 2 && !!s.cea_submittedon && !!s.cea_statuschangedon);
const rev = (await dv('GET', `cea_initialreviews?$filter=_cea_requestid_value eq ${id}&$select=cea_state`)).value;
pass('One Open initial review is created', rev.length === 1 && rev[0].cea_state === 1);
await reject('Double submit is rejected', () => act('cea_SubmitRequest', id), 'not in Draft');
await reject('Return without comments is rejected', () => act('cea_ReturnToCreator', id, { Comments: '  ' }), 'Comments are required');

await act('cea_ReturnToCreator', id, { Comments: 'Please add detail' });
s = await get(id);
pass('Return sets Returned to Creator', s.cea_status === 9);
await reject('Closed review cannot be returned again', () => act('cea_ReturnToCreator', id, { Comments: 'again' }), 'already closed');
await dv('PATCH', `cea_requests(${id})`, { cea_projectname: 'Test 2' });
pass('Creator can edit after return', true);

await act('cea_ResubmitRequest', id);
const revs = (await dv('GET', `cea_initialreviews?$filter=_cea_requestid_value eq ${id}&$select=cea_state`)).value;
pass('Resubmit creates a new Open review', revs.length === 2 && revs.filter((x) => x.cea_state === 1).length === 1);
await reject('Release is blocked when no approver is resolvable (names the level)', () => act('cea_ReleaseToApproval', id), 'level');

try { await dv('DELETE', `cea_requests(${id})`); console.log('cleanup ok'); } catch (e) { console.log('  cleanup', e.message.slice(0, 200)); }
for (const p of created) await dv('DELETE', `cea_plants(${p})`).catch(() => {});
process.exit(failed ? 1 : 0);

// Web API checks for Spec 006 T022/T028. Run: node tests/api/initial-review-concurrency.mjs
import { dv } from '../../tools/dv.mjs';

let failed = 0;
const pass = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); if (!ok) failed++; };
const act = (name, id, extra = {}) => dv('POST', name, { Request: { '@odata.type': 'Microsoft.Dynamics.CRM.cea_request', cea_requestid: id }, ...extra });

const plant = (await dv('GET', 'cea_plants?$top=1&$select=cea_plantid')).value[0];
const r = await dv('POST', 'cea_requests', { cea_category: 1, cea_currency: 1 }, { Prefer: 'return=representation' });
const id = r.cea_requestid;
await dv('PATCH', `cea_requests(${id})`, {
  cea_projectname: 'Test', cea_descriptionsummary: 'x', cea_startdate: '2027-01-01', cea_estimatedcompletiondate: '2027-12-31',
  cea_detaileddescription: 'detail', 'cea_ProjectLocationId@odata.bind': `/cea_plants(${plant.cea_plantid})`,
});
await dv('POST', 'cea_costlines', { cea_description: 'x', cea_group: 1, cea_cost: 100, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });
await dv('POST', 'cea_forecastlines', { cea_year: 2027, cea_month: 1, cea_percentage: 100, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });

const dbl = await Promise.allSettled([act('cea_SubmitRequest', id), act('cea_SubmitRequest', id)]);
pass('Double submit: exactly one succeeds', dbl.filter((x) => x.status === 'fulfilled').length === 1, JSON.stringify(dbl.map((x) => x.status)));
const revs = (await dv('GET', `cea_initialreviews?$filter=_cea_requestid_value eq ${id}&$select=cea_state`)).value;
pass('Double submit leaves a single Open review', revs.length === 1 && revs[0].cea_state === 1);

const msg = 'No active approver found for level Plant Manager. Assign one before releasing the request.';
try { await act('cea_ReleaseToApproval', id); pass('Release is blocked', false, 'accepted'); } catch (e) { pass('Release is blocked', true); }
await act('cea_NotifyReleaseBlocked', id, { Comments: msg });
const n = (await dv('GET', `cea_notificationrequests?$filter=_cea_requestid_value eq ${id} and cea_eventtype eq 11&$select=cea_comments,cea_recipientgroup`)).value;
pass('Blocked release notifies the Administrators with the missing level', n.length === 1 && n[0].cea_recipientgroup === 1 && (n[0].cea_comments || '').includes('Plant Manager'), JSON.stringify(n));

const two = await Promise.allSettled([act('cea_ReturnToCreator', id, { Comments: 'A' }), act('cea_ReturnToCreator', id, { Comments: 'B' })]);
pass('Two closing actions: first wins, second is rejected', two.filter((x) => x.status === 'fulfilled').length === 1, JSON.stringify(two.map((x) => x.status)));
const rv = (await dv('GET', `cea_initialreviews?$filter=_cea_requestid_value eq ${id}&$select=cea_state`)).value;
pass('Review is closed once', rv.filter((x) => x.cea_state !== 1).length === 1);

try { await dv('DELETE', `cea_requests(${id})`); console.log('cleanup ok'); } catch (e) { console.log('  cleanup', e.message.slice(0, 200)); }
process.exit(failed ? 1 : 0);

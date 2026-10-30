// Web API checks for Spec 010. Run: node tests/api/final-processing-rules.mjs
import { dv } from '../../tools/dv.mjs';

let failed = 0;
const pass = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); if (!ok) failed++; };
async function reject(n, fn, has) {
  try { await fn(); pass(n, false, 'accepted'); } catch (e) { pass(n, !has || e.message.includes(has), e.message.slice(0, 300)); }
}
const act = (name, id, extra = {}) => dv('POST', name, { Request: { '@odata.type': 'Microsoft.Dynamics.CRM.cea_request', cea_requestid: id }, ...extra });
const me = (await dv('GET', 'WhoAmI')).UserId;
const plant = (await dv('GET', 'cea_plants?$top=1&$select=cea_plantid')).value[0];
const step = (await dv('GET', "sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid&$filter=name eq 'CEA RequestRules: Update'")).value[0].sdkmessageprocessingstepid;
const setStep = (state) => dv('PATCH', `sdkmessageprocessingsteps(${step})`, { statecode: state, statuscode: state === 0 ? 1 : 2 });
const file = (id, name, pkg) => dv('POST', 'cea_requestattachments', { cea_filename: name, cea_size: 100, cea_package: pkg, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });
let id;
try {
  id = (await dv('POST', 'cea_requests', { cea_category: 1, cea_currency: 1 }, { Prefer: 'return=representation' })).cea_requestid;
  await dv('PATCH', `cea_requests(${id})`, {
    cea_projectname: 'Final test', cea_descriptionsummary: 'x', cea_startdate: '2027-01-01', cea_estimatedcompletiondate: '2027-12-31',
    cea_detaileddescription: 'detail', 'cea_ProjectLocationId@odata.bind': `/cea_plants(${plant.cea_plantid})`,
  });
  const line = (await dv('POST', 'cea_costlines', { cea_description: 'x', cea_group: 1, cea_cost: 100, 'cea_RequestId@odata.bind': `/cea_requests(${id})` }, { Prefer: 'return=representation' })).cea_costlineid;

  await reject('Final file is rejected before Final Processing', () => file(id, 'early.pdf', 2), 'Final Processing');
  await reject('Complete is rejected when not in Final Processing', () => act('cea_CompleteRequest', id, { Confirmation: true }), 'not in Final Processing');

  await setStep(1);
  await dv('PATCH', `cea_requests(${id})`, { cea_status: 10 });
  await setStep(0);
  await reject('Complete without confirmation is rejected', () => act('cea_CompleteRequest', id, { Confirmation: false }), 'Confirmation');
  await file(id, 'final.pdf', 2);
  await file(id, 'creator.pdf', 1);
  const fin = (await dv('GET', `cea_requestattachments?$filter=_cea_requestid_value eq ${id} and cea_package eq 2&$select=cea_filename`)).value;
  pass('Final package file stored separately', fin.length === 1 && fin[0].cea_filename === 'final.pdf', JSON.stringify(fin));
  await reject('Disallowed final file type rejected', () => file(id, 'bad.exe', 2), 'not allowed');

  await dv('PATCH', `cea_requests(${id})`, { cea_projectname: 'Final test corrected' });
  await dv('PATCH', `cea_costlines(${line})`, { cea_cost: 150 });
  const rec = (await dv('GET', `cea_datacorrectionrecords?$filter=_cea_requestid_value eq ${id}&$select=cea_field,cea_oldvalue,cea_newvalue,_cea_changedbyid_value`)).value;
  pass('Request correction logged with old/new value and user', rec.some((r) => r.cea_field === 'cea_request.cea_projectname' && r.cea_oldvalue === 'Final test' && r.cea_newvalue === 'Final test corrected' && r._cea_changedbyid_value === me), JSON.stringify(rec));
  pass('Cost line correction logged', rec.some((r) => r.cea_field === 'cea_costline.cea_cost'), JSON.stringify(rec));

  await act('cea_CompleteRequest', id, { Confirmation: true });
  const done = await dv('GET', `cea_requests(${id})?$select=cea_status,cea_completedon,_cea_completedbyid_value`);
  pass('Completed sets status, Completed By and On', done.cea_status === 7 && !!done.cea_completedon && done._cea_completedbyid_value === me, JSON.stringify(done));
  await reject('Second completion is rejected', () => act('cea_CompleteRequest', id, { Confirmation: true }), 'already completed');
  await reject('Request edit after completion is rejected', () => dv('PATCH', `cea_requests(${id})`, { cea_projectname: 'x' }), 'Completed');
  await reject('Cost line edit after completion is rejected', () => dv('PATCH', `cea_costlines(${line})`, { cea_cost: 1 }), 'Completed');
  await reject('Cost line delete after completion is rejected', () => dv('DELETE', `cea_costlines(${line})`), 'Completed');
  await reject('Final file after completion is rejected', () => file(id, 'late.pdf', 2), 'Completed');
  const q = (await dv('GET', `cea_notificationrequests?$filter=_cea_requestid_value eq ${id} and cea_eventtype eq 8&$select=cea_recipientgroup`)).value;
  pass('Creator is notified of completion', q.length === 1 && q[0].cea_recipientgroup === 2, JSON.stringify(q));
} finally {
  try { await setStep(0); } catch { /* ignore */ }
  if (id) {
    const lock = (await dv('GET', "sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid&$filter=name eq 'CEA CompletedLockGuard: Delete of cea_request'")).value[0].sdkmessageprocessingstepid;
    try {
      await dv('PATCH', `sdkmessageprocessingsteps(${lock})`, { statecode: 1, statuscode: 2 });
      await dv('DELETE', `cea_requests(${id})`);
    } catch (e) { console.log('cleanup:', e.message.slice(0, 120)); }
    finally { await dv('PATCH', `sdkmessageprocessingsteps(${lock})`, { statecode: 0, statuscode: 1 }); }
  }
}
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);

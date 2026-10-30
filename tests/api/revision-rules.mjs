// Web API checks for Spec 008. Run: node tests/api/revision-rules.mjs
// A pending-approval chain is seeded with the RequestRules update step disabled; the real actions do the rest.
import { dv } from '../../tools/dv.mjs';

let failed = 0;
const pass = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); if (!ok) failed++; };
async function reject(n, fn, has) {
  try { await fn(); pass(n, false, 'accepted'); } catch (e) { pass(n, !has || e.message.includes(has), e.message.slice(0, 300)); }
}
const act = (name, id, extra = {}, caller) => dv('POST', name, { Request: { '@odata.type': 'Microsoft.Dynamics.CRM.cea_request', cea_requestid: id }, ...extra }, caller ? { MSCRMCallerID: caller } : {});
const get = (id) => dv('GET', `cea_requests(${id})?$select=cea_status,cea_cycle`);
const cycles = async (id) => (await dv('GET', `cea_revisioncycles?$filter=_cea_requestid_value eq ${id}&$orderby=cea_cycle`)).value;

const me = (await dv('GET', 'WhoAmI')).UserId;
const other = (await dv('GET', `systemusers?$select=systemuserid&$filter=fullname eq '${encodeURIComponent('# Flow-CDSNativeConnectorUS')}'`)).value[0].systemuserid;
const plant = (await dv('GET', 'cea_plants?$top=1&$select=cea_plantid')).value[0];
const step = (await dv('GET', "sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid&$filter=name eq 'CEA RequestRules: Update'")).value[0].sdkmessageprocessingstepid;
const setStep = (state) => dv('PATCH', `sdkmessageprocessingsteps(${step})`, { statecode: state, statuscode: state === 0 ? 1 : 2 });
let id;
try {
  id = (await dv('POST', 'cea_requests', { cea_category: 1, cea_currency: 1 }, { Prefer: 'return=representation' })).cea_requestid;
  await reject('Resubmit of a Draft request is rejected', () => act('cea_ResubmitRequest', id), 'not Returned');
  await dv('PATCH', `cea_requests(${id})`, {
    cea_projectname: 'Revision test', cea_descriptionsummary: 'x', cea_startdate: '2027-01-01', cea_estimatedcompletiondate: '2027-12-31',
    cea_detaileddescription: 'detail', 'cea_ProjectLocationId@odata.bind': `/cea_plants(${plant.cea_plantid})`,
  });
  await dv('POST', 'cea_costlines', { cea_description: 'x', cea_group: 1, cea_cost: 100, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });
  await dv('POST', 'cea_forecastlines', { cea_year: 2027, cea_month: 1, cea_percentage: 100, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });

  // Seed: Pending Approval with one step pending for me, then reject it through the real action.
  await setStep(1);
  await dv('PATCH', `cea_requests(${id})`, { cea_status: 3, cea_currentlevel: 1, cea_cycle: 1, 'cea_PendingApproverId@odata.bind': `/systemusers(${other})` });
  await dv('POST', 'cea_resolvedapprovers', { cea_name: 'T-1', cea_level: 1, cea_stepstatus: 1, cea_decided: false, 'cea_ApproverId@odata.bind': `/systemusers(${other})`, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });
  await setStep(0);
  await act('cea_RejectStep', id, { Comments: 'Budget unclear' }, other);
  let s = await get(id), c = await cycles(id);
  pass('Rejection returns the request and opens cycle row 1', s.cea_status === 9 && c.length === 1 && c[0].cea_cycle === 1 && c[0].cea_rejectioncomments === 'Budget unclear' && !!c[0].cea_rejectedon, JSON.stringify([s, c]));

  await reject('Initial Submit of a Returned request is rejected', () => act('cea_SubmitRequest', id), 'not in Draft');
  await act('cea_ResubmitRequest', id, { CorrectionNote: 'Added detail' });
  s = await get(id); c = await cycles(id);
  const rev = (await dv('GET', `cea_initialreviews?$filter=_cea_requestid_value eq ${id} and cea_state eq 1&$select=cea_reviewtype`)).value;
  pass('Resubmit moves to Revision Review with an Open Revision review', s.cea_status === 5 && rev.length === 1 && rev[0].cea_reviewtype === 2, JSON.stringify([s, rev]));
  pass('Cycle row records resubmission and correction note', !!c[0].cea_resubmittedon && c[0].cea_correctionnote === 'Added detail', JSON.stringify(c));
  await reject('Double resubmit is rejected', () => act('cea_ResubmitRequest', id), 'not Returned');

  await reject('Release is blocked when no approver is resolvable; request stays in review', () => act('cea_ReleaseToApproval', id), 'level');
  s = await get(id); c = await cycles(id);
  pass('Blocked release leaves Revision Review and no outcome', s.cea_status === 5 && c[0].cea_reviewoutcome === null, JSON.stringify([s, c]));
  await reject('Return without comments is rejected', () => act('cea_ReturnToCreator', id, { Comments: ' ' }), 'Comments are required');
  await act('cea_ReturnToCreator', id, { Comments: 'Still missing quotes' });
  s = await get(id); c = await cycles(id);
  pass('Return sets Returned to Creator and outcome Returned', s.cea_status === 9 && c[0].cea_reviewoutcome === 2 && c[0]._cea_reviewedbyid_value === me, JSON.stringify([s, c]));
  await act('cea_ResubmitRequest', id);
  pass('Creator can resubmit again (no cycle limit)', (await get(id)).cea_status === 5);

  // Hold resume: an administrator reassigns a held request to an active user.
  await setStep(1);
  await dv('PATCH', `cea_requests(${id})`, { cea_status: 8 });
  await setStep(0);
  await dv('POST', 'Assign', { Target: { '@odata.type': 'Microsoft.Dynamics.CRM.cea_request', cea_requestid: id }, Assignee: { '@odata.type': 'Microsoft.Dynamics.CRM.systemuser', systemuserid: me } });
  pass('Reassigning a held request to an active Creator resumes it as Returned', (await get(id)).cea_status === 9);
} finally {
  await setStep(0).catch(() => {});
  if (id) await dv('DELETE', `cea_requests(${id})`).catch((e) => console.log('  cleanup', e.message.slice(0, 150)));
}
process.exit(failed ? 1 : 0);

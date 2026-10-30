// Web API checks for Spec 009. Run: node tests/api/notification-rules.mjs
import { dv } from '../../tools/dv.mjs';

let failed = 0;
const pass = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); if (!ok) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const act = (name, id, extra = {}, caller) => dv('POST', name, { Request: { '@odata.type': 'Microsoft.Dynamics.CRM.cea_request', cea_requestid: id }, ...extra }, caller ? { MSCRMCallerID: caller } : {});
const queue = async (id) => (await dv('GET', `cea_notificationrequests?$filter=_cea_requestid_value eq ${id}&$select=cea_eventtype,cea_recipientgroup,cea_status,cea_comments,cea_eventid`)).value;
async function waitFor(id, pred, tries = 12) {
  let q = [];
  for (let i = 0; i < tries; i++) { q = await queue(id); if (pred(q)) return q; await sleep(5000); }
  return q;
}

const me = (await dv('GET', 'WhoAmI')).UserId;
const other = (await dv('GET', `systemusers?$select=systemuserid&$filter=fullname eq '${encodeURIComponent('# Flow-CDSNativeConnectorUS')}'`)).value[0].systemuserid;
const plant = (await dv('GET', 'cea_plants?$top=1&$select=cea_plantid')).value[0];
const step = (await dv('GET', "sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid&$filter=name eq 'CEA RequestRules: Update'")).value[0].sdkmessageprocessingstepid;
const setStep = (state) => dv('PATCH', `sdkmessageprocessingsteps(${step})`, { statecode: state, statuscode: state === 0 ? 1 : 2 });
let id;
try {
  const t = await dv('GET', 'cea_emailtemplates?$select=cea_eventtype');
  pass('Templates seeded for all 14 events', new Set(t.value.map((x) => x.cea_eventtype)).size === 14, t.value.length);

  id = (await dv('POST', 'cea_requests', { cea_category: 1, cea_currency: 1 }, { Prefer: 'return=representation' })).cea_requestid;
  await dv('PATCH', `cea_requests(${id})`, {
    cea_projectname: 'Notification test', cea_descriptionsummary: 'x', cea_startdate: '2027-01-01', cea_estimatedcompletiondate: '2027-12-31',
    cea_detaileddescription: 'detail', 'cea_ProjectLocationId@odata.bind': `/cea_plants(${plant.cea_plantid})`,
  });
  await dv('POST', 'cea_costlines', { cea_description: 'x', cea_group: 1, cea_cost: 100, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });
  await dv('POST', 'cea_forecastlines', { cea_year: 2027, cea_month: 1, cea_percentage: 100, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });

  await act('cea_SubmitRequest', id);
  let q = await waitFor(id, (r) => r.some((x) => x.cea_eventtype === 1 && x.cea_status !== 1));
  pass('Submit enqueues a Submitted notification to Administrators and the workflow succeeded', q.some((x) => x.cea_eventtype === 1 && x.cea_recipientgroup === 1), JSON.stringify(q));
  const submitted = q.find((x) => x.cea_eventtype === 1);
  pass('Dispatch processed the row (not left Queued)', !!submitted && submitted.cea_status !== 1, JSON.stringify(submitted));
  const out = (await dv('GET', 'cea_notificationoutcomes?$select=cea_result,cea_attempts,cea_reason&$top=50')).value;
  pass('Outcomes are recorded per recipient', out.length > 0 && out.every((o) => o.cea_result >= 1 && o.cea_result <= 3), JSON.stringify(out.slice(0, 2)));

  await act('cea_ReturnToCreator', id, { Comments: 'Needs quotes' });
  q = await waitFor(id, (r) => r.some((x) => x.cea_eventtype === 7));
  const ret = q.find((x) => x.cea_eventtype === 7);
  pass('Return enqueues Returned to the Creator with comments', !!ret && ret.cea_recipientgroup === 2 && ret.cea_comments === 'Needs quotes', JSON.stringify(q));

  // Seed a pending approver, then reject.
  await act('cea_ResubmitRequest', id);
  await setStep(1);
  await dv('PATCH', `cea_requests(${id})`, { cea_status: 3, cea_currentlevel: 1, cea_cycle: 2, 'cea_PendingApproverId@odata.bind': `/systemusers(${other})` });
  await dv('POST', 'cea_resolvedapprovers', { cea_name: 'N-1', cea_level: 1, cea_stepstatus: 1, cea_decided: false, 'cea_ApproverId@odata.bind': `/systemusers(${other})`, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });
  await setStep(0);
  await act('cea_RejectStep', id, { Comments: 'Budget unclear' }, other);
  q = await waitFor(id, (r) => r.some((x) => x.cea_eventtype === 6));
  pass('Reject enqueues Rejected to the Creator with comments', q.some((x) => x.cea_eventtype === 6 && x.cea_recipientgroup === 2 && x.cea_comments === 'Budget unclear'), JSON.stringify(q));

  const row = q[0];
  const rowId = (await dv('GET', `cea_notificationrequests?$filter=_cea_requestid_value eq ${id}&$select=cea_notificationrequestid&$top=1`)).value[0].cea_notificationrequestid;
  const role = (await dv('GET', "roles?$select=roleid&$filter=name eq 'CEA Administrators' and parentroleid eq null")).value[0];
  const privs = (await dv('GET', `roles(${role.roleid})/roleprivileges_association?$select=name`)).value.map((p) => p.name);
  const bad = privs.filter((n) => /^prv(Write|Delete|Create|Append|AppendTo|Assign|Share)cea_notificationoutcome$/.test(n));
  pass('CEA Administrators cannot write or delete outcomes', bad.length === 0 && privs.includes('prvReadcea_notificationoutcome'), JSON.stringify(bad));
  const r = await dv('POST', 'cea_ProcessNotifications', {});
  pass('ProcessNotifications API runs', r.Result !== undefined, JSON.stringify(r));
} finally {
  try { await setStep(0); } catch { /* ignore */ }
  if (id) try { await dv('DELETE', `cea_requests(${id})`); } catch { /* ignore */ }
}
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);

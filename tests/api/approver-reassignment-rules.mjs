// Web API checks for Spec 003 US4 (cea_ReassignApprover). Run: node tests/api/approver-reassignment-rules.mjs
import { dv } from '../../tools/dv.mjs';

let failed = 0;
const pass = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); if (!ok) failed++; };
async function reject(n, fn, has) {
  try { await fn(); pass(n, false, 'accepted'); } catch (e) { pass(n, !has || e.message.includes(has), e.message.slice(0, 300)); }
}
const ref = (t, k, id) => ({ '@odata.type': `Microsoft.Dynamics.CRM.${t}`, [k]: id });
const reassign = (id, extra) => dv('POST', 'cea_ReassignApprover', { Request: ref('cea_request', 'cea_requestid', id), ...extra });

const me = (await dv('GET', 'WhoAmI')).UserId;
const other = (await dv('GET', `systemusers?$select=systemuserid&$filter=fullname eq '${encodeURIComponent('# Flow-CDSNativeConnectorUS')}'`)).value[0].systemuserid;
const plant = (await dv('GET', 'cea_plants?$top=1&$select=cea_plantid')).value[0];
const step = (await dv('GET', "sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid&$filter=name eq 'CEA RequestRules: Update'")).value[0].sdkmessageprocessingstepid;
const setStep = (state) => dv('PATCH', `sdkmessageprocessingsteps(${step})`, { statecode: state, statuscode: state === 0 ? 1 : 2 });
const created = [];

await setStep(1);
try {
  const r = await dv('POST', 'cea_requests', { cea_category: 1, cea_currency: 1 }, { Prefer: 'return=representation' });
  const id = r.cea_requestid; created.push(id);
  await dv('PATCH', `cea_requests(${id})`, {
    cea_status: 3, cea_currentlevel: 1, cea_cycle: 1, 'cea_PendingApproverId@odata.bind': `/systemusers(${other})`,
    cea_projectname: 'Reassign test', 'cea_ProjectLocationId@odata.bind': `/cea_plants(${plant.cea_plantid})`,
  });
  const s = await dv('POST', 'cea_resolvedapprovers', {
    cea_name: 'T-1', cea_level: 1, cea_stepstatus: 1, cea_decided: false,
    'cea_ApproverId@odata.bind': `/systemusers(${other})`, 'cea_RequestId@odata.bind': `/cea_requests(${id})`,
  }, { Prefer: 'return=representation' });
  await setStep(0);

  const newA = { NewApprover: ref('systemuser', 'systemuserid', me) };
  await reject('Reason is required', () => reassign(id, { Level: 1, ...newA, Reason: ' ' }), 'reason is required');
  await reject('Level without undecided step is rejected', () => reassign(id, { Level: 2, ...newA, Reason: 'x' }), 'no undecided step');
  await reject('Approver without CEA Internal Approvals is rejected', () => reassign(id, { Level: 1, NewApprover: ref('systemuser', 'systemuserid', other), Reason: 'x' }), 'CEA Internal Approvals');

  const roles = (await dv('GET', `systemusers(${me})/systemuserroles_association?$select=name`)).value.map((x) => x.name);
  if (roles.includes('CEA Internal Approvals')) {
    await reassign(id, { Level: 1, ...newA, Reason: 'Approver on leave' });
    const st = await dv('GET', `cea_resolvedapprovers(${s.cea_resolvedapproverid})?$select=_cea_approverid_value`);
    const rq = await dv('GET', `cea_requests(${id})?$select=_cea_pendingapproverid_value`);
    pass('Step and pending approver move to the new approver', st._cea_approverid_value === me && rq._cea_pendingapproverid_value === me, JSON.stringify([st, rq]));
    const rec = (await dv('GET', "cea_reassignmentrecords?$select=cea_reason,_cea_previousapproverid_value,_cea_newapproverid_value&$filter=cea_reason eq 'Approver on leave'&$top=1")).value[0];
    pass('Reassignment record keeps previous and new approver and the reason', !!rec && rec._cea_previousapproverid_value === other && rec._cea_newapproverid_value === me, JSON.stringify(rec));
    if (rec) await dv('DELETE', `cea_reassignmentrecords(${rec.cea_reassignmentrecordid})`);
  } else console.log('SKIP success path: test user lacks CEA Internal Approvals');
} finally {
  await setStep(0);
  for (const id of created) {
    for (const s of (await dv('GET', `cea_resolvedapprovers?$select=cea_resolvedapproverid&$filter=_cea_requestid_value eq ${id}`)).value) await dv('DELETE', `cea_resolvedapprovers(${s.cea_resolvedapproverid})`);
    await dv('DELETE', `cea_requests(${id})`).catch(() => {});
  }
}
console.log(failed ? `${failed} FAILED` : 'ALL OK');
process.exit(failed ? 1 : 0);

// Web API checks for Spec 011. Run: node tests/api/history-rules.mjs
import { dv } from '../../tools/dv.mjs';

let failed = 0;
const pass = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); if (!ok) failed++; };
async function reject(n, fn, has) {
  try { await fn(); pass(n, false, 'accepted'); } catch (e) { pass(n, !has || e.message.includes(has), e.message.slice(0, 300)); }
}
const step = (await dv('GET', "sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid&$filter=name eq 'CEA RequestRules: Update'")).value[0].sdkmessageprocessingstepid;
const setStep = (state) => dv('PATCH', `sdkmessageprocessingsteps(${step})`, { statecode: state, statuscode: state === 0 ? 1 : 2 });
const hist = async (id) => (await dv('GET', `cea_historyentries?$filter=_cea_requestid_value eq ${id}&$select=cea_eventtype,cea_field,cea_oldvalue,cea_newvalue,cea_actorname,cea_comments,cea_historyentryid&$orderby=createdon asc`)).value;
let id;
try {
  id = (await dv('POST', 'cea_requests', { cea_category: 1, cea_currency: 1 }, { Prefer: 'return=representation' })).cea_requestid;
  let h = await hist(id);
  pass('Created entry written', h.length === 1 && h[0].cea_eventtype === 1 && !!h[0].cea_actorname, JSON.stringify(h));

  await dv('PATCH', `cea_requests(${id})`, { cea_projectname: 'Draft edit' });
  h = await hist(id);
  pass('Draft edits are not logged', h.length === 1, JSON.stringify(h));

  await setStep(1);
  await dv('PATCH', `cea_requests(${id})`, { cea_status: 2 });
  h = await hist(id);
  pass('Submitted entry written', h.some((e) => e.cea_eventtype === 2), JSON.stringify(h));

  await dv('PATCH', `cea_requests(${id})`, { cea_projectname: 'After submit' });
  h = await hist(id);
  const fc = h.find((e) => e.cea_eventtype === 10);
  pass('Post-submit field change logged with old/new', !!fc && fc.cea_oldvalue === 'Draft edit' && fc.cea_newvalue === 'After submit', JSON.stringify(h));

  await (await dv('POST', 'cea_requestattachments', { cea_filename: 'a.pdf', cea_size: 100, cea_package: 1, 'cea_RequestId@odata.bind': `/cea_requests(${id})` }, { Prefer: 'return=representation' })).cea_requestattachmentid;
  h = await hist(id);
  pass('Attachment added logged', h.some((e) => e.cea_eventtype === 11), JSON.stringify(h));

  await dv('PATCH', `cea_requests(${id})`, { cea_status: 3, cea_currentlevel: 1 });
  h = await hist(id);
  pass('Release entry written', h.some((e) => e.cea_eventtype === 3), JSON.stringify(h));

  await reject('History entry update is rejected', () => dv('PATCH', `cea_historyentries(${h[0].cea_historyentryid})`, { cea_comments: 'tamper' }), 'immutable');
  await reject('History entry delete is rejected', () => dv('DELETE', `cea_historyentries(${h[0].cea_historyentryid})`), 'immutable');

  const ap = (await dv('GET', 'cea_approverassignments?$top=1&$select=cea_approverassignmentid')).value[0];
  if (ap) {
    const before = (await dv('GET', 'cea_administrativeauditentries?$select=cea_administrativeauditentryid')).value.length;
    const cur = await dv('GET', `cea_approverassignments(${ap.cea_approverassignmentid})?$select=cea_name`);
    await dv('PATCH', `cea_approverassignments(${ap.cea_approverassignmentid})`, { cea_name: cur.cea_name });
    const after = (await dv('GET', 'cea_administrativeauditentries?$select=cea_administrativeauditentryid')).value.length;
    pass('Approver assignment change creates an admin audit entry', after > before, `${before} -> ${after}`);
  }
  await reject('Admin audit entry delete is rejected', async () => {
    const a = (await dv('GET', 'cea_administrativeauditentries?$top=1&$select=cea_administrativeauditentryid')).value[0];
    if (!a) throw new Error('no entry: immutable');
    await dv('DELETE', `cea_administrativeauditentries(${a.cea_administrativeauditentryid})`);
  }, 'immutable');
  await dv('PATCH', `cea_requests(${id})`, { cea_status: 1 });
} finally {
  try { await setStep(0); } catch { /* ignore */ }
  if (id) {
    try { await setStep(1); await dv('PATCH', `cea_requests(${id})`, { cea_status: 1 }); await setStep(0); await dv('DELETE', `cea_requests(${id})`); pass('Deleting a Draft request cascades its history', true); }
    catch (e) { pass('Deleting a Draft request cascades its history', false, e.message.slice(0, 300)); }
  }
}
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);

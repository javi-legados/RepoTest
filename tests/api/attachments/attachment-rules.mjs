// Web API checks for Spec 005. Run: node tests/api/attachments/attachment-rules.mjs
import { dv } from '../../../tools/dv.mjs';

let failed = 0;
const pass = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); if (!ok) failed++; };
async function reject(n, fn, has) {
  try { await fn(); pass(n, false, 'accepted'); } catch (e) { pass(n, !has || e.message.includes(has), e.message.slice(0, 250)); }
}
const req = await dv('POST', 'cea_requests', { cea_category: 1, cea_currency: 1 }, { Prefer: 'return=representation' });
const id = req.cea_requestid;
const add = (name, extra = {}) => dv('POST', 'cea_requestattachments', { cea_filename: name, cea_size: 1000, 'cea_RequestId@odata.bind': `/cea_requests(${id})`, ...extra }, { Prefer: 'return=representation' });

const a = await add('plan.PDF');
pass('Valid file attaches and auto-fills type/uploader/date', a.cea_type === 'pdf' && !!a._cea_uploadedbyid_value && !!a.cea_uploadedon && a.cea_package === 1);
await reject('Disallowed type is rejected', () => add('virus.exe'), 'not allowed');
await reject('Oversize file is rejected', () => add('big.zip', { cea_size: 26 * 1024 * 1024 }), '25 MB');
await reject('Duplicate name is rejected', () => add('PLAN.pdf'), 'already exists');
const mixed = await Promise.allSettled([add('ok1.png'), add('bad.bat'), add('ok2.csv')]);
pass('Mixed batch: valid attach, invalid rejected', mixed.filter((m) => m.status === 'fulfilled').length === 2 && mixed[1].status === 'rejected');
for (let i = 0; i < 17; i++) await add(`f${i}.txt`);
await reject('21st file is rejected', () => add('extra.txt'), 'at most 20');
const fin = await add('final.pdf', { cea_package: 2 });
pass('Final package counted separately (admin)', fin.cea_package === 2);
await reject('Administrator cannot remove attachments (create/read only)', () => dv('DELETE', `cea_requestattachments(${a.cea_requestattachmentid})`), 'not allowed');

try { await dv('DELETE', `cea_requests(${id})`); const left = (await dv('GET', `cea_requestattachments?$filter=_cea_requestid_value eq ${id}&$select=cea_requestattachmentid`)).value.length; pass('Deleting the request deletes attachments', left === 0); }
catch (e) { pass('Deleting the request deletes attachments', false, e.message.slice(0, 200)); }
process.exit(failed ? 1 : 0);

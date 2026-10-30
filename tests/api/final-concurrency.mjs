// Spec 010 T013: optimistic concurrency (row version). Run: node tests/api/final-concurrency.mjs
import { dv } from '../../tools/dv.mjs';

let failed = 0;
const pass = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); if (!ok) failed++; };
let id;
try {
  id = (await dv('POST', 'cea_requests', { cea_category: 1, cea_currency: 1 }, { Prefer: 'return=representation' })).cea_requestid;
  const first = (await dv('GET', `cea_requests(${id})?$select=cea_projectname`))['@odata.etag'];
  await dv('PATCH', `cea_requests(${id})`, { cea_projectname: 'Admin A' }, { 'If-Match': first });
  pass('Update with current row version succeeds', true);
  try { await dv('PATCH', `cea_requests(${id})`, { cea_projectname: 'Admin B' }, { 'If-Match': first }); pass('Stale update is rejected', false, 'accepted'); }
  catch (e) { pass('Stale update is rejected', /412|precondition|version/i.test(e.message), e.message.slice(0, 200)); }
  const cur = await dv('GET', `cea_requests(${id})?$select=cea_projectname`);
  pass('Stale update did not change data', cur.cea_projectname === 'Admin A', cur.cea_projectname);
} finally {
  if (id) await dv('DELETE', `cea_requests(${id})`).catch(() => {});
}
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);

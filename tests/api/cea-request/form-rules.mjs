// Web API checks for Spec 004 (form rules and calculations). Run: node tests/api/cea-request/form-rules.mjs
import { dv } from '../../../tools/dv.mjs';

let failed = 0;
const pass = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) failed++; };
async function expectReject(name, fn, contains) {
  try { await fn(); pass(name, false, 'accepted'); }
  catch (e) { pass(name, !contains || e.message.includes(contains), e.message.slice(0, 300)); }
}
const make = (set, body) => dv('POST', set, body, { Prefer: 'return=representation' });
const get = (id, sel) => dv('GET', `cea_requests(${id})?$select=${sel}`);

const r = await make('cea_requests', { cea_category: 3, cea_currency: 1, cea_supplemental: false });
const id = r.cea_requestid;
const row = await get(id, 'cea_requestnumber,cea_status,cea_projectmanager,cea_date,cea_grandtotal');
pass('Request ID is generated', /^CEA-\d{6}$/.test(row.cea_requestnumber), row.cea_requestnumber);
pass('Status defaults to Draft', row.cea_status === 1);
pass('Requester data is filled from the Creator', !!row.cea_projectmanager && !!row.cea_date);
const others = (await dv('GET', `cea_costlines?$select=cea_description&$filter=_cea_requestid_value eq ${id} and cea_group eq 5`)).value;
pass('Others group is pre-filled with 6 lines', others.length === 6);

await expectReject('Negative cost is rejected', () => make('cea_costlines', { cea_description: 'x', cea_group: 1, cea_cost: -1, 'cea_RequestId@odata.bind': `/cea_requests(${id})` }));
const l1 = await make('cea_costlines', { cea_description: 'Pump', cea_group: 3, cea_cost: 1000.5, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });
const l2 = await make('cea_costlines', { cea_description: 'Wall', cea_group: 1, cea_cost: 500, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });
let t = await get(id, 'cea_subtotal1,cea_subtotal3,cea_grandtotal');
pass('Subtotals and Grand Total are calculated', t.cea_subtotal3 === 1000.5 && t.cea_subtotal1 === 500 && t.cea_grandtotal === 1500.5, JSON.stringify(t));

const fl = (year, month, pct) => make('cea_forecastlines', { cea_year: year, cea_month: month, cea_percentage: pct, 'cea_RequestId@odata.bind': `/cea_requests(${id})` });
const f1 = await fl(2027, 1, 60);
await expectReject('Duplicate year/month is rejected', () => fl(2027, 1, 10), 'already exists');
await fl(2027, 2, 30);
t = await get(id, 'cea_forecastcalculated,cea_forecastpercentage,cea_forecastleft');
pass('Forecast calculated, percentage and left', t.cea_forecastcalculated === 1350.45 && t.cea_forecastpercentage === 90 && t.cea_forecastleft === 150.05, JSON.stringify(t));
const amt = (await dv('GET', `cea_forecastlines(${f1.cea_forecastlineid})?$select=cea_amount`)).cea_amount;
pass('Forecast line amount = percentage x Grand Total', amt === 900.3, String(amt));
await dv('PATCH', `cea_costlines(${l2.cea_costlineid})`, { cea_cost: 1500 });
t = await get(id, 'cea_grandtotal,cea_forecastcalculated');
pass('Forecast amounts follow Grand Total changes', t.cea_grandtotal === 2500.5 && t.cea_forecastcalculated === 2250.45, JSON.stringify(t));
await dv('DELETE', `cea_costlines(${l2.cea_costlineid})`);
pass('Deleting a line refreshes totals', (await get(id, 'cea_grandtotal')).cea_grandtotal === 1000.5);

await expectReject('Completion before start is rejected', () => dv('PATCH', `cea_requests(${id})`, { cea_startdate: '2027-05-01', cea_estimatedcompletiondate: '2027-04-01' }), 'earlier');
await dv('PATCH', `cea_requests(${id})`, { cea_payback: 3, cea_irr: 10, cea_npv: 5, cea_category: 1 });
t = await get(id, 'cea_payback,cea_irr,cea_npv');
pass('Metrics are cleared for non-metric categories', t.cea_payback === null && t.cea_irr === null && t.cea_npv === null, JSON.stringify(t));
await dv('PATCH', `cea_requests(${id})`, { cea_projectinplan: false, cea_budgetedamount: 10 });
pass('Budgeted Amount is cleared when Project in Plan = No', (await get(id, 'cea_budgetedamount')).cea_budgetedamount === null);
await dv('PATCH', `cea_requests(${id})`, { cea_supplemental: true, cea_projectname: 'abc' });
pass('Project Name is cleared when Supplemental = Yes', (await get(id, 'cea_projectname')).cea_projectname === null);
await dv('PATCH', `cea_requests(${id})`, { cea_currency: 2 });
pass('Changing Currency leaves amounts unchanged', (await get(id, 'cea_grandtotal')).cea_grandtotal === 1000.5);

try { await dv('DELETE', `cea_requests(${id})`); console.log('cleanup ok'); } catch (e) { console.log('  cleanup', e.message.slice(0, 200)); }
process.exit(failed ? 1 : 0);

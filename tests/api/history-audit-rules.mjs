// Web API checks for Spec 011 (T019, T022, T023). Run: node tests/api/history-audit-rules.mjs
import { dv } from '../../tools/dv.mjs';

let failed = 0;
const pass = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); if (!ok) failed++; };
async function reject(n, fn, has) {
  try { await fn(); pass(n, false, 'accepted'); } catch (e) { pass(n, !has || e.message.includes(has), e.message.slice(0, 300)); }
}
const me = (await dv('GET', 'WhoAmI')).UserId;
const adminAudit = async (type) => (await dv('GET', `cea_administrativeauditentries?$filter=cea_eventtype eq ${type}&$select=cea_administrativeauditentryid,cea_oldvalue,cea_newvalue,cea_reason,cea_actorname,cea_occurredon&$orderby=createdon desc&$top=5`)).value;

// T019: role changes
const bu = (await dv('GET', `systemusers(${me})?$select=_businessunitid_value`))._businessunitid_value;
const role = (await dv('GET', `roles?$select=roleid&$filter=name eq 'CEA Approvals' and _businessunitid_value eq ${bu}&$top=1`)).value[0];
const ref = { '@odata.id': `${(await import('../../tools/dv.mjs')).ORG}/api/data/v9.2/roles(${role.roleid})` };
const has = async () => (await dv('GET', `systemusers(${me})/systemuserroles_association?$select=roleid&$filter=roleid eq ${role.roleid}`)).value.length > 0;
const already = await has();
try {
  if (already) await dv('DELETE', `systemusers(${me})/systemuserroles_association/$ref?$id=${ref['@odata.id']}`);
  const before = (await adminAudit(1)).length;
  await dv('POST', `systemusers(${me})/systemuserroles_association/$ref`, ref);
  const a = await adminAudit(1);
  pass('Role added creates a Role Changed audit entry', a.length > 0 && a[0].cea_newvalue === 'CEA Approvals' && !a[0].cea_oldvalue, JSON.stringify(a[0]));
  pass('Role entry has actor and date', !!a[0].cea_actorname && !!a[0].cea_occurredon);
  await dv('DELETE', `systemusers(${me})/systemuserroles_association/$ref?$id=${ref['@odata.id']}`);
  const b = await adminAudit(1);
  pass('Role removed creates a Role Changed audit entry', b.length > 0 && b[0].cea_oldvalue === 'CEA Approvals' && !b[0].cea_newvalue, JSON.stringify(b[0]));
  pass('Each role change adds one entry', b.length >= before + 1);
  const entry = b[0];
  await reject('Admin audit entry update is rejected', () => dv('PATCH', `cea_administrativeauditentries(${entry.cea_administrativeauditentryid})`, { cea_reason: 'tamper' }), 'immutable');
  await reject('Admin audit entry delete is rejected', () => dv('DELETE', `cea_administrativeauditentries(${entry.cea_administrativeauditentryid})`), 'immutable');
} finally {
  if (already && !(await has())) await dv('POST', `systemusers(${me})/systemuserroles_association/$ref`, ref);
}

// T022/T023: history table immutability and completeness
const hs = (await dv('GET', 'cea_historyentries?$select=cea_historyentryid,cea_actorname,cea_occurredon&$top=200')).value;
pass('Every history entry has Actor Name and Occurred On', hs.length > 0 && hs.every((h) => !!h.cea_actorname && !!h.cea_occurredon));
await reject('History entry delete is rejected', () => dv('DELETE', `cea_historyentries(${hs[0].cea_historyentryid})`), 'immutable');
const ent = (await dv('GET', "EntityDefinitions(LogicalName='cea_historyentry')?$select=IsAuditEnabled")).IsAuditEnabled;
pass('History table is reachable and readable', hs.length > 0 && !!ent);
const ex = (await dv('GET', "privileges?$select=name&$filter=contains(name,'cea_historyentry') or contains(name,'cea_administrativeauditentry')")).value.map((p) => p.name);
pass('No export-related privilege defined for history tables', !ex.some((n) => /export/i.test(n)), ex.join(','));

console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);

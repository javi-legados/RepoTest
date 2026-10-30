// Spec 002 T029: permission-matrix checks against the real role privileges. Run: node tests/api/security/permission-matrix.mjs
import { dv } from '../../../tools/dv.mjs';

let failed = 0;
const pass = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' ' + x}`); if (!ok) failed++; };
const depth = { 0: 'Basic', 1: 'Local', 2: 'Deep', 3: 'Global' };

async function privs(role) {
  const r = (await dv('GET', `roles?$select=roleid&$filter=name eq '${role}'`)).value[0];
  const res = await dv('GET', `RetrieveRolePrivilegesRole(RoleId=${r.roleid})`);
  const by = {};
  for (const p of res.RolePrivileges) {
    const m = p.PrivilegeName.match(/^prv(Create|Read|Write|Delete|AppendTo|Append)(cea_.*)$/i);
    if (m) (by[m[2].toLowerCase()] ||= {})[m[1]] = depth[p.Depth] ?? p.Depth;
  }
  return by;
}
const R = {};
for (const n of ['CEA Creators', 'CEA Internal Approvals', 'CEA Approvals', 'CEA Administrators']) R[n] = await privs(n);
const has = (role, table, verb) => !!(R[role][table] || {})[verb];
const level = (role, table, verb) => (R[role][table] || {})[verb];

const cat = 'CEA Creators', ia = 'CEA Internal Approvals', ap = 'CEA Approvals', ad = 'CEA Administrators';
for (const t of ['cea_request', 'cea_requestattachment']) {
  pass(`Create ${t}: Creator and Administrator yes`, has(cat, t, 'Create') && has(ad, t, 'Create'));
  pass(`Create ${t}: Internal Approval and Approvals no`, !has(ia, t, 'Create') && !has(ap, t, 'Create'));
  pass(`Write/Delete ${t}: approvers no`, ![ia, ap].some((r) => has(r, t, 'Write') || has(r, t, 'Delete')));
}
pass('View request: Creator own (Basic)', level(cat, 'cea_request', 'Read') === 'Basic');
pass('View request: approvers within BU (Deep)', level(ia, 'cea_request', 'Read') === 'Deep' && level(ap, 'cea_request', 'Read') === 'Deep');
pass('View request: Administrator all (Global)', level(ad, 'cea_request', 'Read') === 'Global');
pass('Approvals role is read-only on decisions and steps', ![ap].some((r) => ['Create', 'Write', 'Delete'].some((v) => has(r, 'cea_approvaldecision', v) || has(r, 'cea_resolvedapprover', v))));
pass('No role can create or write decisions directly (only the API)', [cat, ia, ap, ad].every((r) => !has(r, 'cea_approvaldecision', 'Create') && !has(r, 'cea_approvaldecision', 'Write')));
pass('Administrator reads Access Denial Records', has(ad, 'cea_accessdenialrecord', 'Read') && [cat, ia, ap].every((r) => !has(r, 'cea_accessdenialrecord', 'Read')));
pass('Only Administrator writes approval steps (reassign)', has(ad, 'cea_resolvedapprover', 'Write') && [cat, ia, ap].every((r) => !has(r, 'cea_resolvedapprover', 'Write')));

// Denied attempts create Access Denial Records (covered end to end in approval-chain-rules.mjs, FR-015)
process.exit(failed ? 1 : 0);

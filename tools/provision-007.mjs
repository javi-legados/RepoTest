// Spec 007 foundational provisioning (T003-T009) and Custom APIs. Idempotent. Run after register-plugins.mjs for the APIs.
import { dv, ensureTable, ensureLookup, ensureAttribute, stringAttr, boolAttr, choiceAttr, dateAttr, memoAttr, intAttr, SOLUTION } from './dv.mjs';

const levels = [[1, 'Direct Manager'], [2, 'Plant Manager'], [3, 'Regional Approver']];
const cascade = async (name) => {
  const rel = await dv('GET', `RelationshipDefinitions(SchemaName='${name}')`);
  if (rel.CascadeConfiguration.Delete !== 'Cascade') {
    rel.CascadeConfiguration.Delete = 'Cascade';
    await dv('PUT', `RelationshipDefinitions(${rel.MetadataId})`, rel, { 'MSCRM.MergeLabels': 'true' });
  }
};

// T005 step additions + request link
await ensureAttribute('cea_resolvedapprover', choiceAttr('cea_StepStatus', 'Step Status', [[1, 'Pending'], [2, 'Approved'], [3, 'Rejected'], [4, 'Skipped'], [5, 'Invalidated'], [6, 'On Hold']]));
await ensureAttribute('cea_resolvedapprover', dateAttr('cea_DecidedOn', 'Decided On'));
await ensureLookup('cea_resolvedapprover', 'cea_request', 'cea_request_resolvedapprover', 'cea_RequestId', 'Request');
await cascade('cea_request_resolvedapprover');

// Request additions: cycle and pending approver
await ensureAttribute('cea_request', intAttr('cea_Cycle', 'Revision Cycle', { min: 1, max: 999 }));
await ensureLookup('cea_request', 'systemuser', 'cea_pendingapprover_request', 'cea_PendingApproverId', 'Pending Approver');

// T004 ApprovalDecision
await ensureTable({
  SchemaName: 'cea_approvaldecision', display: 'Approval Decision', plural: 'Approval Decisions',
  primary: { schema: 'cea_Name', display: 'Name', max: 200 }, ownership: 'UserOwned', audit: true,
}, [
  choiceAttr('cea_Level', 'Level', levels, { required: true }),
  choiceAttr('cea_Decision', 'Decision', [[1, 'Approved'], [2, 'Rejected']], { required: true }),
  memoAttr('cea_Comments', 'Comments', { max: 4000 }),
  dateAttr('cea_DecidedOn', 'Decided On'),
  boolAttr('cea_Invalidated', 'Invalidated', false),
  intAttr('cea_DecisionCycle', 'Cycle', { min: 1, max: 999 }),
]);
await ensureLookup('cea_approvaldecision', 'cea_request', 'cea_request_approvaldecision', 'cea_RequestId', 'Request', { required: true });
await ensureLookup('cea_approvaldecision', 'systemuser', 'cea_approver_approvaldecision', 'cea_ApproverId', 'Approver');
await cascade('cea_request_approvaldecision');

// T003 PlatformSetting
await ensureTable({
  SchemaName: 'cea_platformsetting', display: 'Platform Setting', plural: 'Platform Settings',
  primary: { schema: 'cea_Name', display: 'Name', max: 100 }, ownership: 'OrganizationOwned',
}, [stringAttr('cea_Value', 'Value', { max: 200 })]);

const root = (await dv('GET', 'businessunits?$select=businessunitid&$filter=parentbusinessunitid eq null')).value[0];
async function grant(roleName, entity, verbs, depth) {
  const role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${roleName}' and parentroleid eq null`)).value[0];
  const names = verbs.map((v) => `prv${v}${entity}`);
  const found = (await dv('GET', `privileges?$select=privilegeid,name&$filter=${names.map((n) => `name eq '${n}'`).join(' or ')}`)).value;
  await dv('POST', `roles(${role.roleid})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, { Privileges: found.map((p) => ({ PrivilegeId: p.privilegeid, Depth: depth, BusinessUnitId: root.businessunitid })) });
  console.log('~ role', roleName, entity, found.length);
}
// T007: decisions are read-only for everyone; the actions write them as the system.
await grant('CEA Creators', 'cea_approvaldecision', ['Read'], 'Basic');
await grant('CEA Administrators', 'cea_approvaldecision', ['Read'], 'Global');
for (const r of ['CEA Internal Approvals', 'CEA Approvals']) await grant(r, 'cea_approvaldecision', ['Read'], 'Deep');
for (const r of ['CEA Creators', 'CEA Internal Approvals', 'CEA Approvals']) await grant(r, 'cea_platformsetting', ['Read'], 'Global');
await grant('CEA Administrators', 'cea_platformsetting', ['Read', 'Write', 'Create', 'Delete'], 'Global');

// T008 seed
const seed = await dv('GET', `cea_platformsettings?$select=cea_platformsettingid&$filter=cea_name eq 'ReminderDays'`);
if (!seed.value.length) await dv('POST', 'cea_platformsettings', { cea_name: 'ReminderDays', cea_value: '3' });

// Custom APIs
const H = { 'MSCRM.SolutionUniqueName': SOLUTION };
for (const [name, display, type, comments] of [['cea_ApproveStep', 'Approve Step', 'ApproveStep', false], ['cea_RejectStep', 'Reject Step', 'RejectStep', true]]) {
  const t = (await dv('GET', `plugintypes?$select=plugintypeid&$filter=typename eq 'CEAPlatform.Plugins.${type}'`)).value[0];
  if (!t) { console.log('! register the plug-in type first:', type); continue; }
  let api = (await dv('GET', `customapis?$select=customapiid&$filter=uniquename eq '${name}'`)).value[0];
  if (!api) {
    await dv('POST', 'customapis', {
      uniquename: name, name: display, displayname: display, description: display, bindingtype: 0,       isfunction: false, isprivate: false, allowedcustomprocessingsteptype: 2,
      'PluginTypeId@odata.bind': `/plugintypes(${t.plugintypeid})`,
    }, H);
    api = (await dv('GET', `customapis?$select=customapiid&$filter=uniquename eq '${name}'`)).value[0];
    console.log('+ api', name);
  }
  const bind = `/customapis(${api.customapiid})`;
  for (const [p, type_, ent] of [['Request', 5, 'cea_request'], ['Comments', 10, null]]) {
    if ((await dv('GET', `customapirequestparameters?$select=customapirequestparameterid&$filter=uniquename eq '${p}' and _customapiid_value eq ${api.customapiid}`)).value.length) continue;
    await dv('POST', 'customapirequestparameters', {
      uniquename: p, name: p, displayname: p, description: p, type: type_, isoptional: p === 'Comments',
      ...(ent ? { logicalentityname: ent } : {}), 'CustomAPIId@odata.bind': bind,
    }, H);
  }
  if (!(await dv('GET', `customapiresponseproperties?$select=customapiresponsepropertyid&$filter=uniquename eq 'Result' and _customapiid_value eq ${api.customapiid}`)).value.length)
    await dv('POST', 'customapiresponseproperties', { uniquename: 'Result', name: 'Result', displayname: 'Result', description: 'Result', type: 10, 'CustomAPIId@odata.bind': bind }, H);
}
await dv('POST', 'PublishAllXml', {});
console.log('done');

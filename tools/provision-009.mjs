// Spec 009 provisioning: notification queue, outcomes, templates, settings, roles, cea_ProcessNotifications. Idempotent. Run after register-plugins.mjs.
import { dv, ensureTable, ensureLookup, ensureAttribute, stringAttr, choiceAttr, dateAttr, memoAttr, intAttr, SOLUTION, ORG } from './dv.mjs';

const events = [[1, 'Submitted'], [2, 'Resubmitted'], [3, 'Released'], [4, 'Approved Next Level'], [5, 'All Approved'], [6, 'Rejected'], [7, 'Returned'], [8, 'Final Completed'],
  [9, 'Approver Reminder'], [10, 'Creator Reminder'], [11, 'Alert Blocked'], [12, 'Alert On Hold'], [13, 'Alert Delivery Failure'], [14, 'Alert Invalid Recipient']];

await ensureTable({ SchemaName: 'cea_notificationrequest', display: 'Notification Request', plural: 'Notification Requests', primary: { schema: 'cea_Name', display: 'Name', max: 200 }, ownership: 'OrganizationOwned' }, [
  choiceAttr('cea_EventType', 'Event Type', events, { required: true }),
  choiceAttr('cea_RecipientGroup', 'Recipient Group', [[1, 'Administrators'], [2, 'Creator'], [3, 'Approver']], { required: true }),
  memoAttr('cea_Comments', 'Comments', { max: 4000 }),
  stringAttr('cea_EventId', 'Event Id', { max: 100 }),
  choiceAttr('cea_Status', 'Status', [[1, 'Queued'], [2, 'Sent'], [3, 'Failed'], [4, 'Skipped']], { required: true }),
]);
await ensureTable({ SchemaName: 'cea_notificationoutcome', display: 'Notification Outcome', plural: 'Notification Outcomes', primary: { schema: 'cea_Name', display: 'Name', max: 200 }, ownership: 'OrganizationOwned' }, [
  dateAttr('cea_SentOn', 'Sent On'),
  intAttr('cea_Attempts', 'Attempts', { min: 0, max: 99 }),
  choiceAttr('cea_Result', 'Result', [[1, 'Sent'], [2, 'Failed'], [3, 'Skipped']], { required: true }),
  memoAttr('cea_Reason', 'Reason', { max: 2000 }),
]);
await ensureTable({ SchemaName: 'cea_emailtemplate', display: 'Email Template', plural: 'Email Templates', primary: { schema: 'cea_Name', display: 'Name', max: 200 }, ownership: 'OrganizationOwned' }, [
  choiceAttr('cea_EventType', 'Event Type', events, { required: true }),
  stringAttr('cea_Subject', 'Subject', { max: 200 }),
  memoAttr('cea_Body', 'Body', { max: 4000 }),
  stringAttr('cea_ExpectedAction', 'Expected Action', { max: 300 }),
]);
await ensureLookup('cea_notificationrequest', 'cea_request', 'cea_request_notificationrequest', 'cea_RequestId', 'Request', { required: true });
await ensureLookup('cea_notificationrequest', 'systemuser', 'cea_recipient_notificationrequest', 'cea_RecipientId', 'Recipient');
await ensureLookup('cea_notificationoutcome', 'cea_notificationrequest', 'cea_notificationrequest_outcome', 'cea_NotificationRequestId', 'Notification Request', { required: true });
await ensureLookup('cea_notificationoutcome', 'systemuser', 'cea_recipient_notificationoutcome', 'cea_RecipientId', 'Recipient');
for (const name of ['cea_request_notificationrequest', 'cea_notificationrequest_outcome']) {
  const rel = await dv('GET', `RelationshipDefinitions(SchemaName='${name}')`);
  if (rel.CascadeConfiguration.Delete !== 'Cascade') { rel.CascadeConfiguration.Delete = 'Cascade'; await dv('PUT', `RelationshipDefinitions(${rel.MetadataId})`, rel, { 'MSCRM.MergeLabels': 'true' }); }
}

const root = (await dv('GET', 'businessunits?$select=businessunitid&$filter=parentbusinessunitid eq null')).value[0];
async function grant(roleName, entity, verbs, depth) {
  const role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${roleName}' and parentroleid eq null`)).value[0];
  const names = verbs.map((v) => `prv${v}${entity}`);
  const found = (await dv('GET', `privileges?$select=privilegeid,name&$filter=${names.map((n) => `name eq '${n}'`).join(' or ')}`)).value;
  await dv('POST', `roles(${role.roleid})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, { Privileges: found.map((p) => ({ PrivilegeId: p.privilegeid, Depth: depth, BusinessUnitId: root.businessunitid })) });
  console.log('~ role', roleName, entity, found.length);
}
await grant('CEA Administrators', 'cea_notificationrequest', ['Read'], 'Global');
await grant('CEA Administrators', 'cea_notificationoutcome', ['Read'], 'Global');
await grant('CEA Administrators', 'cea_emailtemplate', ['Read', 'Write', 'Create'], 'Global');

const L = '\n\nOpen the request: {Link}';
const T = {
  1: ['Submitted', 'CEA {RequestId} submitted for review', 'The CEA request {RequestId} ({Project}) was submitted. Expected action: perform the initial review.' + L],
  2: ['Resubmitted', 'CEA {RequestId} resubmitted for revision review', 'The CEA request {RequestId} ({Project}) was corrected and resubmitted. Expected action: perform the revision review.' + L],
  3: ['Released', 'CEA {RequestId} needs your approval', 'The CEA request {RequestId} ({Project}) was released to approval. Expected action: approve or reject it.' + L],
  4: ['Approved Next Level', 'CEA {RequestId} needs your approval', 'The CEA request {RequestId} ({Project}) was approved at the previous level. Expected action: approve or reject it.' + L],
  5: ['All Approved', 'CEA {RequestId} fully approved', 'All approvals of the CEA request {RequestId} ({Project}) are complete. The final CEA package is being prepared.' + L],
  6: ['Rejected', 'CEA {RequestId} was rejected', 'The CEA request {RequestId} ({Project}) was rejected.\n\nComments: {Comments}\n\nExpected action: correct the request and resubmit it.' + L],
  7: ['Returned', 'CEA {RequestId} was returned to you', 'The CEA request {RequestId} ({Project}) was returned by the CEA Administrators.\n\nComments: {Comments}\n\nExpected action: correct the request and resubmit it.' + L],
  8: ['Final Completed', 'CEA {RequestId} final package completed', 'The final CEA package of the request {RequestId} ({Project}) is complete.' + L],
  9: ['Approver Reminder', 'Reminder: CEA {RequestId} awaits your approval', 'The CEA request {RequestId} ({Project}) is still pending your decision. Expected action: approve or reject it.' + L],
  10: ['Creator Reminder', 'Reminder: CEA {RequestId} awaits your correction', 'The CEA request {RequestId} ({Project}) is still returned to you. Expected action: correct and resubmit it.' + L],
  11: ['Alert Blocked', 'Alert: CEA {RequestId} is blocked', 'The CEA request {RequestId} is blocked: {Comments}' + L],
  12: ['Alert On Hold', 'Alert: CEA {RequestId} is on hold', 'The CEA request {RequestId} is on hold: {Comments}. Expected action: assign a replacement.' + L],
  13: ['Alert Delivery Failure', 'Alert: notification delivery failed for CEA {RequestId}', '{Comments}' + L],
  14: ['Alert Invalid Recipient', 'Alert: invalid recipient for CEA {RequestId}', 'A notification was not sent because the recipient is inactive or has no valid email: {Comments}' + L],
};
for (const [ev, [name, subject, body]] of Object.entries(T)) {
  const cur = (await dv('GET', `cea_emailtemplates?$select=cea_emailtemplateid&$filter=cea_eventtype eq ${ev}`)).value[0];
  const data = { cea_name: name, cea_eventtype: Number(ev), cea_subject: subject, cea_body: body, cea_expectedaction: body.split('Expected action: ')[1]?.split('\n')[0] ?? '' };
  if (cur) await dv('PATCH', `cea_emailtemplates(${cur.cea_emailtemplateid})`, data); else await dv('POST', 'cea_emailtemplates', data);
}
for (const [k, v] of [['BaseUrl', ORG], ['SenderMailbox', '']]) {
  const s = await dv('GET', `cea_platformsettings?$select=cea_platformsettingid&$filter=cea_name eq '${k}'`);
  if (!s.value.length) await dv('POST', 'cea_platformsettings', { cea_name: k, cea_value: v });
}

const H = { 'MSCRM.SolutionUniqueName': SOLUTION };
const name = 'cea_ProcessNotifications';
const t = (await dv('GET', `plugintypes?$select=plugintypeid&$filter=typename eq 'CEAPlatform.Plugins.ProcessNotifications'`)).value[0];
if (!t) throw new Error('register the plug-in type first');
let api = (await dv('GET', `customapis?$select=customapiid&$filter=uniquename eq '${name}'`)).value[0];
if (!api) {
  await dv('POST', 'customapis', { uniquename: name, name: 'Process Notifications', displayname: 'Process Notifications', description: 'Queue reminders and retry queued notifications', bindingtype: 0, isfunction: false, isprivate: false, allowedcustomprocessingsteptype: 0, 'PluginTypeId@odata.bind': `/plugintypes(${t.plugintypeid})` }, H);
  api = (await dv('GET', `customapis?$select=customapiid&$filter=uniquename eq '${name}'`)).value[0];
  console.log('+ api', name);
}
if (!(await dv('GET', `customapiresponseproperties?$select=customapiresponsepropertyid&$filter=uniquename eq 'Result' and _customapiid_value eq ${api.customapiid}`)).value.length)
  await dv('POST', 'customapiresponseproperties', { uniquename: 'Result', name: 'Result', displayname: 'Result', description: 'Result', type: 10, 'CustomAPIId@odata.bind': `/customapis(${api.customapiid})` }, H);

const vw = async (entity, vname, cols, order) => {
  const fetchxml = `<fetch version="1.0" mapping="logical"><entity name="${entity}">${cols.map((c) => `<attribute name="${c[0]}"/>`).join('')}<order attribute="${order}" descending="true"/></entity></fetch>`;
  const layoutxml = `<grid name="resultset" object="0" jump="${cols[0][0]}" select="1" icon="1" preview="1"><row name="result" id="${entity}id">${cols.map((c) => `<cell name="${c[0]}" width="${c[1]}"/>`).join('')}</row></grid>`;
  const q = (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${vname}' and returnedtypecode eq '${entity}'`)).value[0];
  if (q) await dv('PATCH', `savedqueries(${q.savedqueryid})`, { fetchxml, layoutxml });
  else await dv('POST', 'savedqueries', { name: vname, returnedtypecode: entity, querytype: 0, fetchxml, layoutxml, isdefault: false });
  return (await dv('GET', `savedqueries?$select=savedqueryid&$filter=name eq '${vname}' and returnedtypecode eq '${entity}'`)).value[0].savedqueryid;
};
const v1 = await vw('cea_notificationrequest', 'Notification Log', [['cea_eventtype', 150], ['cea_requestid', 150], ['cea_recipientgroup', 110], ['cea_recipientid', 150], ['cea_status', 90], ['createdon', 130]], 'createdon');
const v2 = await vw('cea_notificationoutcome', 'Notification Outcomes', [['cea_name', 200], ['cea_recipientid', 150], ['cea_result', 90], ['cea_attempts', 80], ['cea_senton', 130], ['cea_reason', 300]], 'createdon');
const v3 = await vw('cea_emailtemplate', 'Email Templates', [['cea_name', 200], ['cea_subject', 300], ['cea_expectedaction', 300]], 'cea_name');
const app = (await dv('GET', `appmodules?$select=appmoduleid&$filter=uniquename eq 'cea_ceaadmin'`, null, { 'MSCRM.IncludeUnpublished': 'true' })).value[0];
const comps = [];
for (const e of ['cea_notificationrequest', 'cea_notificationoutcome', 'cea_emailtemplate']) comps.push({ '@odata.type': 'Microsoft.Dynamics.CRM.entity', entityid: (await dv('GET', `EntityDefinitions(LogicalName='${e}')?$select=MetadataId`)).MetadataId });
for (const id of [v1, v2, v3]) comps.push({ '@odata.type': 'Microsoft.Dynamics.CRM.savedquery', savedqueryid: id });
await dv('POST', 'AddAppComponents', { AppId: app.appmoduleid, Components: comps }, { 'MSCRM.SolutionUniqueName': SOLUTION });
const sm = (await dv('GET', `sitemaps?$select=sitemapid`)).value.length ? (await dv('GET', `sitemaps?$select=sitemapid&$filter=sitemapnameunique eq 'cea_ceaadmin'`)).value[0] : null;
for (const [id, ent, title] of [['sa_notiflog', 'cea_notificationrequest', 'Notification Log'], ['sa_notifout', 'cea_notificationoutcome', 'Notification Outcomes'], ['sa_templates', 'cea_emailtemplate', 'Email Templates']]) {
  const cur = (await dv('GET', `sitemaps(${sm.sitemapid})?$select=sitemapxml`)).sitemapxml;
  if (!cur.includes(`Id="${id}"`)) await dv('PATCH', `sitemaps(${sm.sitemapid})`, { sitemapxml: cur.replace('</Group></Area>', `<SubArea Id="${id}" Entity="${ent}" Title="${title}"/></Group></Area>`) });
}
await dv('POST', 'PublishAllXml', {});
console.log('done');

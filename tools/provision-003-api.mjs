import { dv, SOLUTION } from './dv.mjs';
// Spec 003 US4: cea_ReassignApprover Custom API (Request, Level, NewApprover, Reason).
const H = { 'MSCRM.SolutionUniqueName': SOLUTION };
const name = 'cea_ReassignApprover';
const t = (await dv('GET', "plugintypes?$select=plugintypeid&$filter=typename eq 'CEAPlatform.Plugins.ReassignApprover'")).value[0];
if (!t) throw new Error('register the plug-in type first');
let api = (await dv('GET', `customapis?$select=customapiid&$filter=uniquename eq '${name}'`)).value[0];
if (!api) {
  await dv('POST', 'customapis', { uniquename: name, name: 'Reassign Approver', displayname: 'Reassign Approver', description: 'Reassign Approver', bindingtype: 0, isfunction: false, isprivate: false, allowedcustomprocessingsteptype: 0, 'PluginTypeId@odata.bind': `/plugintypes(${t.plugintypeid})` }, H);
  api = (await dv('GET', `customapis?$select=customapiid&$filter=uniquename eq '${name}'`)).value[0];
  console.log('+ api', name);
}
for (const [p, type_, ent] of [['Request', 5, 'cea_request'], ['Level', 7, null], ['NewApprover', 5, 'systemuser'], ['Reason', 10, null]]) {
  if ((await dv('GET', `customapirequestparameters?$select=customapirequestparameterid&$filter=uniquename eq '${p}' and _customapiid_value eq ${api.customapiid}`)).value.length) continue;
  await dv('POST', 'customapirequestparameters', { uniquename: p, name: p, displayname: p, description: p, type: type_, isoptional: false, ...(ent ? { logicalentityname: ent } : {}), 'CustomAPIId@odata.bind': `/customapis(${api.customapiid})` }, H);
}
await dv('POST', 'PublishAllXml', {});
console.log('done');

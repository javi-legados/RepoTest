// Spec 006: Custom APIs cea_SubmitRequest, cea_ReleaseToApproval, cea_ReturnToCreator. Run after register-plugins.mjs. Idempotent.
import { dv, SOLUTION } from './dv.mjs';

const H = { 'MSCRM.SolutionUniqueName': SOLUTION };
const apis = [
  ['cea_SubmitRequest', 'Submit Request', 'SubmitRequest', false],
  ['cea_ReleaseToApproval', 'Release To Approval', 'ReleaseToApproval', false],
  ['cea_ReturnToCreator', 'Return To Creator', 'ReturnToCreator', true],
  ['cea_NotifyReleaseBlocked', 'Notify Release Blocked', 'NotifyReleaseBlocked', true],
];
for (const [name, display, type, comments] of apis) {
  const t = (await dv('GET', `plugintypes?$select=plugintypeid&$filter=typename eq 'CEAPlatform.Plugins.${type}'`)).value[0];
  let api = (await dv('GET', `customapis?$select=customapiid&$filter=uniquename eq '${name}'`)).value[0];
  if (!api) {
    await dv('POST', 'customapis', {
      uniquename: name, name: display, displayname: display, description: display, bindingtype: 0, isfunction: false, isprivate: false, allowedcustomprocessingsteptype: 0,
      'PluginTypeId@odata.bind': `/plugintypes(${t.plugintypeid})`,
    }, H);
    api = (await dv('GET', `customapis?$select=customapiid&$filter=uniquename eq '${name}'`)).value[0];
    console.log('+ api', name);
  }
  const bind = `/customapis(${api.customapiid})`;
  const params = [['Request', 5, 'cea_request'], ...(comments ? [['Comments', 10, null]] : [])];
  for (const [p, type_, ent] of params) {
    const un = `${name}.${p}`;
    if ((await dv('GET', `customapirequestparameters?$select=customapirequestparameterid&$filter=uniquename eq '${p}' and _customapiid_value eq ${api.customapiid}`)).value.length) continue;
    await dv('POST', 'customapirequestparameters', {
      uniquename: p, name: p, displayname: p, description: p, type: type_, isoptional: p === 'Comments',
      ...(ent ? { logicalentityname: ent } : {}), 'CustomAPIId@odata.bind': bind,
    }, H);
    console.log('  + param', un);
  }
  if (!(await dv('GET', `customapiresponseproperties?$select=customapiresponsepropertyid&$filter=uniquename eq 'Result' and _customapiid_value eq ${api.customapiid}`)).value.length) {
    await dv('POST', 'customapiresponseproperties', { uniquename: 'Result', name: 'Result', displayname: 'Result', description: 'Result', type: 10, 'CustomAPIId@odata.bind': bind }, H);
  }
}
await dv('POST', 'PublishAllXml', {});
console.log('done');

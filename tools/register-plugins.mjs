// Registers the CEAPlatform.Plugins assembly and the UserValidation steps (T016). Idempotent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dv, SOLUTION } from './dv.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const dll = path.join(dir, '..', 'solution', 'CEAPlatform', 'Plugins', 'bin', 'CEAPlatform.Plugins.dll');
const [name, version, culture, tokenPart] = process.argv.slice(2);
const content = fs.readFileSync(dll).toString('base64');

let asm = (await dv('GET', `pluginassemblies?$select=pluginassemblyid&$filter=name eq 'CEAPlatform.Plugins'`)).value[0];
if (asm) {
  await dv('PATCH', `pluginassemblies(${asm.pluginassemblyid})`, { content });
  console.log('~ assembly updated');
} else {
  await dv('POST', 'pluginassemblies', {
    name: 'CEAPlatform.Plugins', content, isolationmode: 2, sourcetype: 0, culture: culture || 'neutral',
    version: version || '1.0.0.0', publickeytoken: tokenPart,
  });
  asm = (await dv('GET', `pluginassemblies?$select=pluginassemblyid&$filter=name eq 'CEAPlatform.Plugins'`)).value[0];
  console.log('+ assembly');
}
await dv('POST', 'AddSolutionComponent', {
  ComponentId: asm.pluginassemblyid, ComponentType: 91, SolutionUniqueName: SOLUTION, AddRequiredComponents: false,
}).catch((e) => console.log('  ! add to solution:', e.message.slice(0, 150)));

async function ensureType(typename) {
  let t = (await dv('GET', `plugintypes?$select=plugintypeid&$filter=typename eq '${typename}'`)).value[0];
  if (!t) {
    await dv('POST', 'plugintypes', {
      typename, friendlyname: typename, name: typename, 'pluginassemblyid@odata.bind': `/pluginassemblies(${asm.pluginassemblyid})`,
    });
    t = (await dv('GET', `plugintypes?$select=plugintypeid&$filter=typename eq '${typename}'`)).value[0];
    console.log('+ type', typename);
  }
  return t.plugintypeid;
}

async function ensureStep({ typeId, stepName, message, entity, stage, filtering, preImage, async }) {
  const msg = (await dv('GET', `sdkmessages?$select=sdkmessageid&$filter=name eq '${message}'`)).value[0];
  const flt = entity ? (await dv('GET',
    `sdkmessagefilters?$select=sdkmessagefilterid&$filter=primaryobjecttypecode eq '${entity}' and _sdkmessageid_value eq ${msg.sdkmessageid}`)).value[0] : null;
  let step = (await dv('GET', `sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid&$filter=name eq '${stepName}'`)).value[0];
  if (!step) {
    await dv('POST', 'sdkmessageprocessingsteps', {
      name: stepName, mode: async ? 1 : 0, rank: 1, stage, supporteddeployment: 0,
      'sdkmessageid@odata.bind': `/sdkmessages(${msg.sdkmessageid})`,
      ...(flt ? { 'sdkmessagefilterid@odata.bind': `/sdkmessagefilters(${flt.sdkmessagefilterid})` } : {}),
      'plugintypeid@odata.bind': `/plugintypes(${typeId})`,
      ...(filtering ? { filteringattributes: filtering } : {}),
    });
    step = (await dv('GET', `sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid&$filter=name eq '${stepName}'`)).value[0];
    console.log('+ step', stepName);
    if (preImage) {
      await dv('POST', 'sdkmessageprocessingstepimages', {
        name: 'PreImage', entityalias: 'PreImage', imagetype: 0, messagepropertyname: 'Target',
        'sdkmessageprocessingstepid@odata.bind': `/sdkmessageprocessingsteps(${step.sdkmessageprocessingstepid})`,
      });
    }
  } else console.log('= step', stepName);
  await dv('POST', 'AddSolutionComponent', {
    ComponentId: step.sdkmessageprocessingstepid, ComponentType: 92, SolutionUniqueName: SOLUTION, AddRequiredComponents: false,
  }).catch(() => {});
}

const typeId = await ensureType('CEAPlatform.Plugins.UserValidation');
await ensureStep({ typeId, stepName: 'CEA UserValidation: Create of systemuser', message: 'Create', entity: 'systemuser', stage: 10 });
await ensureStep({
  typeId, stepName: 'CEA UserValidation: Update of systemuser', message: 'Update', entity: 'systemuser', stage: 10, preImage: true,
  filtering: 'cea_sapnumber,lastname,internalemailaddress,cea_department,cea_managername,cea_manageremail,businessunitid',
});
const T = (n) => `CEAPlatform.Plugins.${n}`;
const recorder = await ensureType(T('UserChangeRecorder'));
await ensureStep({ typeId: recorder, stepName: 'CEA UserChangeRecorder: Update of systemuser', message: 'Update', entity: 'systemuser', stage: 40, preImage: true,
  filtering: 'cea_managername,cea_manageremail,cea_department,businessunitid' });
await ensureStep({ typeId: recorder, stepName: 'CEA UserChangeRecorder: Associate', message: 'Associate', stage: 40 });
await ensureStep({ typeId: recorder, stepName: 'CEA UserChangeRecorder: Disassociate', message: 'Disassociate', stage: 40 });

const guard = await ensureType(T('UserDeactivationGuard'));
await ensureStep({ typeId: guard, stepName: 'CEA UserDeactivationGuard: SetState of systemuser', message: 'SetState', entity: 'systemuser', stage: 20 });

const del = await ensureType(T('CatalogDeleteGuard'));
const hier = await ensureType(T('CatalogHierarchyValidation'));
const sync = await ensureType(T('CatalogBusinessUnitSync'));
for (const e of ['cea_company', 'cea_region', 'cea_plant']) {
  await ensureStep({ typeId: del, stepName: `CEA CatalogDeleteGuard: Delete of ${e}`, message: 'Delete', entity: e, stage: 10 });
  await ensureStep({ typeId: sync, stepName: `CEA CatalogBusinessUnitSync: Create of ${e}`, message: 'Create', entity: e, stage: 40 });
  await ensureStep({ typeId: sync, stepName: `CEA CatalogBusinessUnitSync: Update of ${e}`, message: 'Update', entity: e, stage: 40, filtering: 'cea_name' });
}
for (const e of ['cea_region', 'cea_plant']) {
  await ensureStep({ typeId: hier, stepName: `CEA CatalogHierarchyValidation: Create of ${e}`, message: 'Create', entity: e, stage: 10 });
  await ensureStep({ typeId: hier, stepName: `CEA CatalogHierarchyValidation: Update of ${e}`, message: 'Update', entity: e, stage: 10,
    filtering: e === 'cea_region' ? 'cea_companyid' : 'cea_regionid' });
}
const aa = await ensureType(T('ApproverAssignmentValidation'));
await ensureStep({ typeId: aa, stepName: 'CEA ApproverAssignmentValidation: Create', message: 'Create', entity: 'cea_approverassignment', stage: 10 });
await ensureStep({ typeId: aa, stepName: 'CEA ApproverAssignmentValidation: Update', message: 'Update', entity: 'cea_approverassignment', stage: 10 });
const rr = await ensureType(T('RequestRules'));
await ensureStep({ typeId: rr, stepName: 'CEA RequestRules: Create', message: 'Create', entity: 'cea_request', stage: 20 });
await ensureStep({ typeId: rr, stepName: 'CEA RequestRules: Update', message: 'Update', entity: 'cea_request', stage: 20 });
const rp = await ensureType(T('RequestPrefill'));
await ensureStep({ typeId: rp, stepName: 'CEA RequestPrefill: Create', message: 'Create', entity: 'cea_request', stage: 40 });
const lr = await ensureType(T('LineRules'));
await ensureStep({ typeId: lr, stepName: 'CEA LineRules: Create of cea_costline', message: 'Create', entity: 'cea_costline', stage: 20 });
await ensureStep({ typeId: lr, stepName: 'CEA LineRules: Create of cea_forecastline', message: 'Create', entity: 'cea_forecastline', stage: 20 });
await ensureStep({ typeId: lr, stepName: 'CEA LineRules: Update of cea_forecastline', message: 'Update', entity: 'cea_forecastline', stage: 20, filtering: 'cea_year,cea_month,cea_requestid' });
for (const [e, flt] of [['cea_costline', 'cea_cost,cea_group,cea_requestid'], ['cea_forecastline', 'cea_percentage,cea_requestid']]) {
  await ensureStep({ typeId: lr, stepName: `CEA LineRules totals: Create of ${e}`, message: 'Create', entity: e, stage: 40 });
  await ensureStep({ typeId: lr, stepName: `CEA LineRules totals: Update of ${e}`, message: 'Update', entity: e, stage: 40, filtering: flt });
  await ensureStep({ typeId: lr, stepName: `CEA LineRules totals: Delete of ${e}`, message: 'Delete', entity: e, stage: 40, preImage: true });
}
console.log('done');

const lel = await ensureType(T('LineEditLock'));
for (const e of ['cea_costline', 'cea_forecastline'])
  for (const m of ['Create', 'Update', 'Delete'])
    await ensureStep({ typeId: lel, stepName: `CEA LineEditLock: ${m} of ${e}`, message: m, entity: e, stage: 10 });
const gaa = await ensureType(T('GrantApproverAccess'));
await ensureStep({ typeId: gaa, stepName: 'CEA GrantApproverAccess: Update of cea_request', message: 'Update', entity: 'cea_request', stage: 40, filtering: 'cea_pendingapproverid' });
const arf = await ensureType(T('ApproverReassignmentFlag'));
await ensureStep({ typeId: arf, stepName: 'CEA ApproverReassignmentFlag: Update of systemuser', message: 'Update', entity: 'systemuser', stage: 40, preImage: true, filtering: 'businessunitid' });
await ensureStep({ typeId: arf, stepName: 'CEA ApproverReassignmentFlag: Disassociate', message: 'Disassociate', stage: 40 });
for (const n of ['ReassignApprover']) await ensureType(T(n));
const acp = await ensureType(T('ApproverChangePropagation'));
await ensureStep({ typeId: acp, stepName: 'CEA ApproverChangePropagation: Update', message: 'Update', entity: 'cea_approverassignment', stage: 40, preImage: true, filtering: 'cea_approverid,cea_status' });
const ar = await ensureType(T('AttachmentRules'));
await ensureStep({ typeId: ar, stepName: 'CEA AttachmentRules: Create', message: 'Create', entity: 'cea_requestattachment', stage: 10 });
await ensureStep({ typeId: ar, stepName: 'CEA AttachmentRules: Delete', message: 'Delete', entity: 'cea_requestattachment', stage: 10 });

for (const n of ['SubmitRequest', 'ReleaseToApproval', 'ReturnToCreator', 'NotifyReleaseBlocked']) await ensureType(T(n));

for (const n of ['ApproveStep', 'RejectStep']) await ensureType(T(n));
const dg = await ensureType(T('DecisionGuard'));
for (const m of ['cea_ApproveStep', 'cea_RejectStep'])
  await ensureStep({ typeId: dg, stepName: `CEA DecisionGuard: ${m}`, message: m, stage: 10 });
const hold = await ensureType(T('ApproverHold'));
await ensureStep({ typeId: hold, stepName: 'CEA ApproverHold: SetState of systemuser', message: 'SetState', entity: 'systemuser', stage: 40 });
await ensureStep({ typeId: hold, stepName: 'CEA ApproverHold: Update of cea_resolvedapprover', message: 'Update', entity: 'cea_resolvedapprover', stage: 40, filtering: 'cea_approverid' });
for (const n of ['ResubmitRequest']) await ensureType(T(n));
const creatorHold = await ensureType(T('CreatorHold'));
await ensureStep({ typeId: creatorHold, stepName: 'CEA CreatorHold: SetState of systemuser', message: 'SetState', entity: 'systemuser', stage: 40 });
await ensureStep({ typeId: creatorHold, stepName: 'CEA CreatorHold: Assign of cea_request', message: 'Assign', entity: 'cea_request', stage: 40 });
for (const n of ['ProcessNotifications']) await ensureType(T(n));
const disp = await ensureType(T('NotificationDispatch'));
await ensureStep({ typeId: disp, stepName: 'CEA NotificationDispatch: Create of cea_notificationrequest', message: 'Create', entity: 'cea_notificationrequest', stage: 40, async: true });
await ensureType(T('CompleteRequest'));
const dcl = await ensureType(T('DataCorrectionLogger'));
for (const e of ['cea_request', 'cea_costline', 'cea_forecastline'])
  await ensureStep({ typeId: dcl, stepName: `CEA DataCorrectionLogger: Update of ${e}`, message: 'Update', entity: e, stage: 40, preImage: true });
const clg = await ensureType(T('CompletedLockGuard'));
for (const e of ['cea_request', 'cea_costline', 'cea_forecastline'])
  for (const m of ['Update', 'Delete'])
    await ensureStep({ typeId: clg, stepName: `CEA CompletedLockGuard: ${m} of ${e}`, message: m, entity: e, stage: 10 });
for (const e of ['cea_costline', 'cea_forecastline'])
  await ensureStep({ typeId: clg, stepName: `CEA CompletedLockGuard: Create of ${e}`, message: 'Create', entity: e, stage: 10 });
const hg = await ensureType(T('HistoryImmutabilityGuard'));
for (const e of ['cea_historyentry', 'cea_administrativeauditentry'])
  for (const m of ['Update', 'Delete'])
    await ensureStep({ typeId: hg, stepName: `CEA HistoryImmutabilityGuard: ${m} of ${e}`, message: m, entity: e, stage: 10 });
const hc = await ensureType(T('HistoryCreated'));
await ensureStep({ typeId: hc, stepName: 'CEA HistoryCreated: Create of cea_request', message: 'Create', entity: 'cea_request', stage: 40 });
const hs = await ensureType(T('HistoryStatusCapture'));
await ensureStep({ typeId: hs, stepName: 'CEA HistoryStatusCapture: Update of cea_request', message: 'Update', entity: 'cea_request', stage: 40, filtering: 'cea_status,cea_currentlevel', preImage: true });
const hf = await ensureType(T('HistoryFieldChangeCapture'));
for (const e of ['cea_request', 'cea_costline', 'cea_forecastline'])
  await ensureStep({ typeId: hf, stepName: `CEA HistoryFieldChangeCapture: Update of ${e}`, message: 'Update', entity: e, stage: 40, preImage: true });
const ha = await ensureType(T('HistoryAttachmentCapture'));
await ensureStep({ typeId: ha, stepName: 'CEA HistoryAttachmentCapture: Create', message: 'Create', entity: 'cea_requestattachment', stage: 40 });
await ensureStep({ typeId: ha, stepName: 'CEA HistoryAttachmentCapture: Delete', message: 'Delete', entity: 'cea_requestattachment', stage: 40, preImage: true });
const hRole = await ensureType(T('AdminAuditRoleChange'));
for (const m of ['Associate', 'Disassociate'])
  await ensureStep({ typeId: hRole, stepName: `CEA AdminAuditRoleChange: ${m}`, message: m, stage: 40 });
const hAdm = await ensureType(T('AdminAuditAssignment'));
for (const m of ['Create', 'Update', 'Delete'])
  await ensureStep({ typeId: hAdm, stepName: `CEA AdminAuditAssignment: ${m}`, message: m, entity: 'cea_approverassignment', stage: 40, preImage: m !== 'Create' });

// Spec 001 foundational provisioning (tasks T001, T004-T008). Idempotent.
import { dv, ensureTable, ensureAttribute, ensureLookup, exists, stringAttr, boolAttr, choiceAttr, dateAttr, label, SOLUTION } from './dv.mjs';

async function ensureSolution() {
  const pubName = 'ceaplatform';
  let pub = (await dv('GET', `publishers?$select=publisherid&$filter=uniquename eq '${pubName}'`)).value[0];
  if (!pub) {
    await dv('POST', 'publishers', {
      uniquename: pubName, friendlyname: 'CEA Platform', customizationprefix: 'cea', customizationoptionvalueprefix: 41230,
    });
    pub = (await dv('GET', `publishers?$select=publisherid&$filter=uniquename eq '${pubName}'`)).value[0];
    console.log('+ publisher');
  }
  const sol = (await dv('GET', `solutions?$select=solutionid&$filter=uniquename eq '${SOLUTION}'`)).value[0];
  if (!sol) {
    await dv('POST', 'solutions', {
      uniquename: SOLUTION, friendlyname: 'CEA Platform', version: '1.0.0.0',
      'publisherid@odata.bind': `/publishers(${pub.publisherid})`,
    });
    console.log('+ solution');
  } else console.log('= solution');
}

await ensureSolution();

// T004: Business Unit level
await ensureAttribute('businessunit', choiceAttr('cea_Level', 'CEA Level', [[1, 'Enterprise'], [2, 'Company'], [3, 'Region'], [4, 'Plant']]));

// T005: user extension columns (all required in the form; platform requires "ApplicationRequired" only on forms)
await ensureAttribute('systemuser', stringAttr('cea_SapNumber', 'SAP Number', { required: true, max: 50 }));
await ensureAttribute('systemuser', stringAttr('cea_Department', 'Department', { required: true, max: 100 }));
await ensureAttribute('systemuser', stringAttr('cea_ManagerName', 'Manager Name', { required: true, max: 200 }));
await ensureAttribute('systemuser', stringAttr('cea_ManagerEmail', 'Manager Email', { required: true, max: 200, format: 'Email' }));
// T014 (FR-006a): maintained by the UserValidation plug-in
await ensureAttribute('systemuser', boolAttr('cea_ManagerRegistered', 'Manager Registered', false));

// T007: catalog tables
const catalog = (name, display, plural) => ({
  SchemaName: `cea_${name}`, display, plural, primary: { schema: 'cea_Name', display: 'Name', max: 200 },
  ownership: 'OrganizationOwned', audit: true,
});
const stateAttr = [choiceAttr('cea_Status', 'Status', [[1, 'Active'], [2, 'Inactive']], { required: true })];
await ensureTable(catalog('company', 'Company', 'Companies'), stateAttr);
await ensureTable(catalog('region', 'Region', 'Regions'), stateAttr);
await ensureTable(catalog('plant', 'Plant', 'Plants'), stateAttr);
await ensureLookup('cea_region', 'cea_company', 'cea_company_region', 'cea_CompanyId', 'Company', { required: true });
await ensureLookup('cea_plant', 'cea_region', 'cea_region_plant', 'cea_RegionId', 'Region', { required: true });
for (const t of ['cea_company', 'cea_region', 'cea_plant']) {
  await ensureLookup(t, 'businessunit', `cea_businessunit_${t.slice(4)}`, 'cea_BusinessUnitId', 'Business Unit');
}

// T008: immutable user change record
await ensureTable({
  SchemaName: 'cea_userchangerecord', display: 'User Change Record', plural: 'User Change Records',
  primary: { schema: 'cea_Name', display: 'Summary', max: 300 }, ownership: 'OrganizationOwned',
}, [
  stringAttr('cea_Field', 'Field', { required: true, max: 100 }),
  stringAttr('cea_OldValue', 'Old Value', { max: 1000 }),
  stringAttr('cea_NewValue', 'New Value', { max: 1000 }),
  dateAttr('cea_ChangedOn', 'Changed On', { required: true }),
]);
await ensureLookup('cea_userchangerecord', 'systemuser', 'cea_user_userchangerecord', 'cea_UserId', 'User', { required: true });
await ensureLookup('cea_userchangerecord', 'systemuser', 'cea_changedby_userchangerecord', 'cea_ChangedById', 'Changed By');

// T006: alternate keys on systemuser
async function ensureKey(entity, schema, display, attrs) {
  const keys = await dv('GET', `EntityDefinitions(LogicalName='${entity}')/Keys?$select=SchemaName`);
  if (keys.value.some((k) => k.SchemaName.toLowerCase() === schema.toLowerCase())) return console.log(`= key ${schema}`);
  await dv('POST', `EntityDefinitions(LogicalName='${entity}')/Keys`, {
    SchemaName: schema, DisplayName: label(display), KeyAttributes: attrs,
  });
  console.log(`+ key ${schema}`);
}
await ensureKey('systemuser', 'cea_SapNumberKey', 'SAP Number Key', ['cea_sapnumber']);
await ensureKey('systemuser', 'cea_EmailKey', 'Email Key', ['internalemailaddress']);

// add system user & business unit extension components to the solution
for (const [type, name] of [[1, 'systemuser'], [1, 'businessunit']]) {
  const md = await dv('GET', `EntityDefinitions(LogicalName='${name}')?$select=MetadataId`);
  await dv('POST', 'AddSolutionComponent', {
    ComponentId: md.MetadataId, ComponentType: type, SolutionUniqueName: SOLUTION, AddRequiredComponents: false,
    DoNotIncludeSubcomponents: true,
  }).catch((e) => console.log('  ! add component', name, e.message.slice(0, 200)));
}
console.log('done');

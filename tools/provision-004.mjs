// Spec 004 foundational provisioning (T004-T009, T010, T015, T021, T027, T032, T034, T039). Idempotent.
import { dv, ensureTable, ensureLookup, stringAttr, boolAttr, choiceAttr, dateAttr, decimalAttr, intAttr, memoAttr, SOLUTION } from './dv.mjs';

const money = (s, d) => decimalAttr(s, d, { min: 0 });
const statuses = ['Draft', 'Pending Initial Review', 'Pending Approval', 'Rejected', 'Revision Review', 'Approved', 'Completed', 'On Hold'];
const categories = ['Asset Replacement', 'Capacity Requirements', 'Cost Savings', 'Disposal', 'Innovation', 'Modification of Existing Facilities', 'New Facilities', 'Operational Requirements', 'Quality Improvement', 'Regulatory Compliance'];
const groups = ['Modifications to Existing Building', 'Non-Capitalized Expenses', 'Processing System', 'Packaging Equipment', 'Others'];
const opts = (list) => list.map((t, i) => [i + 1, t]);

await ensureTable({
  SchemaName: 'cea_request', display: 'CEA Request', plural: 'CEA Requests',
  primary: { schema: 'cea_RequestNumber', display: 'Request ID', max: 100, autonumber: 'CEA-{DATETIMEUTC:yyyy}-{SEQNUM:5}' }, ownership: 'UserOwned', audit: true,
}, [
  choiceAttr('cea_Status', 'Status', opts(statuses), { required: true }),
  stringAttr('cea_ProjectManager', 'Project Manager', { max: 200 }),
  stringAttr('cea_Location', 'Location', { max: 200 }),
  stringAttr('cea_Department', 'Department', { max: 100 }),
  dateAttr('cea_Date', 'Date', { dateOnly: true }),
  dateAttr('cea_StartDate', 'Start Date', { dateOnly: true }),
  dateAttr('cea_EstimatedCompletionDate', 'Estimated Completion Date', { dateOnly: true }),
  boolAttr('cea_Supplemental', 'Supplemental / Addendum', false),
  stringAttr('cea_ProjectName', 'Project Name', { max: 200 }),
  stringAttr('cea_DescriptionSummary', 'Description Summary', { max: 300 }),
  choiceAttr('cea_Category', 'Category', opts(categories), { required: true }),
  choiceAttr('cea_Currency', 'Currency', opts(['USD', 'EUR', 'GBP', 'UAH', 'CNY', 'AUD']), { required: true }),
  boolAttr('cea_ProjectInPlan', 'Project in Plan', false),
  money('cea_BudgetedAmount', 'Budgeted Amount'),
  money('cea_InvestmentRequired', 'Investment Required'),
  money('cea_NonCapitalizedExpenses', 'Non-Capitalized Expenses'),
  money('cea_WriteOff', 'Write-Off'),
  intAttr('cea_PayBack', 'Pay Back (years)', { min: 0, max: 1000 }),
  decimalAttr('cea_IRR', 'IRR %', { min: -1000, max: 1000 }),
  decimalAttr('cea_NPV', 'NPV'),
  memoAttr('cea_DetailedDescription', 'Detailed Description'),
  ...groups.map((g, i) => money(`cea_Subtotal${i + 1}`, `Subtotal ${g}`)),
  money('cea_GrandTotal', 'Grand Total'),
  money('cea_ForecastCalculated', 'Forecast Calculated'),
  decimalAttr('cea_ForecastPercentage', 'Forecast Percentage'),
  decimalAttr('cea_ForecastLeft', 'Forecast Left'),
]);
await ensureLookup('cea_request', 'cea_request', 'cea_request_existing', 'cea_ExistingCEAReferenceId', 'Existing CEA Reference');
await ensureLookup('cea_request', 'cea_plant', 'cea_plant_request', 'cea_ProjectLocationId', 'Project Location (Plant)');

await ensureTable({
  SchemaName: 'cea_costline', display: 'Cost Line', plural: 'Cost Lines',
  primary: { schema: 'cea_Description', display: 'Description', max: 300 }, ownership: 'UserOwned',
}, [choiceAttr('cea_Group', 'Group', opts(groups), { required: true }), money('cea_Cost', 'Cost')]);
await ensureLookup('cea_costline', 'cea_request', 'cea_request_costline', 'cea_RequestId', 'Request', { required: true });

await ensureTable({
  SchemaName: 'cea_forecastline', display: 'Forecast Line', plural: 'Forecast Lines',
  primary: { schema: 'cea_Name', display: 'Name', max: 100 }, ownership: 'UserOwned',
}, [
  intAttr('cea_Year', 'Year', { required: true, min: 2000, max: 2100 }),
  intAttr('cea_Month', 'Month', { required: true, min: 1, max: 12 }),
  decimalAttr('cea_Percentage', 'Percentage', { required: true, min: 0, max: 100 }),
  money('cea_Amount', 'Amount'),
  stringAttr('cea_Comments', 'Comments', { max: 500 }),
]);
await ensureLookup('cea_forecastline', 'cea_request', 'cea_request_forecastline', 'cea_RequestId', 'Request', { required: true });

// Roles (T009)
const root = (await dv('GET', 'businessunits?$select=businessunitid&$filter=parentbusinessunitid eq null')).value[0];
async function grant(roleName, entries) {
  const role = (await dv('GET', `roles?$select=roleid&$filter=name eq '${roleName}' and parentroleid eq null`)).value[0];
  const wanted = [];
  for (const [entity, verbs, depth] of entries) for (const v of verbs) wanted.push({ n: `prv${v}${entity}`, depth });
  const found = [];
  for (let i = 0; i < wanted.length; i += 20) {
    found.push(...(await dv('GET', `privileges?$select=privilegeid,name&$filter=${wanted.slice(i, i + 20).map((w) => `name eq '${w.n}'`).join(' or ')}`)).value);
  }
  const list = wanted.filter((w) => found.find((p) => p.name === w.n)).map((w) => ({
    PrivilegeId: found.find((p) => p.name === w.n).privilegeid, Depth: w.depth, BusinessUnitId: root.businessunitid,
  }));
  const missing = wanted.filter((w) => !found.find((p) => p.name === w.n)).map((w) => w.n);
  if (missing.length) console.log('  missing privileges:', missing.join(', '));
  await dv('POST', `roles(${role.roleid})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, { Privileges: list });
  console.log('~ role', roleName);
}
const all = ['Create', 'Read', 'Write', 'Delete', 'Append', 'AppendTo'];
const tables = ['cea_request', 'cea_costline', 'cea_forecastline'];
await grant('CEA Creators', tables.map((t) => [t, all, 'Basic']));
for (const r of ['CEA Internal Approvals', 'CEA Approvals']) await grant(r, tables.map((t) => [t, ['Read', 'AppendTo'], 'Deep']));
await grant('CEA Administrators', tables.map((t) => [t, all, 'Global']));
console.log('done');

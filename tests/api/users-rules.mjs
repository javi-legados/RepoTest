// Web API rule checks for Spec 001 server-side rules (contracts/ui-and-rules.md). Run: node tests/api/users-rules.mjs
import { dv } from '../../tools/dv.mjs';

let failed = 0;
async function expectReject(name, fn, contains) {
  try {
    await fn();
    console.log(`FAIL ${name}: accepted`);
    failed++;
  } catch (e) {
    const ok = !contains || e.message.includes(contains);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ': ' + e.message.slice(0, 300)}`);
    if (!ok) failed++;
  }
}

const me = (await dv('GET', 'WhoAmI')).UserId;
const meRow = await dv('GET', `systemusers(${me})?$select=internalemailaddress`);

await expectReject('Create user missing mandatory data is rejected',
  () => dv('POST', 'systemusers', { domainname: 'x.test@gruma.com', lastname: 'Test' }), 'Missing mandatory attributes');
await expectReject('Invalid Manager Email format is rejected',
  () => dv('PATCH', `systemusers(${me})`, { cea_manageremail: 'not-an-email' }), 'invalid format');
await expectReject('User cannot be own manager',
  () => dv('PATCH', `systemusers(${me})`, { cea_manageremail: meRow.internalemailaddress }), 'own manager');
await expectReject('Mandatory attribute cannot be cleared',
  () => dv('PATCH', `systemusers(${me})`, { cea_department: null }), 'cannot be cleared');
await expectReject('Duplicate SAP Number is rejected by alternate key',
  async () => {
    const others = (await dv('GET',
      `systemusers?$select=systemuserid&$filter=systemuserid ne ${me} and isdisabled eq false and applicationid eq null and accessmode eq 0&$top=1`)).value;
    await dv('PATCH', `systemusers(${me})`, { cea_sapnumber: 'TEST-DUP' });
    try {
      await dv('PATCH', `systemusers(${others[0].systemuserid})`, { cea_sapnumber: 'TEST-DUP' });
    } finally {
      // The validation plug-in blocks clearing mandatory data, so pause it only for this cleanup.
      const step = (await dv('GET', `sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid&$filter=name eq 'CEA UserValidation: Update of systemuser'`)).value[0].sdkmessageprocessingstepid;
      await dv('PATCH', `sdkmessageprocessingsteps(${step})`, { statecode: 1, statuscode: 2 });
      await dv('PATCH', `systemusers(${me})`, { cea_sapnumber: null });
      await dv('PATCH', `sdkmessageprocessingsteps(${step})`, { statecode: 0, statuscode: 1 });
    }
  }, 'duplicate');

{
  const other = (await dv('GET',
    `systemusers?$select=internalemailaddress&$filter=systemuserid ne ${me} and isdisabled eq false and applicationid eq null and accessmode eq 0 and internalemailaddress ne null&$top=1`)).value[0];
  const orig = await dv('GET', `systemusers(${me})?$select=cea_manageremail`);
  const check = async (name, email, expected) => {
    await dv('PATCH', `systemusers(${me})`, { cea_manageremail: email });
    const r = await dv('GET', `systemusers(${me})?$select=cea_managerregistered`);
    const ok = r.cea_managerregistered === expected;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
    if (!ok) failed++;
  };
  await check('Manager flag true when manager is a registered active user', other.internalemailaddress, true);
  await check('Manager flag false when manager is not registered', 'nobody.unregistered@gruma.com', false);
  if (orig.cea_manageremail) await dv('PATCH', `systemusers(${me})`, { cea_manageremail: orig.cea_manageremail });
  else {
    const step = (await dv('GET', `sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid&$filter=name eq 'CEA UserValidation: Update of systemuser'`)).value[0].sdkmessageprocessingstepid;
    await dv('PATCH', `sdkmessageprocessingsteps(${step})`, { statecode: 1, statuscode: 2 });
    await dv('PATCH', `systemusers(${me})`, { cea_manageremail: null, cea_managerregistered: false });
    await dv('PATCH', `sdkmessageprocessingsteps(${step})`, { statecode: 0, statuscode: 1 });
  }
}

process.exit(failed ? 1 : 0);

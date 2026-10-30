// Assigns the CEA Administrators role to the signed-in user (dev/test helper).
import { dv, ORG } from './dv.mjs';

const me = (await dv('GET', 'WhoAmI')).UserId;
const role = (await dv('GET', "roles?$select=roleid&$filter=name eq 'CEA Administrators' and parentroleid eq null")).value[0];
try {
  await dv('POST', `systemusers(${me})/systemuserroles_association/$ref`, { '@odata.id': `${ORG}/api/data/v9.2/roles(${role.roleid})` });
  console.log('assigned');
} catch (e) { console.log(e.message.slice(0, 300)); }

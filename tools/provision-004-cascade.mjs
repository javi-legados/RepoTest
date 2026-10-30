// Spec 004: deleting a Draft request deletes its cost and forecast lines (Cascade delete). Idempotent.
import { dv } from './dv.mjs';

for (const name of ['cea_request_costline', 'cea_request_forecastline']) {
  const rel = await dv('GET', `RelationshipDefinitions(SchemaName='${name}')`);
  if (rel.CascadeConfiguration.Delete === 'Cascade') { console.log('=', name); continue; }
  rel.CascadeConfiguration.Delete = 'Cascade';
  await dv('PUT', `RelationshipDefinitions(${rel.MetadataId})`, rel, { 'MSCRM.MergeLabels': 'true' });
  console.log('~', name);
}
await dv('POST', 'PublishAllXml', {});

import { dv } from './dv.mjs';
for (const ent of ['cea_request', 'cea_costline', 'cea_forecastline']) {
  try {
    const d = await dv('GET', `EntityDefinitions(LogicalName='${ent}')`);
    console.log(ent, 'before', d.IsOptimisticConcurrencyEnabled);
    if (!d.IsOptimisticConcurrencyEnabled) {
      d.IsOptimisticConcurrencyEnabled = true;
      await dv('PUT', `EntityDefinitions(LogicalName='${ent}')`, d, { 'MSCRM.MergeLabels': 'true' });
    }
    console.log(ent, 'after', (await dv('GET', `EntityDefinitions(LogicalName='${ent}')?$select=IsOptimisticConcurrencyEnabled`)).IsOptimisticConcurrencyEnabled);
  } catch (e) { console.log(ent, 'ERR', e.message.slice(0, 300)); }
}
await dv('POST', 'PublishAllXml', {});

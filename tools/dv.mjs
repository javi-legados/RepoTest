import { getToken } from './dv-auth.mjs';

export const ORG = process.env.DV_URL || 'https://orgf8f672a6.crm.dynamics.com';
export const SOLUTION = 'CEAPlatform';
export const PREFIX = 'cea';
let token;

export async function dv(method, pathname, body, extraHeaders = {}) {
  token ??= await getToken();
  const r = await fetch(`${ORG}/api/data/v9.2/${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      'OData-Version': '4.0',
      Accept: 'application/json',
      ...(/^(publishers|solutions|AddSolutionComponent)/.test(pathname) || method === 'GET' ? {} : { 'MSCRM.SolutionUniqueName': SOLUTION }),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error(`${method} ${pathname} -> ${r.status}: ${text.slice(0, 600)}`);
    err.status = r.status;
    err.body = text;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

export const label = (text) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.Label',
  LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: text, LanguageCode: 1033 }],
});

export const req = (level = 'ApplicationRequired') => ({ Value: level, CanBeChanged: true });

export function stringAttr(schema, display, { required = false, max = 200, format = 'Text', description = '' } = {}) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
    SchemaName: schema,
    DisplayName: label(display),
    Description: label(description || display),
    RequiredLevel: req(required ? 'ApplicationRequired' : 'None'),
    MaxLength: max,
    FormatName: { Value: format },
  };
}

export function boolAttr(schema, display, def = false) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
    SchemaName: schema,
    DisplayName: label(display),
    RequiredLevel: req('None'),
    DefaultValue: def,
    OptionSet: {
      TrueOption: { Value: 1, Label: label('Yes') },
      FalseOption: { Value: 0, Label: label('No') },
    },
  };
}

export function choiceAttr(schema, display, options, { required = false } = {}) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
    SchemaName: schema,
    DisplayName: label(display),
    RequiredLevel: req(required ? 'ApplicationRequired' : 'None'),
    OptionSet: {
      '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
      IsGlobal: false,
      OptionSetType: 'Picklist',
      Options: options.map(([value, text]) => ({ Value: value, Label: label(text) })),
    },
  };
}

export function dateAttr(schema, display, { required = false, dateOnly = false } = {}) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
    SchemaName: schema,
    DisplayName: label(display),
    RequiredLevel: req(required ? 'ApplicationRequired' : 'None'),
    Format: dateOnly ? 'DateOnly' : 'DateAndTime',
    DateTimeBehavior: { Value: dateOnly ? 'DateOnly' : 'UserLocal' },
  };
}

export async function exists(pathname) {
  try {
    await dv('GET', pathname);
    return true;
  } catch (e) {
    if (e.status === 404) return false;
    throw e;
  }
}

export async function ensureAttribute(entity, attr) {
  const logical = attr.SchemaName.toLowerCase();
  if (await exists(`EntityDefinitions(LogicalName='${entity}')/Attributes(LogicalName='${logical}')?$select=LogicalName`)) {
    console.log(`  = ${entity}.${logical}`);
    return;
  }
  await dv('POST', `EntityDefinitions(LogicalName='${entity}')/Attributes`, attr);
  console.log(`  + ${entity}.${logical}`);
}

export async function ensureTable(def, attrs) {
  const logical = def.SchemaName.toLowerCase();
  if (await exists(`EntityDefinitions(LogicalName='${logical}')?$select=LogicalName`)) {
    console.log(`= table ${logical}`);
  } else {
    const primary = def.primary;
    const body = {
      '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
      SchemaName: def.SchemaName,
      DisplayName: label(def.display),
      DisplayCollectionName: label(def.plural),
      Description: label(def.description || def.display),
      OwnershipType: def.ownership || 'OrganizationOwned',
      HasActivities: false,
      HasNotes: false,
      IsAuditEnabled: { Value: !!def.audit, CanBeChanged: true },
      Attributes: [
        {
          '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
          SchemaName: primary.schema,
          DisplayName: label(primary.display),
          RequiredLevel: req('SystemRequired'),
          MaxLength: primary.max || 200,
          FormatName: { Value: 'Text' },
          IsPrimaryName: true,
          ...(primary.autonumber ? { AutoNumberFormat: primary.autonumber } : {}),
        },
      ],
    };
    await dv('POST', 'EntityDefinitions', body);
    console.log(`+ table ${logical}`);
  }
  for (const a of attrs) await ensureAttribute(logical, a);
}

export async function ensureLookup(from, to, schemaName, lookupSchema, display, { required = false } = {}) {
  if (await exists(`RelationshipDefinitions(SchemaName='${schemaName}')?$select=SchemaName`)) {
    console.log(`  = rel ${schemaName}`);
    return;
  }
  await dv('POST', 'RelationshipDefinitions', {
    '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
    SchemaName: schemaName,
    ReferencedEntity: to,
    ReferencingEntity: from,
    CascadeConfiguration: {
      Assign: 'NoCascade', Delete: 'Restrict', Merge: 'NoCascade', Reparent: 'NoCascade', Share: 'NoCascade', Unshare: 'NoCascade',
    },
    Lookup: {
      '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
      SchemaName: lookupSchema,
      DisplayName: label(display),
      RequiredLevel: req(required ? 'ApplicationRequired' : 'None'),
    },
  });
  console.log(`  + rel ${schemaName}`);
}

export function decimalAttr(schema, display, { required = false, min = -100000000000, max = 100000000000 } = {}) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata',
    SchemaName: schema,
    DisplayName: label(display),
    RequiredLevel: req(required ? 'ApplicationRequired' : 'None'),
    Precision: 2,
    MinValue: min,
    MaxValue: max,
  };
}

export function intAttr(schema, display, { required = false, min = 0, max = 2147483647 } = {}) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
    SchemaName: schema,
    DisplayName: label(display),
    RequiredLevel: req(required ? 'ApplicationRequired' : 'None'),
    Format: 'None',
    MinValue: min,
    MaxValue: max,
  };
}

export function memoAttr(schema, display, { required = false, max = 100000 } = {}) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
    SchemaName: schema,
    DisplayName: label(display),
    RequiredLevel: req(required ? 'ApplicationRequired' : 'None'),
    MaxLength: max,
    Format: 'TextArea',
  };
}

using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 001 (FR-011): a catalog entry in use cannot be deleted; it must be deactivated instead.
    // Registered PreValidation on Delete of cea_company, cea_region and cea_plant.
    public class CatalogDeleteGuard : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var target = context.InputParameters["Target"] as EntityReference;
            if (target == null) return;

            var row = service.Retrieve(target.LogicalName, target.Id, new ColumnSet("cea_businessunitid"));
            var bu = row.GetAttributeValue<EntityReference>("cea_businessunitid");

            var inUse = false;
            if (target.LogicalName == "cea_company") inUse = Exists(service, "cea_region", "cea_companyid", target.Id);
            else if (target.LogicalName == "cea_region") inUse = Exists(service, "cea_plant", "cea_regionid", target.Id);
            if (!inUse && bu != null) inUse = Exists(service, "systemuser", "businessunitid", bu.Id);

            if (inUse)
                throw new InvalidPluginExecutionException(
                    "This catalog entry is in use (child entries or users reference it) and cannot be deleted. Deactivate it instead.");
        }

        private static bool Exists(IOrganizationService service, string entity, string attribute, Guid id)
        {
            var q = new QueryByAttribute(entity) { ColumnSet = new ColumnSet(false), TopCount = 1 };
            q.AddAttributeValue(attribute, id);
            return service.RetrieveMultiple(q).Entities.Count > 0;
        }
    }
}

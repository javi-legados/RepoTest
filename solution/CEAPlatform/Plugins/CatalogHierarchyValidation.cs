using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 001 (FR-009, FR-010): Region must sit under an active Company and Plant under an active Region.
    // Registered PreValidation on Create/Update of cea_region and cea_plant.
    public class CatalogHierarchyValidation : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var target = context.InputParameters["Target"] as Entity;
            if (target == null) return;

            string parentAttr = target.LogicalName == "cea_region" ? "cea_companyid" : target.LogicalName == "cea_plant" ? "cea_regionid" : null;
            if (parentAttr == null) return;
            var parentType = target.LogicalName == "cea_region" ? "cea_company" : "cea_region";

            var parent = target.GetAttributeValue<EntityReference>(parentAttr);
            if (context.MessageName == "Create" && parent == null)
                throw new InvalidPluginExecutionException(
                    (target.LogicalName == "cea_region" ? "A Region must belong to a Company." : "A Plant must belong to a Region."));
            if (parent == null) return;
            if (parent.LogicalName != parentType)
                throw new InvalidPluginExecutionException("Invalid hierarchy: expected a parent of type " + parentType + ".");

            var row = service.Retrieve(parentType, parent.Id, new ColumnSet("cea_status"));
            var status = row.GetAttributeValue<OptionSetValue>("cea_status");
            if (status != null && status.Value != 1)
                throw new InvalidPluginExecutionException("The parent entry is inactive. Choose an active parent.");
        }
    }
}

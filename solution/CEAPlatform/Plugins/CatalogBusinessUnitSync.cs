using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 001 (FR-009): keeps a Business Unit linked to every catalog entry with the right cea_level and parent.
    // Registered PostOperation on Create of cea_company/cea_region/cea_plant and on Update of cea_name.
    public class CatalogBusinessUnitSync : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var target = context.InputParameters["Target"] as Entity;
            if (target == null) return;

            if (context.MessageName == "Create") OnCreate(service, target);
            else OnRename(service, target);
        }

        private static void OnCreate(IOrganizationService service, Entity target)
        {
            var cols = target.LogicalName == "cea_region" ? new ColumnSet("cea_name", "cea_businessunitid", "cea_companyid")
                : target.LogicalName == "cea_plant" ? new ColumnSet("cea_name", "cea_businessunitid", "cea_regionid")
                : new ColumnSet("cea_name", "cea_businessunitid");
            var row = service.Retrieve(target.LogicalName, target.Id, cols);
            if (row.GetAttributeValue<EntityReference>("cea_businessunitid") != null) return;

            Guid parentBu;
            int level;
            switch (target.LogicalName)
            {
                case "cea_company":
                    level = 2;
                    var rootQ = new QueryExpression("businessunit") { ColumnSet = new ColumnSet(false), TopCount = 1 };
                    rootQ.Criteria.AddCondition("parentbusinessunitid", ConditionOperator.Null);
                    parentBu = service.RetrieveMultiple(rootQ).Entities[0].Id;
                    break;
                case "cea_region":
                    level = 3;
                    parentBu = BuOf(service, "cea_company", row.GetAttributeValue<EntityReference>("cea_companyid"));
                    break;
                default:
                    level = 4;
                    parentBu = BuOf(service, "cea_region", row.GetAttributeValue<EntityReference>("cea_regionid"));
                    break;
            }

            var bu = new Entity("businessunit");
            bu["name"] = row.GetAttributeValue<string>("cea_name");
            bu["parentbusinessunitid"] = new EntityReference("businessunit", parentBu);
            bu["cea_level"] = new OptionSetValue(level);
            var buId = service.Create(bu);

            var link = new Entity(target.LogicalName, target.Id);
            link["cea_businessunitid"] = new EntityReference("businessunit", buId);
            service.Update(link);
        }

        private static void OnRename(IOrganizationService service, Entity target)
        {
            if (!target.Contains("cea_name")) return;
            var row = service.Retrieve(target.LogicalName, target.Id, new ColumnSet("cea_businessunitid"));
            var bu = row.GetAttributeValue<EntityReference>("cea_businessunitid");
            if (bu == null) return;
            var upd = new Entity("businessunit", bu.Id);
            upd["name"] = target.GetAttributeValue<string>("cea_name");
            service.Update(upd);
        }

        private static Guid BuOf(IOrganizationService service, string parentType, EntityReference parent)
        {
            if (parent == null) throw new InvalidPluginExecutionException("The parent catalog entry is missing.");
            var p = service.Retrieve(parentType, parent.Id, new ColumnSet("cea_businessunitid"));
            var bu = p.GetAttributeValue<EntityReference>("cea_businessunitid");
            if (bu == null) throw new InvalidPluginExecutionException("The parent catalog entry has no linked Business Unit.");
            return bu.Id;
        }
    }
}

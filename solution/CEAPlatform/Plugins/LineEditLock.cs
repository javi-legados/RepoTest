using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 002 T010 (R5, FR-003): cost and forecast lines follow the request edit lock.
    // Non-administrators can change lines only while the request is Draft, Rejected or Returned to Creator.
    // PreValidation Create/Update/Delete of cea_costline and cea_forecastline; nested calls (cascades, plug-in writes) are ignored.
    public class LineEditLock : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context.Depth > 1) return;
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);

            EntityReference requestRef = null;
            var target = context.InputParameters.Contains("Target") ? context.InputParameters["Target"] : null;
            var entity = target as Entity;
            if (entity != null) requestRef = entity.GetAttributeValue<EntityReference>("cea_requestid");
            if (requestRef == null)
            {
                Guid id = entity != null ? entity.Id : (target is EntityReference ? ((EntityReference)target).Id : Guid.Empty);
                string logical = entity != null ? entity.LogicalName : context.PrimaryEntityName;
                if (id == Guid.Empty) return;
                requestRef = service.Retrieve(logical, id, new ColumnSet("cea_requestid")).GetAttributeValue<EntityReference>("cea_requestid");
            }
            if (requestRef == null) return;

            var status = service.Retrieve("cea_request", requestRef.Id, new ColumnSet("cea_status")).GetAttributeValue<OptionSetValue>("cea_status");
            if (status == null || status.Value == 1 || status.Value == 4 || status.Value == 9) return;
            if (CeaRoles.IsAdmin(CeaRoles.Of(service, context.InitiatingUserId))) return;
            throw new InvalidPluginExecutionException("The request is locked while it is under review or approved.");
        }
    }
}

using System;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;

namespace CEAPlatform.Plugins
{
    // Spec 002 T014 (R3, FR-004): when a level starts (Pending Approver changes), the request is shared Read with that approver.
    // The share is never revoked, so the approver keeps access after deciding. PostOperation Update of cea_request (cea_pendingapproverid).
    public class GrantApproverAccess : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var target = context.InputParameters["Target"] as Entity;
            if (target == null || !target.Contains("cea_pendingapproverid")) return;
            var approver = target.GetAttributeValue<EntityReference>("cea_pendingapproverid");
            if (approver == null) return;
            service.Execute(new GrantAccessRequest
            {
                Target = new EntityReference("cea_request", target.Id),
                PrincipalAccess = new PrincipalAccess { Principal = new EntityReference("systemuser", approver.Id), AccessMask = AccessRights.ReadAccess | AccessRights.AppendToAccess }
            });
        }
    }
}

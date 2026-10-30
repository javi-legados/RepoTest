using System;
using Microsoft.Xrm.Sdk;

namespace CEAPlatform.Plugins
{
    // Spec 002 (R3/R4/R10): guard skeleton for approve/reject actions. Rules are enabled with Spec 5.
    // Denials are written in PreValidation (outside the DB transaction) so the record survives the exception.
    public class DecisionGuard : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            if (!context.InputParameters.Contains("Request")) return;
            var reqRef = (EntityReference)context.InputParameters["Request"];
            var request = service.Retrieve("cea_request", reqRef.Id, new Microsoft.Xrm.Sdk.Query.ColumnSet("cea_requestnumber", "createdby", "cea_status"));
            var status = request.GetAttributeValue<OptionSetValue>("cea_status");
            if (status == null || status.Value != 3) return;

            var reject = string.Equals(context.MessageName, "cea_RejectStep", StringComparison.OrdinalIgnoreCase);
            var comments = context.InputParameters.Contains("Comments") ? context.InputParameters["Comments"] as string : null;
            var current = ChainAdvance.FirstWithStatus(ChainAdvance.Steps(service, reqRef.Id), 1);
            var approver = current == null ? null : current.GetAttributeValue<EntityReference>("cea_approverid");
            var creator = request.GetAttributeValue<EntityReference>("createdby");
            var roles = CeaRoles.Of(service, context.InitiatingUserId);

            string reason = null;
            if (current == null || approver == null || approver.Id != context.InitiatingUserId)
                reason = "The request is not pending at the user's level.";
            else if (creator != null && creator.Id == context.InitiatingUserId)
                reason = "Users cannot decide on a request they created.";
            else if (roles.Contains("CEA Administrators") && !roles.Contains("CEA Internal Approvals"))
                reason = "Administrators cannot decide at approval-chain steps.";
            else if (comments == null || comments.Trim().Length == 0)
                reason = "A comment is required to approve or reject.";
            if (reason == null) return;

            RecordDenial(serviceProvider, context.InitiatingUserId, reject ? 2 : 1, request.GetAttributeValue<string>("cea_requestnumber"), reason);
        }

        public static void RecordDenial(IServiceProvider serviceProvider, Guid userId, int action, string requestReference, string reason)
        {
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var system = factory.CreateOrganizationService(null);
            var record = new Entity("cea_accessdenialrecord");
            record["cea_name"] = "Denied: " + reason;
            record["cea_action"] = new OptionSetValue(action);
            record["cea_requestreference"] = requestReference;
            record["cea_reason"] = reason;
            record["cea_occurredon"] = DateTime.UtcNow;
            record["cea_userid"] = new EntityReference("systemuser", userId);
            system.Create(record);
        }
    }
}

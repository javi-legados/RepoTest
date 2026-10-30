using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 003 (FR-001, FR-002, R1, R2): validates Approver Assignment on Create/Update (PreValidation).
    // Role Type must match the Business Unit level, the approver must be active with the CEA Internal Approvals role,
    // and only one active assignment may exist per Business Unit + Role Type.
    public class ApproverAssignmentValidation : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var target = context.InputParameters["Target"] as Entity;
            if (target == null || target.LogicalName != "cea_approverassignment") return;

            Entity current = target;
            if (context.MessageName == "Update")
            {
                current = service.Retrieve("cea_approverassignment", target.Id,
                    new ColumnSet("cea_businessunitid", "cea_roletype", "cea_approverid", "cea_status"));
                foreach (var a in target.Attributes) current[a.Key] = a.Value;
            }

            var bu = current.GetAttributeValue<EntityReference>("cea_businessunitid");
            var approver = current.GetAttributeValue<EntityReference>("cea_approverid");
            var roleType = current.GetAttributeValue<OptionSetValue>("cea_roletype");
            var status = current.GetAttributeValue<OptionSetValue>("cea_status");
            if (bu == null || approver == null || roleType == null) return;

            var buRow = service.Retrieve("businessunit", bu.Id, new ColumnSet("cea_level"));
            var level = buRow.GetAttributeValue<OptionSetValue>("cea_level");
            int expected = roleType.Value == 1 ? 4 : 3;
            if (level == null || level.Value != expected)
                throw new InvalidPluginExecutionException(roleType.Value == 1
                    ? "A Plant Manager can only be assigned to a Plant business unit."
                    : "A Regional Approver can only be assigned to a Region business unit.");

            if (status != null && status.Value != 1) return;

            var user = service.Retrieve("systemuser", approver.Id, new ColumnSet("isdisabled", "fullname"));
            if (user.GetAttributeValue<bool>("isdisabled"))
                throw new InvalidPluginExecutionException("The selected approver is inactive. Choose an active user.");
            if (!HasInternalApprovalsRole(service, approver.Id))
                throw new InvalidPluginExecutionException("The selected approver does not have the CEA Internal Approvals role.");

            var dup = new QueryExpression("cea_approverassignment") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            dup.Criteria.AddCondition("cea_businessunitid", ConditionOperator.Equal, bu.Id);
            dup.Criteria.AddCondition("cea_roletype", ConditionOperator.Equal, roleType.Value);
            dup.Criteria.AddCondition("cea_status", ConditionOperator.Equal, 1);
            if (context.MessageName == "Update") dup.Criteria.AddCondition("cea_approverassignmentid", ConditionOperator.NotEqual, target.Id);
            if (service.RetrieveMultiple(dup).Entities.Count > 0)
                throw new InvalidPluginExecutionException("This business unit already has an active approver for this role type. Edit or deactivate it first.");
        }

        private static bool HasInternalApprovalsRole(IOrganizationService service, Guid userId)
        {
            var q = new QueryExpression("role") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            q.Criteria.AddCondition("name", ConditionOperator.Equal, "CEA Internal Approvals");
            var link = q.AddLink("systemuserroles", "roleid", "roleid");
            link.LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, userId);
            return service.RetrieveMultiple(q).Entities.Count > 0;
        }
    }
}

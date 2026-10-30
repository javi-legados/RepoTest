using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 002 T021 (FR-016, FR-017, R9): when an approver changes Business Unit or loses an approver role, their undecided steps
    // are flagged cea_needsreassignment for an administrator. Request history and the steps themselves are not altered otherwise.
    // PostOperation on Update of systemuser (businessunitid) and on Disassociate of systemuserroles_association.
    public class ApproverReassignmentFlag : IPlugin
    {
        private static readonly string[] ApproverRoles = { "CEA Internal Approvals", "CEA Approvals" };

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);

            var users = new List<Guid>();
            if (context.MessageName == "Update")
            {
                var target = context.InputParameters["Target"] as Entity;
                if (target == null || target.LogicalName != "systemuser" || !target.Contains("businessunitid")) return;
                var pre = context.PreEntityImages.Contains("PreImage") ? context.PreEntityImages["PreImage"] : null;
                var oldBu = pre == null ? null : pre.GetAttributeValue<EntityReference>("businessunitid");
                var newBu = target.GetAttributeValue<EntityReference>("businessunitid");
                if (oldBu != null && newBu != null && oldBu.Id == newBu.Id) return;
                users.Add(target.Id);
            }
            else
            {
                var rel = context.InputParameters.Contains("Relationship") ? context.InputParameters["Relationship"] as Relationship : null;
                if (rel == null || rel.SchemaName != "systemuserroles_association") return;
                var target = context.InputParameters["Target"] as EntityReference;
                var related = context.InputParameters["RelatedEntities"] as EntityReferenceCollection;
                if (target == null || related == null) return;
                foreach (var other in related)
                {
                    var user = target.LogicalName == "systemuser" ? target : other;
                    var role = target.LogicalName == "role" ? target : other;
                    var name = service.Retrieve("role", role.Id, new ColumnSet("name")).GetAttributeValue<string>("name");
                    if (Array.IndexOf(ApproverRoles, name) >= 0) users.Add(user.Id);
                }
            }

            foreach (var userId in users) Flag(service, userId);
        }

        private static void Flag(IOrganizationService service, Guid userId)
        {
            var q = new QueryExpression("cea_resolvedapprover") { ColumnSet = new ColumnSet("cea_needsreassignment") };
            q.Criteria.AddCondition("cea_approverid", ConditionOperator.Equal, userId);
            q.Criteria.AddCondition("cea_decided", ConditionOperator.Equal, false);
            q.Criteria.AddCondition("cea_stepstatus", ConditionOperator.In, 1, 6);
            foreach (var s in service.RetrieveMultiple(q).Entities)
            {
                if (s.GetAttributeValue<bool>("cea_needsreassignment")) continue;
                var u = new Entity("cea_resolvedapprover", s.Id);
                u["cea_needsreassignment"] = true;
                service.Update(u);
            }
        }
    }
}

using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 003 US4 (FR-009, SC-005): cea_ReassignApprover (Custom API). Administrator only; Reason required;
    // the new approver must be active with CEA Internal Approvals. Only undecided steps can be reassigned.
    public class ReassignApprover : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            if (!CeaRoles.IsAdmin(CeaRoles.Of(service, context.InitiatingUserId)))
                throw new InvalidPluginExecutionException("Only CEA Administrators can reassign an approver.");

            var reason = context.InputParameters.Contains("Reason") ? context.InputParameters["Reason"] as string : null;
            if (string.IsNullOrWhiteSpace(reason)) throw new InvalidPluginExecutionException("A reason is required to reassign an approver.");
            var reqRef = (EntityReference)context.InputParameters["Request"];
            int level = Convert.ToInt32(context.InputParameters["Level"]);
            var newRef = (EntityReference)context.InputParameters["NewApprover"];

            var request = service.Retrieve("cea_request", reqRef.Id, new ColumnSet("cea_status", "cea_requestnumber"));
            var status = request.GetAttributeValue<OptionSetValue>("cea_status");
            if (status == null || (status.Value != 3 && status.Value != 8))
                throw new InvalidPluginExecutionException("Approvers can only be reassigned while the request is pending approval or on hold.");

            var steps = ChainAdvance.Steps(service, reqRef.Id);
            Entity step = null;
            foreach (var s in steps) if (ChainAdvance.Level(s) == level) step = s;
            var st = step == null ? null : step.GetAttributeValue<OptionSetValue>("cea_stepstatus");
            if (step == null || st == null || (st.Value != 1 && st.Value != 6))
                throw new InvalidPluginExecutionException("The selected level has no undecided step to reassign.");

            var user = service.Retrieve("systemuser", newRef.Id, new ColumnSet("isdisabled"));
            if (user.GetAttributeValue<bool>("isdisabled")) throw new InvalidPluginExecutionException("The new approver is inactive. Choose an active user.");
            if (!CeaRoles.Of(service, newRef.Id).Contains("CEA Internal Approvals"))
                throw new InvalidPluginExecutionException("The new approver does not have the CEA Internal Approvals role.");

            var previous = step.GetAttributeValue<EntityReference>("cea_approverid");
            var u = new Entity("cea_resolvedapprover", step.Id);
            u["cea_approverid"] = new EntityReference("systemuser", newRef.Id);
            u["ownerid"] = new EntityReference("systemuser", newRef.Id);
            u["cea_needsreassignment"] = false;
            service.Update(u);

            var current = ChainAdvance.FirstWithStatus(ChainAdvance.Steps(service, reqRef.Id), 1);
            if (current != null && current.Id == step.Id)
            {
                var r = new Entity("cea_request", reqRef.Id);
                r["cea_pendingapproverid"] = new EntityReference("systemuser", newRef.Id);
                service.Update(r);
            }

            var rec = new Entity("cea_reassignmentrecord");
            var number = request.GetAttributeValue<string>("cea_requestnumber");
            rec["cea_name"] = "Reassigned " + number + " - " + ChainAdvance.LevelNames[level];
            rec["cea_requestreference"] = number;
            rec["cea_level"] = new OptionSetValue(level);
            rec["cea_reason"] = reason;
            rec["cea_changedon"] = DateTime.UtcNow;
            if (previous != null) rec["cea_previousapproverid"] = previous;
            rec["cea_newapproverid"] = new EntityReference("systemuser", newRef.Id);
            rec["cea_changedbyid"] = new EntityReference("systemuser", context.InitiatingUserId);
            service.Create(rec);
        }
    }

    // Spec 003 (FR-011, T018/T019/T024): when an Approver Assignment changes approver or is deactivated, undecided steps of the
    // previous approver at the matching level follow the new approver, or are flagged Needs Reassignment when none remains.
    public class ApproverChangePropagation : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context.Depth > 1) return;
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var target = context.InputParameters["Target"] as Entity;
            var pre = context.PreEntityImages.Contains("PreImage") ? context.PreEntityImages["PreImage"] : null;
            if (target == null || pre == null) return;

            var oldApprover = pre.GetAttributeValue<EntityReference>("cea_approverid");
            var roleType = pre.GetAttributeValue<OptionSetValue>("cea_roletype");
            if (oldApprover == null || roleType == null) return;
            int level = roleType.Value == 1 ? 2 : 3;
            var newApprover = target.Contains("cea_approverid") ? target.GetAttributeValue<EntityReference>("cea_approverid") : oldApprover;
            var status = target.Contains("cea_status") ? target.GetAttributeValue<OptionSetValue>("cea_status") : pre.GetAttributeValue<OptionSetValue>("cea_status");
            bool active = status == null || status.Value == 1;
            if (active && newApprover != null && newApprover.Id == oldApprover.Id) return;

            var q = new QueryExpression("cea_resolvedapprover") { ColumnSet = new ColumnSet("cea_requestid") };
            q.Criteria.AddCondition("cea_approverid", ConditionOperator.Equal, oldApprover.Id);
            q.Criteria.AddCondition("cea_level", ConditionOperator.Equal, level);
            q.Criteria.AddCondition("cea_decided", ConditionOperator.Equal, false);
            q.Criteria.AddCondition("cea_stepstatus", ConditionOperator.In, 1, 6);
            foreach (var s in service.RetrieveMultiple(q).Entities)
            {
                var u = new Entity("cea_resolvedapprover", s.Id);
                if (active && newApprover != null)
                {
                    u["cea_approverid"] = new EntityReference("systemuser", newApprover.Id);
                    u["ownerid"] = new EntityReference("systemuser", newApprover.Id);
                    var req = s.GetAttributeValue<EntityReference>("cea_requestid");
                    var cur = req == null ? null : ChainAdvance.FirstWithStatus(ChainAdvance.Steps(service, req.Id), 1);
                    if (cur != null && cur.Id == s.Id)
                    {
                        var r = new Entity("cea_request", req.Id);
                        r["cea_pendingapproverid"] = new EntityReference("systemuser", newApprover.Id);
                        service.Update(r);
                    }
                }
                else u["cea_needsreassignment"] = true;
                service.Update(u);
            }
        }
    }
}

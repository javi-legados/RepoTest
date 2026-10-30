using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    public static class FinalStatus
    {
        public const int FinalProcessing = 10, Completed = 7;
    }

    // Spec 010: CompleteRequest (Custom API). Administrator only; Final Processing only; Confirmation required.
    public class CompleteRequest : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            if (!CeaRoles.IsAdmin(CeaRoles.Of(service, context.InitiatingUserId)))
                throw new InvalidPluginExecutionException("Only CEA Administrators can complete a request.");
            var confirmed = context.InputParameters.Contains("Confirmation") && context.InputParameters["Confirmation"] is bool && (bool)context.InputParameters["Confirmation"];
            if (!confirmed) throw new InvalidPluginExecutionException("Confirmation is required to complete the request.");
            var reqRef = (EntityReference)context.InputParameters["Request"];
            var request = service.Retrieve("cea_request", reqRef.Id, new ColumnSet("cea_status", "ownerid"));
            var status = request.GetAttributeValue<OptionSetValue>("cea_status");
            if (status != null && status.Value == FinalStatus.Completed) throw new InvalidPluginExecutionException("The request is already completed.");
            if (status == null || status.Value != FinalStatus.FinalProcessing) throw new InvalidPluginExecutionException("The request is not in Final Processing.");

            var u = new Entity("cea_request", request.Id);
            u["cea_status"] = new OptionSetValue(FinalStatus.Completed);
            u["cea_statuschangedon"] = DateTime.UtcNow;
            u["cea_completedbyid"] = new EntityReference("systemuser", context.InitiatingUserId);
            u["cea_completedon"] = DateTime.UtcNow;
            service.Update(u);
            Notifier.Enqueue(service, request.Id, Notifier.FinalCompleted, Notifier.Creator, request.GetAttributeValue<EntityReference>("ownerid").Id, null, null);
        }
    }

    // Spec 010 (FR-011): PostOperation Update of request / cost line / forecast line during Final Processing; one record per changed field.
    public class DataCorrectionLogger : IPlugin
    {
        private static readonly HashSet<string> Skip = new HashSet<string> { "modifiedon", "modifiedby", "modifiedonbehalfby", "cea_statuschangedon", "versionnumber" };

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context.Depth > 1) return;
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var target = (Entity)context.InputParameters["Target"];
            var pre = context.PreEntityImages.Contains("PreImage") ? context.PreEntityImages["PreImage"] : null;
            if (pre == null) return;

            Guid requestId;
            if (target.LogicalName == "cea_request")
            {
                var s = pre.GetAttributeValue<OptionSetValue>("cea_status");
                if (s == null || s.Value != FinalStatus.FinalProcessing) return;
                requestId = target.Id;
            }
            else
            {
                var r = pre.GetAttributeValue<EntityReference>("cea_requestid");
                if (r == null) return;
                var s = service.Retrieve("cea_request", r.Id, new ColumnSet("cea_status")).GetAttributeValue<OptionSetValue>("cea_status");
                if (s == null || s.Value != FinalStatus.FinalProcessing) return;
                requestId = r.Id;
            }
            foreach (var a in target.Attributes)
            {
                if (Skip.Contains(a.Key)) continue;
                var oldV = Text(pre.Contains(a.Key) ? pre[a.Key] : null);
                var newV = Text(a.Value);
                if (oldV == newV) continue;
                var rec = new Entity("cea_datacorrectionrecord");
                rec["cea_name"] = target.LogicalName + "." + a.Key;
                rec["cea_requestid"] = new EntityReference("cea_request", requestId);
                rec["cea_field"] = target.LogicalName + "." + a.Key;
                rec["cea_oldvalue"] = oldV;
                rec["cea_newvalue"] = newV;
                rec["cea_changedbyid"] = new EntityReference("systemuser", context.InitiatingUserId);
                rec["cea_changedon"] = DateTime.UtcNow;
                service.Create(rec);
            }
        }

        private static string Text(object v)
        {
            string s;
            if (v == null) s = "";
            else if (v is OptionSetValue) s = ((OptionSetValue)v).Value.ToString();
            else if (v is Money) s = ((Money)v).Value.ToString();
            else if (v is EntityReference) s = ((EntityReference)v).Id.ToString();
            else s = Convert.ToString(v);
            return s.Length > 500 ? s.Substring(0, 500) : s;
        }
    }

    // Spec 010 (FR-010, R8): PreValidation Update/Delete of request, cost and forecast lines once Completed: rejected for every role.
    public class CompletedLockGuard : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context.Depth > 1) return;
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            Guid requestId;
            string logical; Guid id;
            var er = context.InputParameters["Target"] as EntityReference;
            var en = context.InputParameters["Target"] as Entity;
            if (er != null) { logical = er.LogicalName; id = er.Id; } else { logical = en.LogicalName; id = en.Id; }

            if (logical == "cea_request") requestId = id;
            else
            {
                EntityReference r = en != null ? en.GetAttributeValue<EntityReference>("cea_requestid") : null;
                if (r == null && id != Guid.Empty) r = service.Retrieve(logical, id, new ColumnSet("cea_requestid")).GetAttributeValue<EntityReference>("cea_requestid");
                if (r == null) return;
                requestId = r.Id;
            }
            var s = service.Retrieve("cea_request", requestId, new ColumnSet("cea_status")).GetAttributeValue<OptionSetValue>("cea_status");
            if (s != null && s.Value == FinalStatus.Completed)
                throw new InvalidPluginExecutionException("The request is Completed and can no longer be changed.");
        }
    }
}

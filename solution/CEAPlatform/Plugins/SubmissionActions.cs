using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    public static class CeaRoles
    {
        public static HashSet<string> Of(IOrganizationService service, Guid userId)
        {
            var q = new QueryExpression("role") { ColumnSet = new ColumnSet("name") };
            var link = q.AddLink("systemuserroles", "roleid", "roleid");
            link.LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, userId);
            var set = new HashSet<string>();
            foreach (var e in service.RetrieveMultiple(q).Entities) set.Add(e.GetAttributeValue<string>("name"));
            return set;
        }

        public static bool IsAdmin(HashSet<string> roles)
        {
            return roles.Contains("CEA Administrators") || roles.Contains("System Administrator");
        }
    }

    // Spec 006: custom API actions cea_SubmitRequest, cea_ReleaseToApproval, cea_ReturnToCreator.
    public abstract class RequestAction : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var reqRef = (EntityReference)context.InputParameters["Request"];
            // Row lock first: concurrent actions on one request serialize here, so the loser re-reads the new status (rolled back with the transaction on failure).
            var lockRow = new Entity("cea_request", reqRef.Id);
            lockRow["cea_statuschangedon"] = DateTime.UtcNow;
            service.Update(lockRow);
            var request = service.Retrieve("cea_request", reqRef.Id, new ColumnSet(true));
            var roles = CeaRoles.Of(service, context.InitiatingUserId);
            context.OutputParameters["Result"] = Run(context, service, request, roles);
        }

        protected abstract string Run(IPluginExecutionContext context, IOrganizationService service, Entity request, HashSet<string> roles);

        protected static int Status(Entity request)
        {
            var s = request.GetAttributeValue<OptionSetValue>("cea_status");
            return s == null ? 0 : s.Value;
        }

        protected static void SetStatus(IOrganizationService service, Entity request, int status, Entity extra)
        {
            var u = extra ?? new Entity("cea_request");
            u.LogicalName = "cea_request";
            u.Id = request.Id;
            u["cea_status"] = new OptionSetValue(status);
            u["cea_statuschangedon"] = DateTime.UtcNow;
            service.Update(u);
        }

        protected static Entity OpenReview(IOrganizationService service, Guid requestId)
        {
            var q = new QueryExpression("cea_initialreview") { ColumnSet = new ColumnSet(true), TopCount = 1 };
            q.Criteria.AddCondition("cea_requestid", ConditionOperator.Equal, requestId);
            q.Criteria.AddCondition("cea_state", ConditionOperator.Equal, 1);
            var r = service.RetrieveMultiple(q);
            if (r.Entities.Count == 0) throw new InvalidPluginExecutionException("The initial review is already closed or does not exist.");
            return r.Entities[0];
        }

        protected static void CloseReview(IOrganizationService service, Entity review, int state, string comments, Guid userId)
        {
            var u = new Entity("cea_initialreview", review.Id);
            u["cea_state"] = new OptionSetValue(state);
            u["cea_outcome"] = new OptionSetValue(state == 2 ? 1 : 2);
            u["cea_reviewedbyid"] = new EntityReference("systemuser", userId);
            u["cea_reviewedon"] = DateTime.UtcNow;
            if (comments != null) u["cea_comments"] = comments;
            service.Update(u);
        }

        protected static void RequireAdmin(HashSet<string> roles)
        {
            if (!CeaRoles.IsAdmin(roles)) throw new InvalidPluginExecutionException("Only CEA Administrators can perform this action.");
        }
    }

    public class SubmitRequest : RequestAction
    {
        protected virtual bool Revision { get { return false; } }
        protected override string Run(IPluginExecutionContext context, IOrganizationService service, Entity request, HashSet<string> roles)
        {
            var owner = request.GetAttributeValue<EntityReference>("ownerid");
            if (!CeaRoles.IsAdmin(roles) && (!roles.Contains("CEA Creators") || owner.Id != context.InitiatingUserId))
                throw new InvalidPluginExecutionException("Only the Creator or a CEA Administrator can submit this request.");
            var status = Status(request);
            if (Revision ? status != 9 : status != 1) throw new InvalidPluginExecutionException(Revision ? "The request is not Returned to Creator; it cannot be resubmitted." : "The request is not in Draft; use Resubmit for a returned request.");

            var problems = new List<string>();
            Func<string, bool> empty = delegate(string a) { return request.GetAttributeValue<object>(a) == null || (request[a] is string && ((string)request[a]).Trim().Length == 0); };
            bool supplemental = request.GetAttributeValue<bool>("cea_supplemental");
            if (!supplemental && empty("cea_projectname")) problems.Add("Project Name");
            if (supplemental && empty("cea_existingceareferenceid")) problems.Add("Existing CEA Reference");
            foreach (var p in new[] { "cea_descriptionsummary", "cea_projectlocationid", "cea_startdate", "cea_estimatedcompletiondate", "cea_category", "cea_currency", "cea_detaileddescription" })
                if (empty(p)) problems.Add(p.Replace("cea_", "").Replace("id", ""));
            var grand = request.GetAttributeValue<decimal?>("cea_grandtotal");
            if (!grand.HasValue || grand.Value <= 0) problems.Add("Grand Total must be greater than 0");
            var pct = request.GetAttributeValue<decimal?>("cea_forecastpercentage");
            if (!pct.HasValue || pct.Value != 100m) problems.Add("Forecast percentages must add up to 100");
            if (problems.Count > 0) throw new InvalidPluginExecutionException("The request is incomplete: " + string.Join("; ", problems.ToArray()) + ".");

            var fetch = "<fetch top='1'><entity name='systemuser'><attribute name='systemuserid'/><filter><condition attribute='isdisabled' operator='eq' value='0'/></filter>"
                + "<link-entity name='systemuserroles' from='systemuserid' to='systemuserid'><link-entity name='role' from='roleid' to='roleid'><filter><condition attribute='name' operator='eq' value='CEA Administrators'/></filter></link-entity></link-entity></entity></fetch>";
            if (service.RetrieveMultiple(new FetchExpression(fetch)).Entities.Count == 0)
                throw new InvalidPluginExecutionException("There is no active CEA Administrator to review the request.");

            var upd = new Entity("cea_request");
            upd["cea_submittedbyid"] = new EntityReference("systemuser", context.InitiatingUserId);
            upd["cea_submittedon"] = DateTime.UtcNow;
            SetStatus(service, request, Revision ? 5 : 2, upd);

            var review = new Entity("cea_initialreview");
            review["cea_name"] = "Review " + request.GetAttributeValue<string>("cea_requestnumber");
            review["cea_state"] = new OptionSetValue(1);
            review["cea_reviewtype"] = new OptionSetValue(Revision ? 2 : 1);
            review["cea_requestid"] = new EntityReference("cea_request", request.Id);
            review["ownerid"] = owner;
            service.Create(review);
            Notifier.Enqueue(service, request.Id, Revision ? Notifier.Resubmitted : Notifier.Submitted, Notifier.Administrators, null, null, null);
            if (Revision)
            {
                var note = context.InputParameters.Contains("CorrectionNote") ? context.InputParameters["CorrectionNote"] as string : null;
                RevisionCycles.Update(service, request.Id, delegate(Entity u) { u["cea_resubmittedon"] = DateTime.UtcNow; if (!string.IsNullOrEmpty(note)) u["cea_correctionnote"] = note; });
                return "Resubmitted";
            }
            return "Submitted";
        }
    }

    public class ResubmitRequest : SubmitRequest
    {
        protected override bool Revision { get { return true; } }
    }

    public class ReturnToCreator : RequestAction
    {
        protected override string Run(IPluginExecutionContext context, IOrganizationService service, Entity request, HashSet<string> roles)
        {
            RequireAdmin(roles);
            var comments = context.InputParameters.Contains("Comments") ? context.InputParameters["Comments"] as string : null;
            if (comments == null || comments.Trim().Length == 0) throw new InvalidPluginExecutionException("Comments are required when returning a request to the Creator.");
            var review = OpenReview(service, request.Id);
            CloseReview(service, review, 3, comments, context.InitiatingUserId);
            var rtype = review.GetAttributeValue<OptionSetValue>("cea_reviewtype");
            if (rtype != null && rtype.Value == 2) { var uid = context.InitiatingUserId; RevisionCycles.Update(service, request.Id, delegate(Entity u) { u["cea_reviewoutcome"] = new OptionSetValue(2); u["cea_reviewedbyid"] = new EntityReference("systemuser", uid); }); }
            SetStatus(service, request, 9, null);
            HistoryWriter.Write(service, request.Id, HistoryWriter.ReviewReturned, context.InitiatingUserId, comments, null, null, null);
            Notifier.Enqueue(service, request.Id, Notifier.Returned, Notifier.Creator, request.GetAttributeValue<EntityReference>("ownerid").Id, comments, null);
            return "Returned";
        }
    }

    // Spec 006 FR-007: a blocked release rolls back its own transaction, so the alert is written by this follow-up call (made by the form after the block).
    public class NotifyReleaseBlocked : RequestAction
    {
        protected override string Run(IPluginExecutionContext context, IOrganizationService service, Entity request, HashSet<string> roles)
        {
            RequireAdmin(roles);
            if (Status(request) != 2) throw new InvalidPluginExecutionException("The request is not in review.");
            string msg = context.InputParameters.Contains("Comments") ? context.InputParameters["Comments"] as string : null;
            if (string.IsNullOrEmpty(msg)) msg = "Release blocked: no active approver found for an approval level.";
            if (msg.Length > 500) msg = msg.Substring(0, 500);
            Notifier.Enqueue(service, request.Id, Notifier.AlertBlocked, Notifier.Administrators, null, msg, null);
            return "Notified";
        }
    }

    public class ReleaseToApproval : RequestAction
    {
        protected override string Run(IPluginExecutionContext context, IOrganizationService service, Entity request, HashSet<string> roles)
        {
            RequireAdmin(roles);
            var review = OpenReview(service, request.Id);
            var first = ChainAdvance.Resolve(service, request);
            CloseReview(service, review, 2, null, context.InitiatingUserId);
            var rtype = review.GetAttributeValue<OptionSetValue>("cea_reviewtype");
            if (rtype != null && rtype.Value == 2) { var uid = context.InitiatingUserId; RevisionCycles.Update(service, request.Id, delegate(Entity u) { u["cea_reviewoutcome"] = new OptionSetValue(1); u["cea_reviewedbyid"] = new EntityReference("systemuser", uid); }); }
            var upd = new Entity("cea_request");
            if (!request.Contains("cea_cycle") || request["cea_cycle"] == null) upd["cea_cycle"] = 1;
            ChainAdvance.Advance(service, request, ChainAdvance.Steps(service, request.Id));
            if (upd.Attributes.Count > 0) { upd.Id = request.Id; service.Update(upd); }
            var firstStep = ChainAdvance.FirstWithStatus(ChainAdvance.Steps(service, request.Id), ChainAdvance.Pending);
            if (firstStep != null && firstStep.GetAttributeValue<EntityReference>("cea_approverid") != null)
                Notifier.Enqueue(service, request.Id, Notifier.Released, Notifier.Approver, firstStep.GetAttributeValue<EntityReference>("cea_approverid").Id, null, null);
            return "Released";
        }
    }
}

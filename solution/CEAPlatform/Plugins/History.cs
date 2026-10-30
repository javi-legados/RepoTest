using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using System.Collections.Generic;

namespace CEAPlatform.Plugins
{
    // Spec 011: shared writer for cea_historyentry / cea_administrativeauditentry. Never throws; runs in the caller's transaction.
    public static class HistoryWriter
    {
        public const int Created = 1, Submitted = 2, ReviewReleased = 3, ReviewReturned = 4, Approved = 5, Rejected = 6, Skipped = 7, Resubmitted = 8,
            Reassigned = 9, FieldChanged = 10, AttachmentAdded = 11, AttachmentRemoved = 12, DataCorrected = 13, NotificationOutcome = 14, Hold = 15, Resume = 16, Completed = 17;
        public const int RoleChanged = 1, ApproverAssignmentChanged = 2, EmailFailure = 3, ReleaseBlocked = 4, Other = 5;

        private static string Name(IOrganizationService service, Guid? actor)
        {
            if (!actor.HasValue) return "System";
            var u = service.Retrieve("systemuser", actor.Value, new ColumnSet("fullname"));
            return u.GetAttributeValue<string>("fullname") ?? "System";
        }

        private static string Cut(string s, int n) { return s != null && s.Length > n ? s.Substring(0, n) : s; }

        public static void Write(IOrganizationService service, Guid requestId, int type, Guid? actor, string comments, string field, string oldValue, string newValue)
        {
            try
            {
                var r = service.Retrieve("cea_request", requestId, new ColumnSet("ownerid", "cea_cycle"));
                var e = new Entity("cea_historyentry");
                e["cea_name"] = "H-" + type;
                e["cea_requestid"] = new EntityReference("cea_request", requestId);
                e["cea_eventtype"] = new OptionSetValue(type);
                if (actor.HasValue) e["cea_actorid"] = new EntityReference("systemuser", actor.Value);
                e["cea_actorname"] = Name(service, actor);
                e["cea_occurredon"] = DateTime.UtcNow;
                if (field != null) e["cea_field"] = Cut(field, 200);
                if (oldValue != null) e["cea_oldvalue"] = Cut(oldValue, 500);
                if (newValue != null) e["cea_newvalue"] = Cut(newValue, 500);
                if (comments != null) e["cea_comments"] = Cut(comments, 4000);
                var cycle = r.GetAttributeValue<int?>("cea_cycle");
                if (cycle.HasValue) e["cea_cycle"] = cycle.Value;
                var owner = r.GetAttributeValue<EntityReference>("ownerid");
                if (owner != null) e["ownerid"] = owner;
                service.Create(e);
            }
            catch (Exception) { }
        }

        public static void Admin(IOrganizationService service, int type, Guid? actor, string oldValue, string newValue, string reason)
        {
            try
            {
                var e = new Entity("cea_administrativeauditentry");
                e["cea_name"] = "A-" + type;
                e["cea_eventtype"] = new OptionSetValue(type);
                if (actor.HasValue) e["cea_actorid"] = new EntityReference("systemuser", actor.Value);
                e["cea_actorname"] = Name(service, actor);
                e["cea_occurredon"] = DateTime.UtcNow;
                if (oldValue != null) e["cea_oldvalue"] = Cut(oldValue, 1000);
                if (newValue != null) e["cea_newvalue"] = Cut(newValue, 1000);
                if (reason != null) e["cea_reason"] = Cut(reason, 2000);
                service.Create(e);
            }
            catch (Exception) { }
        }

        public static string Text(object v)
        {
            string s;
            if (v == null) s = "";
            else if (v is OptionSetValue) s = ((OptionSetValue)v).Value.ToString();
            else if (v is Money) s = ((Money)v).Value.ToString();
            else if (v is EntityReference) s = ((EntityReference)v).Id.ToString();
            else s = Convert.ToString(v);
            return s;
        }
    }

    // PreValidation Update/Delete of both history tables: rejected for everyone. A cascade (depth > 1) from deleting a Draft request is allowed.
    public class HistoryImmutabilityGuard : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context.MessageName == "Delete" && context.Depth > 1) return;
            throw new InvalidPluginExecutionException("History and audit entries are immutable and cannot be changed or deleted.");
        }
    }

    // PostOperation Create of cea_request: Created entry.
    public class HistoryCreated : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var target = (Entity)context.InputParameters["Target"];
            HistoryWriter.Write(service, target.Id, HistoryWriter.Created, context.InitiatingUserId, null, null, null, null);
        }
    }

    // PostOperation Update of cea_request (status/level, with PreImage): lifecycle entries. Rejected and Returned are written by their actions (they carry comments).
    public class HistoryStatusCapture : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var target = (Entity)context.InputParameters["Target"];
            if (!context.PreEntityImages.Contains("PreImage")) return;
            var pre = context.PreEntityImages["PreImage"];
            int oldS = Val(pre, "cea_status"), newS = target.Contains("cea_status") ? Val(target, "cea_status") : oldS;
            int oldL = Val(pre, "cea_currentlevel"), newL = target.Contains("cea_currentlevel") ? Val(target, "cea_currentlevel") : oldL;
            int type = 0; string comments = null;
            if (newS == oldS)
            {
                if (newS == 3 && newL != oldL) { type = HistoryWriter.Approved; comments = "Level " + oldL; }
            }
            else if (newS == 2) type = HistoryWriter.Submitted;
            else if (newS == 5) type = HistoryWriter.Resubmitted;
            else if (newS == 3) type = oldS == 8 ? HistoryWriter.Resume : HistoryWriter.ReviewReleased;
            else if (newS == 10) { type = HistoryWriter.Approved; comments = "Level " + oldL + " (final approval)"; }
            else if (newS == 9 && oldS == 8) type = HistoryWriter.Resume;
            else if (newS == 8) type = HistoryWriter.Hold;
            else if (newS == 7) type = HistoryWriter.Completed;
            if (type == 0) return;
            HistoryWriter.Write(service, target.Id, type, context.InitiatingUserId, comments, null, null, null);
        }

        private static int Val(Entity e, string a) { var o = e.GetAttributeValue<OptionSetValue>(a); return o == null ? 0 : o.Value; }
    }

    // PostOperation Update (depth 1) of request / cost / forecast lines with PreImage: Field Changed after submission, Data Corrected in Final Processing.
    public class HistoryFieldChangeCapture : IPlugin
    {
        private static readonly HashSet<string> Skip = new HashSet<string> { "modifiedon", "modifiedby", "modifiedonbehalfby", "versionnumber", "cea_status", "cea_currentlevel", "cea_pendingapproverid", "cea_cycle", "statecode", "statuscode" };

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context.Depth > 1 || !context.PreEntityImages.Contains("PreImage")) return;
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var target = (Entity)context.InputParameters["Target"];
            var pre = context.PreEntityImages["PreImage"];
            Guid requestId;
            if (target.LogicalName == "cea_request") requestId = target.Id;
            else { var r = pre.GetAttributeValue<EntityReference>("cea_requestid"); if (r == null) return; requestId = r.Id; }
            var st = service.Retrieve("cea_request", requestId, new ColumnSet("cea_status")).GetAttributeValue<OptionSetValue>("cea_status");
            if (st == null || st.Value == 1 || st.Value == 7) return;
            var type = st.Value == 10 ? HistoryWriter.DataCorrected : HistoryWriter.FieldChanged;
            foreach (var a in target.Attributes)
            {
                if (Skip.Contains(a.Key)) continue;
                var oldV = HistoryWriter.Text(pre.Contains(a.Key) ? pre[a.Key] : null);
                var newV = HistoryWriter.Text(a.Value);
                if (oldV == newV) continue;
                HistoryWriter.Write(service, requestId, type, context.InitiatingUserId, null, target.LogicalName + "." + a.Key, oldV, newV);
            }
        }
    }

    // PostOperation Create (Target) / Delete (PreImage) of cea_requestattachment: after submission only.
    public class HistoryAttachmentCapture : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            bool create = context.MessageName == "Create";
            Entity e;
            if (create) e = (Entity)context.InputParameters["Target"];
            else { if (context.Depth > 1 || !context.PreEntityImages.Contains("PreImage")) return; e = context.PreEntityImages["PreImage"]; }
            var r = e.GetAttributeValue<EntityReference>("cea_requestid");
            if (r == null) return;
            var req = service.Retrieve("cea_request", r.Id, new ColumnSet("cea_status"));
            var st = req.GetAttributeValue<OptionSetValue>("cea_status");
            if (st == null || st.Value == 1) return;
            HistoryWriter.Write(service, r.Id, create ? HistoryWriter.AttachmentAdded : HistoryWriter.AttachmentRemoved, context.InitiatingUserId, null, "cea_requestattachment", null, e.GetAttributeValue<string>("cea_filename"));
        }
    }

    // PostOperation Create/Update/Delete of cea_approverassignment: Administrative audit (Spec 3 reassignments).
    // PostOperation Associate/Disassociate of user <-> security role: Role Changed audit entry (FR-005).
    public class AdminAuditRoleChange : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var rel = context.InputParameters.Contains("Relationship") ? context.InputParameters["Relationship"] as Relationship : null;
            if (rel == null || rel.SchemaName != "systemuserroles_association") return;
            var target = context.InputParameters.Contains("Target") ? context.InputParameters["Target"] as EntityReference : null;
            var related = context.InputParameters.Contains("RelatedEntities") ? context.InputParameters["RelatedEntities"] as EntityReferenceCollection : null;
            if (target == null || related == null) return;
            bool added = context.MessageName == "Associate";
            string user;
            try { user = service.Retrieve("systemuser", target.Id, new ColumnSet("fullname")).GetAttributeValue<string>("fullname"); }
            catch (Exception) { return; }
            foreach (var r in related)
            {
                string role;
                try { role = service.Retrieve("role", r.Id, new ColumnSet("name")).GetAttributeValue<string>("name"); }
                catch (Exception) { continue; }
                HistoryWriter.Admin(service, HistoryWriter.RoleChanged, context.InitiatingUserId, added ? null : role, added ? role : null,
                    (added ? "Role added to " : "Role removed from ") + user);
            }
        }
    }

    public class AdminAuditAssignment : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            string oldV = null, newV = null;
            if (context.MessageName == "Delete") { if (context.PreEntityImages.Contains("PreImage")) oldV = Dump(context.PreEntityImages["PreImage"]); }
            else
            {
                var target = (Entity)context.InputParameters["Target"];
                newV = Dump(target);
                if (context.MessageName == "Update" && context.PreEntityImages.Contains("PreImage"))
                {
                    var pre = context.PreEntityImages["PreImage"];
                    var o = new Entity(target.LogicalName);
                    foreach (var a in target.Attributes) if (pre.Contains(a.Key)) o[a.Key] = pre[a.Key];
                    oldV = Dump(o);
                }
            }
            HistoryWriter.Admin(service, HistoryWriter.ApproverAssignmentChanged, context.InitiatingUserId, oldV, newV, context.MessageName);
        }

        private static string Dump(Entity e)
        {
            var parts = new List<string>();
            foreach (var a in e.Attributes)
            {
                if (a.Key == "modifiedon" || a.Key == "modifiedby" || a.Key == "createdon" || a.Key == "createdby") continue;
                parts.Add(a.Key + "=" + HistoryWriter.Text(a.Value));
            }
            return string.Join("; ", parts.ToArray());
        }
    }
}

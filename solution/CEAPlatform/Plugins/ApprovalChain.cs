using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 007: shared chain logic. Step rows are cea_resolvedapprover (one per request and level).
    public static class ChainAdvance
    {
        public static readonly string[] LevelNames = { "", "Direct Manager", "Plant Manager", "Regional Approver" };
        public const int Pending = 1, Approved = 2, Rejected = 3, Skipped = 4, Invalidated = 5, OnHold = 6;

        public static List<Entity> Steps(IOrganizationService service, Guid requestId)
        {
            var q = new QueryExpression("cea_resolvedapprover") { ColumnSet = new ColumnSet(true) };
            q.Criteria.AddCondition("cea_requestid", ConditionOperator.Equal, requestId);
            q.Orders.Add(new OrderExpression("cea_level", OrderType.Ascending));
            return new List<Entity>(service.RetrieveMultiple(q).Entities);
        }

        public static int StepStatus(Entity step)
        {
            var s = step.GetAttributeValue<OptionSetValue>("cea_stepstatus");
            return s == null ? 0 : s.Value;
        }

        public static int Level(Entity step)
        {
            return step.GetAttributeValue<OptionSetValue>("cea_level").Value;
        }

        public static Entity FirstWithStatus(List<Entity> steps, int status)
        {
            foreach (var s in steps) if (StepStatus(s) == status) return s;
            return null;
        }

        private class Plan { public int Level; public Guid Approver; public bool Skip; }

        // Resolves (or re-resolves after a return) the steps of the request and returns the first pending one.
        public static Entity Resolve(IOrganizationService service, Entity request)
        {
            var owner = request.GetAttributeValue<EntityReference>("ownerid");
            var creator = service.Retrieve("systemuser", owner.Id, new ColumnSet("cea_manageremail", "businessunitid"));
            var bu = service.Retrieve("businessunit", creator.GetAttributeValue<EntityReference>("businessunitid").Id, new ColumnSet("cea_level", "parentbusinessunitid"));
            var buLevel = bu.GetAttributeValue<OptionSetValue>("cea_level");
            int creatorLevel = buLevel == null ? 4 : buLevel.Value; // unclassified units are treated as plants

            var plans = new List<Plan>();

            var p1 = new Plan { Level = 1 };
            var email = creator.GetAttributeValue<string>("cea_manageremail");
            if (!string.IsNullOrEmpty(email))
            {
                var q = new QueryExpression("systemuser") { ColumnSet = new ColumnSet("systemuserid"), TopCount = 1 };
                q.Criteria.AddCondition("internalemailaddress", ConditionOperator.Equal, email);
                q.Criteria.AddCondition("isdisabled", ConditionOperator.Equal, false);
                var r = service.RetrieveMultiple(q);
                if (r.Entities.Count > 0 && CeaRoles.Of(service, r.Entities[0].Id).Contains("CEA Internal Approvals")) p1.Approver = r.Entities[0].Id;
            }
            p1.Skip = p1.Approver == Guid.Empty || p1.Approver == owner.Id;
            plans.Add(p1);

            var p2 = new Plan { Level = 2, Skip = true };
            if (creatorLevel == 4)
            {
                p2.Approver = Assigned(service, bu.Id, 1);
                if (p2.Approver == Guid.Empty) throw NoApprover(2);
                p2.Skip = p2.Approver == owner.Id;
            }
            plans.Add(p2);

            var p3 = new Plan { Level = 3, Skip = true };
            if (creatorLevel == 3 || creatorLevel == 4)
            {
                var region = bu;
                int guard = 0;
                while (region != null && (region.GetAttributeValue<OptionSetValue>("cea_level") == null || region.GetAttributeValue<OptionSetValue>("cea_level").Value != 3) && guard++ < 10)
                {
                    var parent = region.GetAttributeValue<EntityReference>("parentbusinessunitid");
                    region = parent == null ? null : service.Retrieve("businessunit", parent.Id, new ColumnSet("cea_level", "parentbusinessunitid"));
                }
                p3.Approver = region == null ? Guid.Empty : Assigned(service, region.Id, 2);
                if (p3.Approver == Guid.Empty) throw NoApprover(3);
                p3.Skip = p3.Approver == owner.Id;
            }
            plans.Add(p3);

            bool any = false;
            foreach (var p in plans) if (!p.Skip) any = true;
            if (!any) throw new InvalidPluginExecutionException("No approval level applies to this request; there is no one to approve it.");

            var existing = Steps(service, request.Id);
            var number = request.GetAttributeValue<string>("cea_requestnumber");
            foreach (var p in plans)
            {
                Entity step = null;
                foreach (var e in existing) if (Level(e) == p.Level) step = e;
                var u = new Entity("cea_resolvedapprover");
                if (step != null) u.Id = step.Id;
                u["cea_name"] = number + " - " + LevelNames[p.Level];
                u["cea_requestreference"] = number;
                u["cea_level"] = new OptionSetValue(p.Level);
                u["cea_requestid"] = new EntityReference("cea_request", request.Id);
                u["cea_approverid"] = p.Approver == Guid.Empty ? null : new EntityReference("systemuser", p.Approver);
                u["cea_stepstatus"] = new OptionSetValue(p.Skip ? Skipped : Pending);
                u["cea_skipped"] = p.Skip;
                u["cea_decided"] = false;
                u["cea_decidedon"] = null;
                if (!p.Skip) u["ownerid"] = new EntityReference("systemuser", p.Approver);
                if (step != null) service.Update(u); else service.Create(u);
            }
            return FirstWithStatus(Steps(service, request.Id), Pending);
        }

        private static InvalidPluginExecutionException NoApprover(int level)
        {
            return new InvalidPluginExecutionException("No active approver found for level " + LevelNames[level] + ". Assign one before releasing the request.");
        }

        private static Guid Assigned(IOrganizationService service, Guid buId, int roleType)
        {
            var q = new QueryExpression("cea_approverassignment") { ColumnSet = new ColumnSet("cea_approverid"), TopCount = 1 };
            q.Criteria.AddCondition("cea_businessunitid", ConditionOperator.Equal, buId);
            q.Criteria.AddCondition("cea_roletype", ConditionOperator.Equal, roleType);
            q.Criteria.AddCondition("cea_status", ConditionOperator.Equal, 1);
            var r = service.RetrieveMultiple(q);
            if (r.Entities.Count == 0) return Guid.Empty;
            var a = r.Entities[0].GetAttributeValue<EntityReference>("cea_approverid");
            var u = service.Retrieve("systemuser", a.Id, new ColumnSet("isdisabled"));
            return u.GetAttributeValue<bool>("isdisabled") ? Guid.Empty : a.Id;
        }

        // Points the request at the next pending step, or marks it Approved when none is left.
        public static void Advance(IOrganizationService service, Entity request, List<Entity> steps)
        {
            var next = FirstWithStatus(steps, Pending);
            var u = new Entity("cea_request", request.Id);
            u["cea_statuschangedon"] = DateTime.UtcNow;
            if (next != null)
            {
                u["cea_status"] = new OptionSetValue(3);
                u["cea_currentlevel"] = new OptionSetValue(Level(next));
                u["cea_pendingapproverid"] = next.GetAttributeValue<EntityReference>("cea_approverid");
            }
            else
            {
                u["cea_status"] = new OptionSetValue(10);
                u["cea_currentlevel"] = null;
                u["cea_pendingapproverid"] = null;
            }
            service.Update(u);
        }
    }

    public abstract class DecisionAction : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var reqRef = (EntityReference)context.InputParameters["Request"];
            var request = service.Retrieve("cea_request", reqRef.Id, new ColumnSet(true));
            var status = request.GetAttributeValue<OptionSetValue>("cea_status");
            if (status != null && status.Value == 8) throw new InvalidPluginExecutionException("The request is on hold because its approver is no longer available.");
            if (status == null || status.Value != 3) throw new InvalidPluginExecutionException("The request is not pending approval.");

            var comments = context.InputParameters.Contains("Comments") ? context.InputParameters["Comments"] as string : null;
            var steps = ChainAdvance.Steps(service, request.Id);
            var current = ChainAdvance.FirstWithStatus(steps, ChainAdvance.Pending);
            var approver = current == null ? null : current.GetAttributeValue<EntityReference>("cea_approverid");
            if (current == null || approver == null || approver.Id != context.InitiatingUserId)
                throw new InvalidPluginExecutionException("This request is not pending at your level; you are not the approver of the current level.");
            if (comments == null || comments.Trim().Length == 0) throw new InvalidPluginExecutionException("Comments are required to approve or reject a request.");
            Validate(comments);
            var callerRoles = CeaRoles.Of(service, context.InitiatingUserId);
            var creator = request.GetAttributeValue<EntityReference>("createdby");
            if (creator != null && creator.Id == context.InitiatingUserId)
                throw new InvalidPluginExecutionException("You cannot approve or reject a request you created.");
            if (callerRoles.Contains("CEA Administrators") && !callerRoles.Contains("CEA Internal Approvals"))
                throw new InvalidPluginExecutionException("Administrators cannot decide at approval-chain steps; they can only decide at Initial Review and Revision Review.");

            // Updating the request first takes its row lock, so a concurrent decision waits and then sees the level already decided.
            var lockRow = new Entity("cea_request", request.Id);
            lockRow["cea_statuschangedon"] = DateTime.UtcNow;
            service.Update(lockRow);
            steps = ChainAdvance.Steps(service, request.Id);
            current = steps.Find(delegate(Entity x) { return ChainAdvance.StepStatus(x) == ChainAdvance.Pending && x.GetAttributeValue<EntityReference>("cea_approverid") != null && x.GetAttributeValue<EntityReference>("cea_approverid").Id == context.InitiatingUserId; });
            var first = ChainAdvance.FirstWithStatus(steps, ChainAdvance.Pending);
            if (current == null || first == null || first.Id != current.Id) throw new InvalidPluginExecutionException("This level was already decided.");

            int cycle = request.Contains("cea_cycle") && request["cea_cycle"] != null ? (int)request["cea_cycle"] : 1;
            Record(service, request, current, context.InitiatingUserId, comments, cycle);
            context.OutputParameters["Result"] = Finish(service, request, steps, current, cycle);
            if (Decision == 2)
            {
                RevisionCycles.Open(service, request, context.InitiatingUserId, comments);
                HistoryWriter.Write(service, request.Id, HistoryWriter.Rejected, context.InitiatingUserId, comments, null, null, null);
                Notifier.Enqueue(service, request.Id, Notifier.Rejected, Notifier.Creator, request.GetAttributeValue<EntityReference>("ownerid").Id, comments, null);
            }
        }

        protected abstract void Validate(string comments);
        protected abstract int Decision { get; }
        protected abstract string Finish(IOrganizationService service, Entity request, List<Entity> steps, Entity current, int cycle);

        private void Record(IOrganizationService service, Entity request, Entity step, Guid userId, string comments, int cycle)
        {
            var d = new Entity("cea_approvaldecision");
            int level = ChainAdvance.Level(step);
            d["cea_name"] = (Decision == 1 ? "Approved" : "Rejected") + " - " + request.GetAttributeValue<string>("cea_requestnumber") + " - " + ChainAdvance.LevelNames[level];
            d["cea_requestid"] = new EntityReference("cea_request", request.Id);
            d["cea_level"] = new OptionSetValue(level);
            d["cea_approverid"] = new EntityReference("systemuser", userId);
            d["cea_decision"] = new OptionSetValue(Decision);
            if (!string.IsNullOrEmpty(comments)) d["cea_comments"] = comments;
            d["cea_decidedon"] = DateTime.UtcNow;
            d["cea_invalidated"] = false;
            d["cea_decisioncycle"] = cycle;
            d["ownerid"] = request.GetAttributeValue<EntityReference>("ownerid");
            service.Create(d);
        }

        protected static void SetStep(IOrganizationService service, Entity step, int status, bool decided)
        {
            var u = new Entity("cea_resolvedapprover", step.Id);
            u["cea_stepstatus"] = new OptionSetValue(status);
            u["cea_decided"] = decided;
            if (decided) u["cea_decidedon"] = DateTime.UtcNow;
            service.Update(u);
            step["cea_stepstatus"] = new OptionSetValue(status);
        }
    }

    public class ApproveStep : DecisionAction
    {
        protected override void Validate(string comments) { }
        protected override int Decision { get { return 1; } }
        protected override string Finish(IOrganizationService service, Entity request, List<Entity> steps, Entity current, int cycle)
        {
            SetStep(service, current, ChainAdvance.Approved, true);
            ChainAdvance.Advance(service, request, steps);
            var next = ChainAdvance.FirstWithStatus(steps, ChainAdvance.Pending);
            if (next == null)
            {
                var ev = Notifier.NewEventId();
                Notifier.Enqueue(service, request.Id, Notifier.AllApproved, Notifier.Administrators, null, null, ev);
                Notifier.Enqueue(service, request.Id, Notifier.AllApproved, Notifier.Creator, request.GetAttributeValue<EntityReference>("ownerid").Id, null, ev);
                return "Approved";
            }
            if (next.GetAttributeValue<EntityReference>("cea_approverid") != null)
                Notifier.Enqueue(service, request.Id, Notifier.ApprovedNext, Notifier.Approver, next.GetAttributeValue<EntityReference>("cea_approverid").Id, null, null);
            return "Advanced";
        }
    }

    public class RejectStep : DecisionAction
    {
        protected override void Validate(string comments)
        {
            if (comments == null || comments.Trim().Length == 0) throw new InvalidPluginExecutionException("Comments are required when rejecting a request.");
        }
        protected override int Decision { get { return 2; } }
        protected override string Finish(IOrganizationService service, Entity request, List<Entity> steps, Entity current, int cycle)
        {
            SetStep(service, current, ChainAdvance.Rejected, true);
            foreach (var s in steps)
                if (ChainAdvance.StepStatus(s) == ChainAdvance.Approved) SetStep(service, s, ChainAdvance.Invalidated, true);

            var q = new QueryExpression("cea_approvaldecision") { ColumnSet = new ColumnSet("cea_invalidated") };
            q.Criteria.AddCondition("cea_requestid", ConditionOperator.Equal, request.Id);
            q.Criteria.AddCondition("cea_decision", ConditionOperator.Equal, 1);
            q.Criteria.AddCondition("cea_decisioncycle", ConditionOperator.Equal, cycle);
            q.Criteria.AddCondition("cea_invalidated", ConditionOperator.Equal, false);
            foreach (var d in service.RetrieveMultiple(q).Entities)
            {
                var u = new Entity("cea_approvaldecision", d.Id);
                u["cea_invalidated"] = true;
                service.Update(u);
            }

            var r = new Entity("cea_request", request.Id);
            r["cea_status"] = new OptionSetValue(9);
            r["cea_statuschangedon"] = DateTime.UtcNow;
            r["cea_currentlevel"] = null;
            r["cea_pendingapproverid"] = null;
            r["cea_cycle"] = cycle + 1;
            service.Update(r);
            return "Rejected";
        }
    }

    // FR-012: hold the request when the current approver is deactivated; resume when Spec 3 reassigns the level.
    public class ApproverHold : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);

            if (context.PrimaryEntityName == "systemuser")
            {
                var moniker = context.InputParameters.Contains("EntityMoniker") ? context.InputParameters["EntityMoniker"] as EntityReference : null;
                var state = context.InputParameters.Contains("State") ? context.InputParameters["State"] as OptionSetValue : null;
                if (moniker == null || state == null || state.Value != 1) return;
                var q = new QueryExpression("cea_resolvedapprover") { ColumnSet = new ColumnSet("cea_requestid") };
                q.Criteria.AddCondition("cea_approverid", ConditionOperator.Equal, moniker.Id);
                q.Criteria.AddCondition("cea_stepstatus", ConditionOperator.Equal, ChainAdvance.Pending);
                foreach (var step in service.RetrieveMultiple(q).Entities)
                {
                    var rr = step.GetAttributeValue<EntityReference>("cea_requestid");
                    if (rr == null) continue;
                    var req = service.Retrieve("cea_request", rr.Id, new ColumnSet("cea_status"));
                    if (req.GetAttributeValue<OptionSetValue>("cea_status").Value != 3) continue;
                    var cur = ChainAdvance.FirstWithStatus(ChainAdvance.Steps(service, rr.Id), ChainAdvance.Pending);
                    if (cur == null || cur.Id != step.Id) continue;
                    var us = new Entity("cea_resolvedapprover", step.Id);
                    us["cea_stepstatus"] = new OptionSetValue(ChainAdvance.OnHold);
                    service.Update(us);
                    var ur = new Entity("cea_request", rr.Id);
                    ur["cea_status"] = new OptionSetValue(8);
                    ur["cea_statuschangedon"] = DateTime.UtcNow;
                    service.Update(ur);
                }
                return;
            }

            if (context.PrimaryEntityName != "cea_resolvedapprover" || context.Depth > 2) return;
            var step2 = service.Retrieve("cea_resolvedapprover", context.PrimaryEntityId, new ColumnSet(true));
            var rq = step2.GetAttributeValue<EntityReference>("cea_requestid");
            var ap = step2.GetAttributeValue<EntityReference>("cea_approverid");
            if (rq == null || ap == null) return;
            int ss = ChainAdvance.StepStatus(step2);
            if (ss != ChainAdvance.Pending && ss != ChainAdvance.OnHold) return;
            var user = service.Retrieve("systemuser", ap.Id, new ColumnSet("isdisabled"));
            if (user.GetAttributeValue<bool>("isdisabled")) return;
            if (ss == ChainAdvance.OnHold)
            {
                var us = new Entity("cea_resolvedapprover", step2.Id);
                us["cea_stepstatus"] = new OptionSetValue(ChainAdvance.Pending);
                service.Update(us);
            }
            var request = service.Retrieve("cea_request", rq.Id, new ColumnSet("cea_status"));
            int rs = request.GetAttributeValue<OptionSetValue>("cea_status").Value;
            if (rs != 3 && rs != 8) return;
            var cur2 = ChainAdvance.FirstWithStatus(ChainAdvance.Steps(service, rq.Id), ChainAdvance.Pending);
            if (cur2 == null || cur2.Id != step2.Id) return;
            var upd = new Entity("cea_request", rq.Id);
            upd["cea_status"] = new OptionSetValue(3);
            upd["cea_pendingapproverid"] = ap;
            upd["cea_currentlevel"] = new OptionSetValue(ChainAdvance.Level(step2));
            upd["cea_statuschangedon"] = DateTime.UtcNow;
            service.Update(upd);
        }
    }

    // Spec 008: append-only history of rejection/revision cycles.
    public static class RevisionCycles
    {
        public static void Open(IOrganizationService service, Entity request, Guid rejectedBy, string comments)
        {
            var q = new QueryExpression("cea_revisioncycle") { ColumnSet = new ColumnSet("cea_cycle") };
            q.Criteria.AddCondition("cea_requestid", ConditionOperator.Equal, request.Id);
            int n = service.RetrieveMultiple(q).Entities.Count;
            var c = new Entity("cea_revisioncycle");
            c["cea_name"] = request.GetAttributeValue<string>("cea_requestnumber") + " - cycle " + (n + 1);
            c["cea_requestid"] = new EntityReference("cea_request", request.Id);
            c["cea_cycle"] = n + 1;
            c["cea_rejectedbyid"] = new EntityReference("systemuser", rejectedBy);
            c["cea_rejectioncomments"] = comments;
            c["cea_rejectedon"] = DateTime.UtcNow;
            c["ownerid"] = request.GetAttributeValue<EntityReference>("ownerid");
            service.Create(c);
        }

        // Latest cycle row of the request that has no review outcome yet.
        public static Entity Latest(IOrganizationService service, Guid requestId)
        {
            var q = new QueryExpression("cea_revisioncycle") { ColumnSet = new ColumnSet(true), TopCount = 1 };
            q.Criteria.AddCondition("cea_requestid", ConditionOperator.Equal, requestId);
            q.Orders.Add(new OrderExpression("cea_cycle", OrderType.Descending));
            var r = service.RetrieveMultiple(q);
            return r.Entities.Count == 0 ? null : r.Entities[0];
        }

        public static void Update(IOrganizationService service, Guid requestId, Action<Entity> fill)
        {
            var row = Latest(service, requestId);
            if (row == null) return;
            var u = new Entity("cea_revisioncycle", row.Id);
            fill(u);
            service.Update(u);
        }
    }

    // Spec 008 FR-011: hold returned requests when the Creator is deactivated; resume when an administrator reassigns the request.
    public class CreatorHold : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            if (context.PrimaryEntityName == "systemuser")
            {
                var moniker = context.InputParameters.Contains("EntityMoniker") ? context.InputParameters["EntityMoniker"] as EntityReference : null;
                var state = context.InputParameters.Contains("State") ? context.InputParameters["State"] as OptionSetValue : null;
                if (moniker == null || state == null || state.Value != 1) return;
                var q = new QueryExpression("cea_request") { ColumnSet = new ColumnSet("cea_status") };
                q.Criteria.AddCondition("ownerid", ConditionOperator.Equal, moniker.Id);
                q.Criteria.AddCondition("cea_status", ConditionOperator.Equal, 9);
                foreach (var r in service.RetrieveMultiple(q).Entities)
                {
                    var u = new Entity("cea_request", r.Id);
                    u["cea_status"] = new OptionSetValue(8);
                    u["cea_statuschangedon"] = DateTime.UtcNow;
                    service.Update(u);
                    Notifier.Enqueue(service, r.Id, Notifier.AlertOnHold, Notifier.Administrators, null, "Creator deactivated", null);
                }
                return;
            }
            var target = context.InputParameters.Contains("Target") ? context.InputParameters["Target"] as EntityReference : null;
            if (target == null) return;
            var req = service.Retrieve("cea_request", target.Id, new ColumnSet("cea_status", "cea_pendingapproverid", "ownerid"));
            var st = req.GetAttributeValue<OptionSetValue>("cea_status");
            if (st == null || st.Value != 8 || req.GetAttributeValue<EntityReference>("cea_pendingapproverid") != null) return;
            var owner = service.Retrieve("systemuser", req.GetAttributeValue<EntityReference>("ownerid").Id, new ColumnSet("isdisabled"));
            if (owner.GetAttributeValue<bool>("isdisabled")) return;
            var back = new Entity("cea_request", req.Id);
            back["cea_status"] = new OptionSetValue(9);
            back["cea_statuschangedon"] = DateTime.UtcNow;
            service.Update(back);
        }
    }
}
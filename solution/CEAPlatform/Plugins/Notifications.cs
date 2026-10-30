using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 009: notification queue. Producers call Notifier.Enqueue (never throws); NotificationDispatch sends asynchronously.
    public static class Notifier
    {
        public const int Submitted = 1, Resubmitted = 2, Released = 3, ApprovedNext = 4, AllApproved = 5, Rejected = 6, Returned = 7, FinalCompleted = 8,
            ApproverReminder = 9, CreatorReminder = 10, AlertBlocked = 11, AlertOnHold = 12, AlertDeliveryFailure = 13, AlertInvalidRecipient = 14;
        public const int Administrators = 1, Creator = 2, Approver = 3;
        public const int Queued = 1, Sent = 2, Failed = 3, Skipped = 4;

        public static bool IsAlert(int ev) { return ev >= AlertBlocked; }

        public static void Enqueue(IOrganizationService service, Guid requestId, int eventType, int group, Guid? recipient, string comments, string eventId)
        {
            try
            {
                var n = new Entity("cea_notificationrequest");
                n["cea_name"] = "Notification " + eventType + " " + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff");
                n["cea_eventtype"] = new OptionSetValue(eventType);
                n["cea_requestid"] = new EntityReference("cea_request", requestId);
                n["cea_recipientgroup"] = new OptionSetValue(group);
                if (recipient.HasValue) n["cea_recipientid"] = new EntityReference("systemuser", recipient.Value);
                if (!string.IsNullOrEmpty(comments)) n["cea_comments"] = comments;
                n["cea_eventid"] = eventId ?? Guid.NewGuid().ToString("N");
                n["cea_status"] = new OptionSetValue(Queued);
                service.Create(n);
            }
            catch (Exception) { /* FR-009: a notification problem never blocks the workflow */ }
        }

        public static string NewEventId() { return Guid.NewGuid().ToString("N"); }

        public static List<Guid> ActiveAdministrators(IOrganizationService service)
        {
            var fetch = "<fetch><entity name='systemuser'><attribute name='systemuserid'/><filter><condition attribute='isdisabled' operator='eq' value='0'/></filter>"
                + "<link-entity name='systemuserroles' from='systemuserid' to='systemuserid'><link-entity name='role' from='roleid' to='roleid'><filter><condition attribute='name' operator='eq' value='CEA Administrators'/></filter></link-entity></link-entity></entity></fetch>";
            var list = new List<Guid>();
            foreach (var e in service.RetrieveMultiple(new FetchExpression(fetch)).Entities)
                if (!list.Contains(e.Id)) list.Add(e.Id);
            return list;
        }

        public static string Setting(IOrganizationService service, string name, string def)
        {
            var q = new QueryExpression("cea_platformsetting") { ColumnSet = new ColumnSet("cea_value"), TopCount = 1 };
            q.Criteria.AddCondition("cea_name", ConditionOperator.Equal, name);
            var r = service.RetrieveMultiple(q);
            return r.Entities.Count == 0 ? def : (r.Entities[0].GetAttributeValue<string>("cea_value") ?? def);
        }

        // Spec 009 reminders: pending approvers after ReminderDays, returned Creators after CreatorReminderDays. One reminder per request and day.
        public static int EnqueueReminders(IOrganizationService service)
        {
            int count = 0;
            int approverDays = ParseDays(Setting(service, "ReminderDays", "3"), 3);
            int creatorDays = ParseDays(Setting(service, "CreatorReminderDays", "5"), 5);
            foreach (var spec in new[] { new object[] { 3, approverDays, ApproverReminder, Approver }, new object[] { 9, creatorDays, CreatorReminder, Creator } })
            {
                var q = new QueryExpression("cea_request") { ColumnSet = new ColumnSet("cea_statuschangedon", "cea_pendingapproverid", "ownerid") };
                q.Criteria.AddCondition("cea_status", ConditionOperator.Equal, (int)spec[0]);
                q.Criteria.AddCondition("cea_statuschangedon", ConditionOperator.LessEqual, DateTime.UtcNow.AddDays(-(int)spec[1]));
                foreach (var r in service.RetrieveMultiple(q).Entities)
                {
                    int ev = (int)spec[2];
                    Guid? to = null;
                    if (ev == ApproverReminder) { var p = r.GetAttributeValue<EntityReference>("cea_pendingapproverid"); if (p == null) continue; to = p.Id; }
                    var day = DateTime.UtcNow.ToString("yyyyMMdd");
                    var dup = new QueryExpression("cea_notificationrequest") { ColumnSet = new ColumnSet("cea_name"), TopCount = 1 };
                    dup.Criteria.AddCondition("cea_requestid", ConditionOperator.Equal, r.Id);
                    dup.Criteria.AddCondition("cea_eventtype", ConditionOperator.Equal, ev);
                    dup.Criteria.AddCondition("cea_eventid", ConditionOperator.Equal, "rem-" + r.Id.ToString("N") + "-" + day);
                    if (service.RetrieveMultiple(dup).Entities.Count > 0) continue;
                    Enqueue(service, r.Id, ev, (int)spec[3], ev == CreatorReminder ? r.GetAttributeValue<EntityReference>("ownerid").Id : to, null, "rem-" + r.Id.ToString("N") + "-" + day);
                    count++;
                }
            }
            return count;
        }

        private static int ParseDays(string v, int def) { int d; return int.TryParse(v, out d) && d > 0 ? d : def; }
    }

    public class NotificationDispatch : IPlugin
    {
        private static readonly Regex EmailFormat = new Regex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            Dispatch(service, context.PrimaryEntityId);
        }

        public static void Dispatch(IOrganizationService service, Guid notificationId)
        {
            var n = service.Retrieve("cea_notificationrequest", notificationId, new ColumnSet(true));
            if (n.GetAttributeValue<OptionSetValue>("cea_status").Value != Notifier.Queued) return;
            int ev = n.GetAttributeValue<OptionSetValue>("cea_eventtype").Value;
            int group = n.GetAttributeValue<OptionSetValue>("cea_recipientgroup").Value;
            var comments = n.GetAttributeValue<string>("cea_comments");
            var eventId = n.GetAttributeValue<string>("cea_eventid");
            bool alert = Notifier.IsAlert(ev);
            var request = service.Retrieve("cea_request", n.GetAttributeValue<EntityReference>("cea_requestid").Id, new ColumnSet("cea_requestnumber", "cea_projectname", "ownerid"));

            var recipients = new List<Guid>();
            if (group == Notifier.Administrators) recipients = Notifier.ActiveAdministrators(service);
            else if (n.GetAttributeValue<EntityReference>("cea_recipientid") != null) recipients.Add(n.GetAttributeValue<EntityReference>("cea_recipientid").Id);

            int sent = 0, failed = 0, skipped = 0;
            if ((ev == Notifier.Rejected || ev == Notifier.Returned) && string.IsNullOrWhiteSpace(comments))
            {
                Outcome(service, n, null, 0, 2, "Rejection/return comments are required in the email.");
                Finish(service, n, Notifier.Failed);
                if (!alert) Notifier.Enqueue(service, request.Id, Notifier.AlertDeliveryFailure, Notifier.Administrators, null, "Notification without comments for " + request.GetAttributeValue<string>("cea_requestnumber"), null);
                return;
            }
            if (recipients.Count == 0)
            {
                Outcome(service, n, null, 0, 3, "No active recipient.");
                Finish(service, n, Notifier.Skipped);
                return;
            }

            var tmpl = Template(service, ev);
            var baseUrl = Notifier.Setting(service, "BaseUrl", "");
            foreach (var uid in recipients)
            {
                var user = service.Retrieve("systemuser", uid, new ColumnSet("isdisabled", "internalemailaddress", "fullname"));
                var email = user.GetAttributeValue<string>("internalemailaddress");
                if (user.GetAttributeValue<bool>("isdisabled") || string.IsNullOrWhiteSpace(email) || !EmailFormat.IsMatch(email))
                {
                    skipped++;
                    Outcome(service, n, uid, 0, 3, "Recipient inactive or without a valid email address.");
                    if (!alert) Notifier.Enqueue(service, request.Id, Notifier.AlertInvalidRecipient, Notifier.Administrators, null, (user.GetAttributeValue<string>("fullname") ?? uid.ToString()) + " for " + request.GetAttributeValue<string>("cea_requestnumber"), null);
                    continue;
                }
                if (AlreadyNotified(service, n, uid, eventId))
                {
                    skipped++;
                    Outcome(service, n, uid, 0, 3, "Consolidated into an earlier email of the same event.");
                    continue;
                }
                var subject = Fill(tmpl.Subject, request, comments, ev, baseUrl, CanSee(service, uid, request.Id));
                var body = Fill(tmpl.Body, request, comments, ev, baseUrl, CanSee(service, uid, request.Id));
                int attempts = 0; string error = null; bool ok = false;
                while (attempts < 3 && !ok)
                {
                    attempts++;
                    try { SendMail(service, uid, subject, body, request.Id); ok = true; }
                    catch (Exception ex) { error = ex.Message; }
                }
                if (ok) { sent++; Outcome(service, n, uid, attempts, 1, null); }
                else
                {
                    failed++;
                    Outcome(service, n, uid, attempts, 2, error);
                    if (!alert) Notifier.Enqueue(service, request.Id, Notifier.AlertDeliveryFailure, Notifier.Administrators, null, "Could not email " + (user.GetAttributeValue<string>("fullname") ?? uid.ToString()) + " (" + request.GetAttributeValue<string>("cea_requestnumber") + "): " + error, null);
                }
            }
            Finish(service, n, sent > 0 ? Notifier.Sent : (failed > 0 ? Notifier.Failed : Notifier.Skipped));
        }

        private class Tmpl { public string Subject; public string Body; }

        private static Tmpl Template(IOrganizationService service, int ev)
        {
            var q = new QueryExpression("cea_emailtemplate") { ColumnSet = new ColumnSet("cea_subject", "cea_body"), TopCount = 1 };
            q.Criteria.AddCondition("cea_eventtype", ConditionOperator.Equal, ev);
            var r = service.RetrieveMultiple(q);
            if (r.Entities.Count == 0) return new Tmpl { Subject = "CEA request {RequestId}", Body = "CEA request {RequestId} needs your attention. {Link}" };
            return new Tmpl { Subject = r.Entities[0].GetAttributeValue<string>("cea_subject"), Body = r.Entities[0].GetAttributeValue<string>("cea_body") };
        }

        private static string Fill(string text, Entity request, string comments, int ev, string baseUrl, bool link)
        {
            var id = request.GetAttributeValue<string>("cea_requestnumber");
            var url = link && baseUrl.Length > 0 ? baseUrl.TrimEnd('/') + "/main.aspx?etn=cea_request&pagetype=entityrecord&id=" + request.Id : "";
            return (text ?? "").Replace("{RequestId}", id ?? "").Replace("{Project}", request.GetAttributeValue<string>("cea_projectname") ?? "")
                .Replace("{Comments}", comments ?? "").Replace("{Link}", url);
        }

        // R10: a recipient who cannot open the request only gets the identifier.
        private static bool CanSee(IOrganizationService service, Guid userId, Guid requestId)
        {
            try
            {
                var r = (RetrievePrincipalAccessResponse)service.Execute(new RetrievePrincipalAccessRequest { Principal = new EntityReference("systemuser", userId), Target = new EntityReference("cea_request", requestId) });
                return (r.AccessRights & Microsoft.Crm.Sdk.Messages.AccessRights.ReadAccess) != 0;
            }
            catch (Exception) { return false; }
        }

        private static bool AlreadyNotified(IOrganizationService service, Entity n, Guid userId, string eventId)
        {
            var q = new QueryExpression("cea_notificationoutcome") { ColumnSet = new ColumnSet("cea_result"), TopCount = 1 };
            q.Criteria.AddCondition("cea_recipientid", ConditionOperator.Equal, userId);
            q.Criteria.AddCondition("cea_result", ConditionOperator.Equal, 1);
            var link = q.AddLink("cea_notificationrequest", "cea_notificationrequestid", "cea_notificationrequestid");
            link.LinkCriteria.AddCondition("cea_eventid", ConditionOperator.Equal, eventId);
            link.LinkCriteria.AddCondition("cea_notificationrequestid", ConditionOperator.NotEqual, n.Id);
            return service.RetrieveMultiple(q).Entities.Count > 0;
        }

        private static void SendMail(IOrganizationService service, Guid toUser, string subject, string body, Guid requestId)
        {
            var senderEmail = Notifier.Setting(service, "SenderMailbox", "");
            Guid fromId = toUser;
            if (senderEmail.Length > 0)
            {
                var q = new QueryExpression("systemuser") { ColumnSet = new ColumnSet("systemuserid"), TopCount = 1 };
                q.Criteria.AddCondition("internalemailaddress", ConditionOperator.Equal, senderEmail);
                var r = service.RetrieveMultiple(q);
                if (r.Entities.Count > 0) fromId = r.Entities[0].Id;
            }
            var mail = new Entity("email");
            mail["subject"] = subject;
            mail["description"] = body.Replace("\n", "<br/>");
            mail["from"] = Party(fromId);
            mail["to"] = Party(toUser);
            var id = service.Create(mail);
            service.Execute(new SendEmailRequest { EmailId = id, IssueSend = true, TrackingToken = "" });
        }

        private static EntityCollection Party(Guid userId)
        {
            var p = new Entity("activityparty");
            p["partyid"] = new EntityReference("systemuser", userId);
            return new EntityCollection(new List<Entity> { p });
        }

        private static void Outcome(IOrganizationService service, Entity n, Guid? user, int attempts, int result, string reason)
        {
            var o = new Entity("cea_notificationoutcome");
            o["cea_name"] = n.GetAttributeValue<string>("cea_name");
            o["cea_notificationrequestid"] = new EntityReference("cea_notificationrequest", n.Id);
            if (user.HasValue) o["cea_recipientid"] = new EntityReference("systemuser", user.Value);
            o["cea_attempts"] = attempts;
            o["cea_result"] = new OptionSetValue(result);
            if (result == 1) o["cea_senton"] = DateTime.UtcNow;
            if (reason != null) o["cea_reason"] = reason.Length > 2000 ? reason.Substring(0, 2000) : reason;
            service.Create(o);
            HistoryWriter.Write(service, n.GetAttributeValue<EntityReference>("cea_requestid").Id, HistoryWriter.NotificationOutcome, null, reason, "Event " + n.GetAttributeValue<OptionSetValue>("cea_eventtype").Value, null, result == 1 ? "Sent" : (result == 2 ? "Failed" : "Skipped"));
            if (result == 2) HistoryWriter.Admin(service, HistoryWriter.EmailFailure, null, null, n.GetAttributeValue<string>("cea_name"), reason);
        }

        private static void Finish(IOrganizationService service, Entity n, int status)
        {
            var u = new Entity("cea_notificationrequest", n.Id);
            u["cea_status"] = new OptionSetValue(status);
            service.Update(u);
        }
    }

    // Custom API cea_ProcessNotifications: enqueues due reminders and re-dispatches rows left Queued (transient outage). Meant for a scheduled caller.
    public class ProcessNotifications : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            if (!CeaRoles.IsAdmin(CeaRoles.Of(service, context.InitiatingUserId))) throw new InvalidPluginExecutionException("Only CEA Administrators can process notifications.");
            int reminders = Notifier.EnqueueReminders(service);
            var q = new QueryExpression("cea_notificationrequest") { ColumnSet = new ColumnSet("cea_status"), TopCount = 200 };
            q.Criteria.AddCondition("cea_status", ConditionOperator.Equal, Notifier.Queued);
            q.Criteria.AddCondition("createdon", ConditionOperator.LessEqual, DateTime.UtcNow.AddMinutes(-5));
            int retried = 0;
            foreach (var e in service.RetrieveMultiple(q).Entities) { NotificationDispatch.Dispatch(service, e.Id); retried++; }
            context.OutputParameters["Result"] = "Reminders queued: " + reminders + "; retried: " + retried;
        }
    }
}

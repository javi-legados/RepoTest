using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 004: server-side rules of the CEA Request (PreOperation, Create/Update of cea_request).
    // Requester data (FR-001), date order (FR-003), clearing of hidden fields (FR-020, R9).
    public class RequestRules : IPlugin
    {
        private static readonly int[] MetricCategories = { 2, 3, 5, 7 };

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var target = context.InputParameters["Target"] as Entity;
            if (target == null || context.Depth > 1) return;
            bool create = context.MessageName == "Create";

            Entity merged = target;
            if (create)
            {
                if (!target.Contains("cea_status")) target["cea_status"] = new OptionSetValue(1);
                var user = service.Retrieve("systemuser", context.InitiatingUserId, new ColumnSet("fullname", "cea_department", "businessunitid"));
                target["cea_projectmanager"] = user.GetAttributeValue<string>("fullname");
                target["cea_department"] = user.GetAttributeValue<string>("cea_department");
                var buRef = user.GetAttributeValue<EntityReference>("businessunitid");
                target["cea_location"] = buRef == null ? null : buRef.Name;
                target["cea_date"] = DateTime.UtcNow.Date;
            }
            else
            {
                foreach (var f in new[] { "cea_status", "cea_submittedbyid", "cea_submittedon", "cea_statuschangedon", "cea_currentlevel", "cea_pendingapproverid", "cea_cycle" })
                    if (target.Contains(f)) throw new InvalidPluginExecutionException("Status and submission data can only change through the request actions.");
                var roles = CeaRoles.Of(service, context.InitiatingUserId);
                if (!CeaRoles.IsAdmin(roles))
                {
                    var cur = service.Retrieve("cea_request", target.Id, new ColumnSet("cea_status")).GetAttributeValue<OptionSetValue>("cea_status");
                    if (cur != null && cur.Value != 1 && cur.Value != 4 && cur.Value != 9)
                        throw new InvalidPluginExecutionException("The request is locked while it is under review or approved.");
                }
                foreach (var f in new[] { "cea_projectmanager", "cea_location", "cea_department", "cea_date" }) target.Attributes.Remove(f);
                merged = service.Retrieve("cea_request", target.Id, new ColumnSet(
                    "cea_startdate", "cea_estimatedcompletiondate", "cea_supplemental", "cea_category", "cea_projectinplan"));
                foreach (var a in target.Attributes) merged[a.Key] = a.Value;
            }

            var start = merged.GetAttributeValue<DateTime?>("cea_startdate");
            var end = merged.GetAttributeValue<DateTime?>("cea_estimatedcompletiondate");
            if (start.HasValue && end.HasValue && end.Value < start.Value)
                throw new InvalidPluginExecutionException("The Estimated Completion Date cannot be earlier than the Start Date.");

            if (merged.Contains("cea_supplemental"))
            {
                if (merged.GetAttributeValue<bool>("cea_supplemental"))
                {
                    target["cea_projectname"] = null;
                    target["cea_projectlocationid"] = null;
                }
                else target["cea_existingceareferenceid"] = null;
            }

            var category = merged.GetAttributeValue<OptionSetValue>("cea_category");
            if (category != null && Array.IndexOf(MetricCategories, category.Value) < 0)
            {
                target["cea_payback"] = null;
                target["cea_irr"] = null;
                target["cea_npv"] = null;
            }
            if (merged.Contains("cea_projectinplan") && !merged.GetAttributeValue<bool>("cea_projectinplan"))
                target["cea_budgetedamount"] = null;
        }
    }

    // Spec 004 (FR-014, R8): pre-fills the "Others" cost group on a new request.
    public class RequestPrefill : IPlugin
    {
        private static readonly string[] Others = { "Freight", "Commissioning Services", "Electrical Installation", "Mechanical Installation", "Custom Fees", "Taxes" };

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var target = context.InputParameters["Target"] as Entity;
            if (target == null || context.MessageName != "Create") return;
            var owner = target.GetAttributeValue<EntityReference>("ownerid") ?? new EntityReference("systemuser", context.InitiatingUserId);
            foreach (var name in Others)
            {
                var line = new Entity("cea_costline");
                line["cea_description"] = name;
                line["cea_group"] = new OptionSetValue(5);
                line["cea_cost"] = 0m;
                line["cea_requestid"] = new EntityReference("cea_request", target.Id);
                line["ownerid"] = owner;
                service.Create(line);
            }
        }
    }

    // Spec 004 (R4, R5, R6): cost / forecast line rules and request totals.
    // PreOperation: owner follows the request, forecast name and unique Request + Year + Month.
    // PostOperation: recalculates subtotals, Grand Total, forecast amounts, calculated and left.
    public class LineRules : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);

            if (context.Stage == 20) PreOperation(context, service);
            else PostOperation(context, service);
        }

        private static void PreOperation(IPluginExecutionContext context, IOrganizationService service)
        {
            var target = context.InputParameters["Target"] as Entity;
            if (target == null) return;
            bool create = context.MessageName == "Create";
            Entity merged = target;
            if (!create)
            {
                merged = service.Retrieve(target.LogicalName, target.Id, new ColumnSet(true));
                foreach (var a in target.Attributes) merged[a.Key] = a.Value;
            }
            var request = merged.GetAttributeValue<EntityReference>("cea_requestid");

            if (create && request != null && !target.Contains("ownerid"))
            {
                var parent = service.Retrieve("cea_request", request.Id, new ColumnSet("ownerid"));
                target["ownerid"] = parent.GetAttributeValue<EntityReference>("ownerid");
            }

            if (target.LogicalName != "cea_forecastline" || request == null) return;
            var year = merged.GetAttributeValue<int?>("cea_year");
            var month = merged.GetAttributeValue<int?>("cea_month");
            if (!year.HasValue || !month.HasValue) return;
            target["cea_name"] = year.Value + "-" + month.Value.ToString("00");
            var dup = new QueryExpression("cea_forecastline") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            dup.Criteria.AddCondition("cea_requestid", ConditionOperator.Equal, request.Id);
            dup.Criteria.AddCondition("cea_year", ConditionOperator.Equal, year.Value);
            dup.Criteria.AddCondition("cea_month", ConditionOperator.Equal, month.Value);
            if (!create) dup.Criteria.AddCondition("cea_forecastlineid", ConditionOperator.NotEqual, target.Id);
            if (service.RetrieveMultiple(dup).Entities.Count > 0)
                throw new InvalidPluginExecutionException("A forecast line for this year and month already exists for the request.");
        }

        private static void PostOperation(IPluginExecutionContext context, IOrganizationService service)
        {
            Guid? requestId = null;
            var target = context.InputParameters["Target"] as Entity;
            if (target != null && target.Contains("cea_requestid")) requestId = target.GetAttributeValue<EntityReference>("cea_requestid").Id;
            if (!requestId.HasValue && context.PreEntityImages.Contains("PreImage"))
            {
                var r = context.PreEntityImages["PreImage"].GetAttributeValue<EntityReference>("cea_requestid");
                if (r != null) requestId = r.Id;
            }
            if (!requestId.HasValue && target != null)
            {
                var row = service.Retrieve(target.LogicalName, target.Id, new ColumnSet("cea_requestid"));
                var r = row.GetAttributeValue<EntityReference>("cea_requestid");
                if (r != null) requestId = r.Id;
            }
            if (requestId.HasValue) Recalculate(service, requestId.Value);
        }

        public static void Recalculate(IOrganizationService service, Guid requestId)
        {
            var subtotals = new decimal[6];
            var costs = new QueryExpression("cea_costline") { ColumnSet = new ColumnSet("cea_cost", "cea_group") };
            costs.Criteria.AddCondition("cea_requestid", ConditionOperator.Equal, requestId);
            decimal grand = 0m;
            foreach (var c in service.RetrieveMultiple(costs).Entities)
            {
                var amount = c.GetAttributeValue<decimal?>("cea_cost") ?? 0m;
                var g = c.GetAttributeValue<OptionSetValue>("cea_group");
                if (g != null && g.Value >= 1 && g.Value <= 5) subtotals[g.Value] += amount;
                grand += amount;
            }

            var forecasts = new QueryExpression("cea_forecastline") { ColumnSet = new ColumnSet("cea_percentage", "cea_amount") };
            forecasts.Criteria.AddCondition("cea_requestid", ConditionOperator.Equal, requestId);
            decimal pctSum = 0m, calculated = 0m;
            foreach (var f in service.RetrieveMultiple(forecasts).Entities)
            {
                var pct = f.GetAttributeValue<decimal?>("cea_percentage") ?? 0m;
                var amount = Math.Round(pct * grand / 100m, 2);
                pctSum += pct;
                calculated += amount;
                var current = f.GetAttributeValue<decimal?>("cea_amount");
                if (!current.HasValue || current.Value != amount)
                {
                    var upd = new Entity("cea_forecastline", f.Id);
                    upd["cea_amount"] = amount;
                    service.Update(upd);
                }
            }

            var request = new Entity("cea_request", requestId);
            for (int i = 1; i <= 5; i++) request["cea_subtotal" + i] = subtotals[i];
            request["cea_grandtotal"] = grand;
            request["cea_forecastcalculated"] = calculated;
            request["cea_forecastpercentage"] = pctSum;
            request["cea_forecastleft"] = grand - calculated;
            service.Update(request);
        }
    }
}

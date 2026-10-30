using System;
using System.Linq;
using System.Text.RegularExpressions;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 001 (FR-002, FR-003, FR-005, FR-007): server-side validation of CEA user data on systemuser.
    // Registered PreValidation on Create and Update (filtered attributes).
    public class UserValidation : IPlugin
    {
        private static readonly Regex EmailRegex = new Regex(
            @"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        private static readonly string[] Required = new[]
        {
            "cea_sapnumber", "lastname", "internalemailaddress", "cea_department",
            "cea_managername", "cea_manageremail", "businessunitid"
        };

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var target = context.InputParameters.Contains("Target") ? context.InputParameters["Target"] as Entity : null;
            if (target == null || target.LogicalName != "systemuser") return;

            var isCreate = context.MessageName == "Create";
            var merged = new Entity("systemuser");
            if (!isCreate && context.PreEntityImages.Contains("PreImage"))
            {
                foreach (var a in context.PreEntityImages["PreImage"].Attributes) merged[a.Key] = a.Value;
            }
            foreach (var a in target.Attributes) merged[a.Key] = a.Value;

            // Application users and non-interactive/support accounts are outside CEA registration.
            if (merged.Contains("applicationid") && merged["applicationid"] != null) return;
            var access = merged.GetAttributeValue<OptionSetValue>("accessmode");
            if (access != null && (access.Value == 3 || access.Value == 4 || access.Value == 5)) return;

            if (isCreate)
            {
                var missing = Required.Where(k => IsEmpty(merged, k)).ToArray();
                if (missing.Length > 0)
                    throw new InvalidPluginExecutionException(
                        "The user cannot be saved. Missing mandatory attributes: " + string.Join(", ", missing.Select(Friendly)) + ".");
            }
            else
            {
                var touched = Required.Where(k => target.Contains(k) && IsEmpty(merged, k)).ToArray();
                if (touched.Length > 0)
                    throw new InvalidPluginExecutionException(
                        "The user cannot be saved. Mandatory attributes cannot be cleared: " + string.Join(", ", touched.Select(Friendly)) + ".");
            }

            var email = merged.GetAttributeValue<string>("internalemailaddress");
            var managerEmail = merged.GetAttributeValue<string>("cea_manageremail");
            if (target.Contains("internalemailaddress") && !string.IsNullOrWhiteSpace(email) && !EmailRegex.IsMatch(email.Trim()))
                throw new InvalidPluginExecutionException("Email has an invalid format.");
            if (target.Contains("cea_manageremail") && !string.IsNullOrWhiteSpace(managerEmail) && !EmailRegex.IsMatch(managerEmail.Trim()))
                throw new InvalidPluginExecutionException("Manager Email has an invalid format.");

            if (!string.IsNullOrWhiteSpace(email) && !string.IsNullOrWhiteSpace(managerEmail)
                && string.Equals(email.Trim(), managerEmail.Trim(), StringComparison.OrdinalIgnoreCase))
                throw new InvalidPluginExecutionException("A user cannot be their own manager.");

            // FR-006a: flag whether the manager is a registered, active user (recomputed whenever Manager Email is saved).
            if (isCreate || target.Contains("cea_manageremail"))
            {
                var registered = false;
                if (!string.IsNullOrWhiteSpace(managerEmail))
                {
                    var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                    var service = factory.CreateOrganizationService(null);
                    var q = new QueryByAttribute("systemuser") { ColumnSet = new ColumnSet("systemuserid"), TopCount = 1 };
                    q.AddAttributeValue("internalemailaddress", managerEmail.Trim());
                    q.AddAttributeValue("isdisabled", false);
                    registered = service.RetrieveMultiple(q).Entities.Count > 0;
                }
                target["cea_managerregistered"] = registered;
            }
        }

        private static bool IsEmpty(Entity e, string key)
        {
            if (!e.Contains(key) || e[key] == null) return true;
            var s = e[key] as string;
            return s != null && string.IsNullOrWhiteSpace(s);
        }

        private static string Friendly(string key)
        {
            switch (key)
            {
                case "cea_sapnumber": return "SAP Number";
                case "lastname": return "Name";
                case "internalemailaddress": return "Email";
                case "cea_department": return "Department";
                case "cea_managername": return "Manager Name";
                case "cea_manageremail": return "Manager Email";
                case "businessunitid": return "Business Unit";
                default: return key;
            }
        }
    }
}

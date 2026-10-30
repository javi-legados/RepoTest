using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 001 (FR-012): writes one immutable cea_userchangerecord per changed tracked field or role association.
    // Registered PostOperation on Update of systemuser (PreImage) and on Associate/Disassociate.
    public class UserChangeRecorder : IPlugin
    {
        private static readonly string[] Tracked = new[]
        {
            "cea_managername", "cea_manageremail", "cea_department", "businessunitid"
        };

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            // System context: nobody holds Create on the history table.
            var service = factory.CreateOrganizationService(null);

            if (context.MessageName == "Update") OnUpdate(context, service);
            else OnRoleChange(context, service);
        }

        private static void OnUpdate(IPluginExecutionContext context, IOrganizationService service)
        {
            var target = context.InputParameters["Target"] as Entity;
            if (target == null || target.LogicalName != "systemuser") return;
            Entity pre = context.PreEntityImages.Contains("PreImage") ? context.PreEntityImages["PreImage"] : new Entity("systemuser");

            foreach (var field in Tracked)
            {
                if (!target.Contains(field)) continue;
                var oldText = Display(service, pre.Contains(field) ? pre[field] : null);
                var newText = Display(service, target[field]);
                if (oldText == newText) continue;
                Write(service, context, target.Id, field, oldText, newText);
            }
        }

        private static void OnRoleChange(IPluginExecutionContext context, IOrganizationService service)
        {
            var rel = context.InputParameters.Contains("Relationship") ? context.InputParameters["Relationship"] as Relationship : null;
            if (rel == null || rel.SchemaName != "systemuserroles_association") return;
            var target = context.InputParameters["Target"] as EntityReference;
            var related = context.InputParameters["RelatedEntities"] as EntityReferenceCollection;
            if (target == null || related == null) return;
            var added = context.MessageName == "Associate";

            foreach (var other in related)
            {
                var user = target.LogicalName == "systemuser" ? target : other;
                var role = target.LogicalName == "role" ? target : other;
                var roleName = Display(service, role);
                Write(service, context, user.Id, "role", added ? "(none)" : roleName, added ? roleName : "(removed)");
            }
        }

        private static void Write(IOrganizationService service, IPluginExecutionContext context, Guid userId, string field, string oldText, string newText)
        {
            var summary = field + ": " + oldText + " -> " + newText;
            var rec = new Entity("cea_userchangerecord");
            rec["cea_name"] = summary.Length > 200 ? summary.Substring(0, 200) : summary;
            rec["cea_field"] = field;
            rec["cea_oldvalue"] = oldText;
            rec["cea_newvalue"] = newText;
            rec["cea_changedon"] = DateTime.UtcNow;
            rec["cea_userid"] = new EntityReference("systemuser", userId);
            rec["cea_changedbyid"] = new EntityReference("systemuser", context.InitiatingUserId);
            service.Create(rec);
        }

        private static string Display(IOrganizationService service, object value)
        {
            if (value == null) return "(empty)";
            var er = value as EntityReference;
            if (er == null) return value.ToString();
            if (!string.IsNullOrEmpty(er.Name)) return er.Name;
            var nameAttr = er.LogicalName == "businessunit" || er.LogicalName == "role" ? "name" : null;
            if (nameAttr == null) return er.Id.ToString();
            var row = service.Retrieve(er.LogicalName, er.Id, new ColumnSet(nameAttr));
            return row.GetAttributeValue<string>(nameAttr) ?? er.Id.ToString();
        }
    }
}

using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace CEAPlatform.Plugins
{
    // Spec 005: attachment rules (PreValidation, Create/Delete of cea_requestattachment).
    // Type, size, duplicate name and 20-file limit; status/role guard; auto-filled uploader data.
    // File contents are never touched (FR-010).
    public class AttachmentRules : IPlugin
    {
        private static readonly string[] Allowed = { "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "jpeg", "png", "csv", "txt", "zip", "dwg", "dxf" };
        private const int MaxBytes = 25 * 1024 * 1024;
        private const int MaxFiles = 20;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);
            var roles = Roles(service, context.InitiatingUserId);
            bool admin = roles.Contains("CEA Administrators") || roles.Contains("System Administrator");

            if (context.MessageName == "Delete")
            {
                if (context.Depth > 1) return; // cascade from deleting the request
                var er =  (EntityReference)context.InputParameters["Target"];
                var existing = service.Retrieve("cea_requestattachment", er.Id, new ColumnSet("cea_requestid"));
                Guard(service, existing.GetAttributeValue<EntityReference>("cea_requestid"), roles, admin, true);
                return;
            }

            var target = (Entity)context.InputParameters["Target"];
            var request = target.GetAttributeValue<EntityReference>("cea_requestid");
            if (request == null) throw new InvalidPluginExecutionException("The attachment must belong to a request.");
            Guard(service, request, roles, admin, false);

            var name = (target.GetAttributeValue<string>("cea_filename") ?? "").Trim();
            if (name.Length == 0) throw new InvalidPluginExecutionException("File name is required.");
            var dot = name.LastIndexOf('.');
            var ext = dot >= 0 ? name.Substring(dot + 1).ToLowerInvariant() : "";
            if (Array.IndexOf(Allowed, ext) < 0)
                throw new InvalidPluginExecutionException("File type not allowed for '" + name + "'. Allowed: PDF, Word, Excel, PowerPoint, JPG, PNG, CSV, TXT, ZIP, DWG, DXF.");
            var size = target.GetAttributeValue<int?>("cea_size");
            if (size.HasValue && size.Value > MaxBytes)
                throw new InvalidPluginExecutionException("File '" + name + "' exceeds the 25 MB limit.");

            var package = target.GetAttributeValue<OptionSetValue>("cea_package");
            if (package == null) { package = new OptionSetValue(1); target["cea_package"] = package; }
            if (package.Value == 2 && !admin)
                throw new InvalidPluginExecutionException("Only CEA Administrators can add files to the Final package.");
            if (package.Value == 2)
            {
                var st = service.Retrieve("cea_request", request.Id, new ColumnSet("cea_status")).GetAttributeValue<OptionSetValue>("cea_status");
                if (st == null || st.Value != 10) throw new InvalidPluginExecutionException("Final package files can only be added while the request is in Final Processing.");
            }

            var q = new QueryExpression("cea_requestattachment") { ColumnSet = new ColumnSet("cea_filename", "cea_package") };
            q.Criteria.AddCondition("cea_requestid", ConditionOperator.Equal, request.Id);
            var count = 0;
            foreach (var e in service.RetrieveMultiple(q).Entities)
            {
                if (string.Equals(e.GetAttributeValue<string>("cea_filename"), name, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidPluginExecutionException("A file named '" + name + "' already exists on this request. Rename or remove it first.");
                var p = e.GetAttributeValue<OptionSetValue>("cea_package");
                if ((p == null ? 1 : p.Value) == package.Value) count++;
            }
            if (count >= MaxFiles)
                throw new InvalidPluginExecutionException("A request can have at most " + MaxFiles + " files per package.");

            target["cea_type"] = ext;
            target["cea_uploadedon"] = DateTime.UtcNow;
            target["cea_uploadedbyid"] = new EntityReference("systemuser", context.InitiatingUserId);
        }

        private static void Guard(IOrganizationService service, EntityReference request, HashSet<string> roles, bool admin, bool delete)
        {
            var cs = service.Retrieve("cea_request", request.Id, new ColumnSet("cea_status")).GetAttributeValue<OptionSetValue>("cea_status");
            if (cs != null && cs.Value == 7) throw new InvalidPluginExecutionException("The request is Completed and can no longer be changed.");
            if (admin && !delete) return;
            if (roles.Contains("CEA Creators"))
            {
                var r = service.Retrieve("cea_request", request.Id, new ColumnSet("cea_status"));
                var s = r.GetAttributeValue<OptionSetValue>("cea_status");
                if (s != null && (s.Value == 1 || s.Value == 4)) return;
                throw new InvalidPluginExecutionException("Attachments can only be added or removed while the request is Draft or Rejected.");
            }
            throw new InvalidPluginExecutionException("You are not allowed to add or remove attachments on this request.");
        }

        private static HashSet<string> Roles(IOrganizationService service, Guid userId)
        {
            var q = new QueryExpression("role") { ColumnSet = new ColumnSet("name") };
            var link = q.AddLink("systemuserroles", "roleid", "roleid");
            link.LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, userId);
            var set = new HashSet<string>();
            foreach (var e in service.RetrieveMultiple(q).Entities) set.Add(e.GetAttributeValue<string>("name"));
            return set;
        }
    }
}

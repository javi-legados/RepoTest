using System;
using Microsoft.Xrm.Sdk;

namespace CEAPlatform.Plugins
{
    // Spec 001 (FR-008a): blocks deactivating a user who still owns or must decide on open requests.
    // Registered PreOperation on SetState of systemuser.
    public class UserDeactivationGuard : IPlugin
    {
        // Request tables arrive with Spec 4; until then the check is intentionally a no-op.
        private const bool RequestTablesAvailable = false;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var moniker = context.InputParameters.Contains("EntityMoniker") ? context.InputParameters["EntityMoniker"] as EntityReference : null;
            var state = context.InputParameters.Contains("State") ? context.InputParameters["State"] as OptionSetValue : null;
            if (moniker == null || moniker.LogicalName != "systemuser" || state == null || state.Value != 1) return;

            if (RequestTablesAvailable && HasOpenRequests(serviceProvider, moniker.Id))
                throw new InvalidPluginExecutionException(
                    "The user cannot be deactivated: they have requests in Draft, review or approval, or requests awaiting their decision. Reassign or complete them first.");
        }

        private static bool HasOpenRequests(IServiceProvider serviceProvider, Guid userId)
        {
            return false;
        }
    }
}

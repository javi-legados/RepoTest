// Spec 001 FR-006a: warn on the User form when Manager Email matches no active user.
var CEA = CEA || {};
CEA.UserForm = (function () {
  var NOTIFICATION_ID = "cea_manager_not_registered";

  function check(executionContext) {
    var formContext = executionContext.getFormContext();
    var attr = formContext.getAttribute("cea_manageremail");
    var email = attr ? attr.getValue() : null;
    formContext.ui.clearFormNotification(NOTIFICATION_ID);
    if (!email) { return; }
    var safe = email.replace(/'/g, "''");
    Xrm.WebApi.retrieveMultipleRecords("systemuser",
      "?$select=systemuserid&$top=1&$filter=internalemailaddress eq '" + safe + "' and isdisabled eq false")
      .then(function (r) {
        if (r.entities.length === 0) {
          formContext.ui.setFormNotification(
            "Manager is not registered. The user cannot submit requests until the manager is registered with CEA Internal Approvals.",
            "WARNING", NOTIFICATION_ID);
        }
      });
  }

  function onLoad(executionContext) {
    var formContext = executionContext.getFormContext();
    ["cea_sapnumber", "lastname", "internalemailaddress", "cea_department", "cea_managername", "cea_manageremail", "businessunitid"]
      .forEach(function (n) {
        var a = formContext.getAttribute(n);
        if (a) { a.setRequiredLevel("required"); }
      });
    var attr = formContext.getAttribute("cea_manageremail");
    if (attr) { attr.addOnChange(check); }
    check(executionContext);
  }

  return { onLoad: onLoad };
})();

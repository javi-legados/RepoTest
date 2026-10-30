var CEA = CEA || {};
CEA.RequestForm = (function () {
  "use strict";
  var METRIC_CATEGORIES = [2, 3, 5, 7];

  function show(formContext, name, visible) {
    var c = formContext.getControl(name);
    if (c) { c.setVisible(visible); }
  }
  function applyRules(formContext) {
    var supplemental = formContext.getAttribute("cea_supplemental").getValue() === true;
    show(formContext, "cea_projectname", !supplemental);
    show(formContext, "cea_existingceareferenceid", supplemental);

    var cat = formContext.getAttribute("cea_category").getValue();
    var metrics = METRIC_CATEGORIES.indexOf(cat) >= 0;
    ["cea_payback", "cea_irr", "cea_npv"].forEach(function (n) { show(formContext, n, metrics); });

    var inPlan = formContext.getAttribute("cea_projectinplan").getValue() === true;
    show(formContext, "cea_budgetedamount", inPlan);
  }
  function checkDates(formContext) {
    var s = formContext.getAttribute("cea_startdate").getValue();
    var e = formContext.getAttribute("cea_estimatedcompletiondate").getValue();
    var ctl = formContext.getControl("cea_estimatedcompletiondate");
    if (s && e && e < s) {
      ctl.setNotification("Estimated Completion Date cannot be earlier than the Start Date.", "cea_date_order");
    } else {
      ctl.clearNotification("cea_date_order");
    }
  }
  function checkForecast(formContext) {
    var pct = formContext.getAttribute("cea_forecastpercentage").getValue();
    var ctl = formContext.getControl("cea_forecastpercentage");
    if (pct !== null && pct !== 100) {
      ctl.setNotification("Forecast percentages should add up to 100%.", "cea_fc");
    } else {
      ctl.clearNotification("cea_fc");
    }
  }
  var EDITABLE = [1, 4, 9];
  function status(fc) {
    var a = fc.getAttribute("cea_status");
    return a ? a.getValue() : null;
  }
  // UI convenience only: the plug-ins enforce the real edit rules.
  function applyLock(fc) {
    var s = status(fc);
    if (s === null || EDITABLE.indexOf(s) >= 0) { return; }
    fc.ui.controls.forEach(function (c) {
      if (c.getControlType && c.getControlType() !== "subgrid" && c.setDisabled) { c.setDisabled(true); }
    });
  }
  function showRejection(fc) {
    var s = status(fc);
    fc.ui.clearFormNotification("cea_rejection");
    if (s !== 9 && s !== 4) { return; }
    var id = fc.data.entity.getId().replace(/[{}]/g, "");
    Xrm.WebApi.retrieveMultipleRecords("cea_revisioncycle",
      "?$select=cea_cycle,cea_rejectioncomments,cea_rejectedon,_cea_rejectedbyid_value&$filter=_cea_requestid_value eq " + id + "&$orderby=cea_cycle desc&$top=1").then(function (r) {
      if (!r.entities.length) { return; }
      var e = r.entities[0];
      var by = e["_cea_rejectedbyid_value@OData.Community.Display.V1.FormattedValue"] || "";
      var on = e["cea_rejectedon@OData.Community.Display.V1.FormattedValue"] || "";
      fc.ui.setFormNotification((s === 9 ? "Returned to Creator" : "Rejected") + " by " + by + " on " + on + ": " + (e.cea_rejectioncomments || ""), "WARNING", "cea_rejection");
    });
  }
  function call(fc, api, extra, done) {
    var ref = { entityType: "cea_request", id: fc.data.entity.getId().replace(/[{}]/g, "") };
    var req = {
      Request: { "@odata.type": "Microsoft.Dynamics.CRM.cea_request", cea_requestid: ref.id },
      getMetadata: function () {
        var p = { Request: { typeName: "mscrm.cea_request", structuralProperty: 5 } };
        Object.keys(extra).forEach(function (k) { p[k] = { typeName: typeof extra[k] === "boolean" ? "Edm.Boolean" : "Edm.String", structuralProperty: 1 }; });
        return { boundParameter: null, parameterTypes: p, operationType: 0, operationName: api };
      }
    };
    Object.keys(extra).forEach(function (k) { req[k] = extra[k]; });
    var run = function () {
      Xrm.WebApi.online.execute(req).then(function () { fc.data.refresh(false).then(done || function () {}); },
        function (e) { Xrm.Navigation.openErrorDialog({ message: e.message }); });
    };
    return run;
  }
  function guarded(api, allowed, label, extra) {
    return function (fc) {
      var s = status(fc);
      if (allowed.indexOf(s) < 0) { Xrm.Navigation.openAlertDialog({ text: label + " is not available for the current status." }); return; }
      fc.data.save().then(function () { call(fc, api, extra || {})(); });
    };
  }
  function resubmit(fc) {
    if (status(fc) !== 9) { Xrm.Navigation.openAlertDialog({ text: "Resubmit is only available while the request is Returned to Creator." }); return; }
    Xrm.Navigation.openConfirmDialog({ text: "Resubmit this request for review?", title: "Resubmit" }).then(function (r) {
      if (r.confirmed) { fc.data.save().then(function () { call(fc, "cea_ResubmitRequest", {})(); }); }
    });
  }
  function complete(fc) {
    if (status(fc) !== 10) { Xrm.Navigation.openAlertDialog({ text: "Complete is only available in Final Processing." }); return; }
    Xrm.Navigation.openConfirmDialog({ text: "Complete this request? It cannot be changed afterwards.", title: "Complete Request" }).then(function (r) {
      if (r.confirmed) { call(fc, "cea_CompleteRequest", { Confirmation: true })(); }
    });
  }
  function returnToCreator(fc) {
    if (status(fc) !== 2) { Xrm.Navigation.openAlertDialog({ text: "Return to Creator is only available during Initial Review." }); return; }
    var comments = window.prompt("Comments for the Creator (required):");
    if (!comments || !comments.trim()) { Xrm.Navigation.openAlertDialog({ text: "Comments are required to return a request." }); return; }
    call(fc, "cea_ReturnToCreator", { Comments: comments })();
  }
  function releaseToApproval(fc) {
    if (status(fc) !== 2) { Xrm.Navigation.openAlertDialog({ text: "Release to Approval is only available during Initial Review." }); return; }
    Xrm.Navigation.openConfirmDialog({ text: "Release this request to the approval chain?", title: "Release to Approval" }).then(function (r) {
      if (!r.confirmed) { return; }
      var ref = { Request: { "@odata.type": "Microsoft.Dynamics.CRM.cea_request", cea_requestid: fc.data.entity.getId().replace(/[{}]/g, "") } };
      var meta = function (api, withMsg) {
        var p = { Request: { typeName: "mscrm.cea_request", structuralProperty: 5 } };
        if (withMsg) { p.Comments = { typeName: "Edm.String", structuralProperty: 1 }; }
        return function () { return { boundParameter: null, parameterTypes: p, operationType: 0, operationName: api }; };
      };
      var rel = { Request: ref.Request, getMetadata: meta("cea_ReleaseToApproval", false) };
      Xrm.WebApi.online.execute(rel).then(function () { fc.data.refresh(false); }, function (e) {
        var n = { Request: ref.Request, Comments: e.message, getMetadata: meta("cea_NotifyReleaseBlocked", true) };
        Xrm.WebApi.online.execute(n).then(function () {}, function () {});
        Xrm.Navigation.openErrorDialog({ message: e.message });
      });
    });
  }
  function isAdmin() {
    var roles = Xrm.Utility.getGlobalContext().userSettings.roles, found = false;
    roles.forEach(function (r) { if (r.name === "CEA Administrators" || r.name === "System Administrator") { found = true; } });
    return found;
  }
  function isPendingApprover(fc) {
    var p = fc.getAttribute("cea_pendingapproverid"), v = p && p.getValue();
    var me = Xrm.Utility.getGlobalContext().userSettings.userId.replace(/[{}]/g, "").toLowerCase();
    return !!(v && v.length && v[0].id.replace(/[{}]/g, "").toLowerCase() === me);
  }
  function decide(fc, api, label) {
    if (status(fc) !== 3) { Xrm.Navigation.openAlertDialog({ text: label + " is only available while the request is Pending Approval." }); return; }
    var comments = window.prompt("Comments for " + label.toLowerCase() + " (required):");
    if (!comments || !comments.trim()) { Xrm.Navigation.openAlertDialog({ text: "Comments are required." }); return; }
    call(fc, api, { Comments: comments })();
  }
  function approve(fc) { decide(fc, "cea_ApproveStep", "Approve"); }
  function reject(fc) { decide(fc, "cea_RejectStep", "Reject"); }
  function onLoad(executionContext) {
    var fc = executionContext.getFormContext();
    applyLock(fc);
    showRejection(fc);
    ["cea_supplemental", "cea_category", "cea_projectinplan"].forEach(function (n) {
      fc.getAttribute(n).addOnChange(function () { applyRules(fc); });
    });
    ["cea_startdate", "cea_estimatedcompletiondate"].forEach(function (n) {
      fc.getAttribute(n).addOnChange(function () { checkDates(fc); });
    });
    applyRules(fc);
    checkDates(fc);
    checkForecast(fc);
  }
  // Spec 005 T017: attachment sub-grid commands are only enabled in Draft or Rejected (server guard stays authoritative).
  function attachmentsEditable(fc) {
    var s = status(fc);
    return s === 1 || s === 4;
  }
  function addAttachment(fc) {
    Xrm.Navigation.openForm({ entityName: "cea_requestattachment" }, {
      cea_requestid: fc.data.entity.getId().replace(/[{}]/g, ""), cea_requestidname: fc.getAttribute("cea_name") ? fc.getAttribute("cea_name").getValue() : "", cea_requestidtype: "cea_request"
    });
  }
  function removeAttachments(fc, ids) {
    if (!ids || !ids.length) { Xrm.Navigation.openAlertDialog({ text: "Select at least one attachment." }); return; }
    Xrm.Navigation.openConfirmDialog({ text: "Remove the selected attachment(s)?", title: "Remove attachments" }).then(function (r) {
      if (!r.confirmed) { return; }
      Promise.all(ids.map(function (id) { return Xrm.WebApi.deleteRecord("cea_requestattachment", id.replace(/[{}]/g, "")); })).then(function () {
        fc.ui.controls.forEach(function (c) { if (c.getControlType() === "subgrid") { c.refresh(); } });
      }, function (e) { Xrm.Navigation.openAlertDialog({ text: e.message }); });
    });
  }
  function canReassign(fc) {
    var d = fc.getAttribute("cea_decided");
    return isAdmin() && !!d && d.getValue() === false;
  }
  // Spec 003 T028: Reassign approver on a pending Resolved Approver row (cea_ReassignApprover).
  function reassignApprover(fc) {
    var req = fc.getAttribute("cea_requestid").getValue(), lvl = fc.getAttribute("cea_level").getValue();
    if (!req || !lvl) { Xrm.Navigation.openAlertDialog({ text: "This row has no request or level." }); return; }
    Xrm.Utility.lookupObjects({ entityTypes: ["systemuser"], allowMultiSelect: false, defaultViewId: "{7C3E1A52-5B0D-4E1F-9A2B-0C6D8E4F1A73}" }).then(function (sel) {
      if (!sel || !sel.length) { return; }
      var reason = window.prompt("Reason for the reassignment (required):");
      if (!reason || !reason.trim()) { Xrm.Navigation.openAlertDialog({ text: "A reason is required." }); return; }
      var rid = req[0].id.replace(/[{}]/g, ""), uid = sel[0].id.replace(/[{}]/g, "");
      var r = {
        Request: { "@odata.type": "Microsoft.Dynamics.CRM.cea_request", cea_requestid: rid },
        Level: lvl,
        NewApprover: { "@odata.type": "Microsoft.Dynamics.CRM.systemuser", systemuserid: uid },
        Reason: reason,
        getMetadata: function () {
          return {
            boundParameter: null, operationType: 0, operationName: "cea_ReassignApprover",
            parameterTypes: {
              Request: { typeName: "mscrm.cea_request", structuralProperty: 5 }, Level: { typeName: "Edm.Int32", structuralProperty: 1 },
              NewApprover: { typeName: "mscrm.systemuser", structuralProperty: 5 }, Reason: { typeName: "Edm.String", structuralProperty: 1 }
            }
          };
        }
      };
      Xrm.WebApi.online.execute(r).then(function () { fc.data.refresh(false); }, function (e) { Xrm.Navigation.openErrorDialog({ message: e.message }); });
    });
  }
  return {
    canReassign: canReassign,
    reassignApprover: reassignApprover,
    attachmentsEditable: attachmentsEditable,
    addAttachment: addAttachment,
    removeAttachments: removeAttachments,
    onLoad: onLoad,
    returnToCreator: returnToCreator,
    releaseToApproval: releaseToApproval,
    isAdmin: isAdmin,
    approve: approve,
    reject: reject,
    isPendingApprover: isPendingApprover,
    submit: guarded("cea_SubmitRequest", [1], "Submit"),
    resubmit: resubmit,
    complete: complete
  };
})();

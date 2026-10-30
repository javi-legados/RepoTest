# Skip Creator as Approver (Spec 2, FR-013)

When the Creator of a request is the approver of a step, the Approval Chain flow must:
1. Skip the step automatically (the Creator never approves their own request).
2. Move to the next approval level.
3. Record the skip in the request history (immutable).

To be honored by the Approval Chain flow (Spec 5).

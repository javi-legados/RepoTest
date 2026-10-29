# Quickstart: Validating Approver Assignment

1. As admin assign a Plant Manager to a plant and a Regional Approver to a region; a user without the role or inactive is refused.
2. Submit from a Plant Creator: three levels resolved in order.
3. Submit from a Region Creator: two levels; from Company/Enterprise: one.
4. Remove the Plant Manager: submission blocked naming the level; the BU appears in the missing-approvers view.
5. Same person as manager and Plant Manager: two separate rows and decisions.
6. Change the Plant Manager during a request: undecided level updates, decided level unchanged, both logged.
7. Reassign a pending step with a reason: new approver gets it; record exists. Empty reason is refused.

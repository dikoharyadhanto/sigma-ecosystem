# DIR-CLOSE

> Human-readable project closure document.
>
> This document explains what was delivered, why the project can be closed, what evidence supports closure, what limitations are accepted, and what must move into a new Intent.
>
> **Lock State**: Managed by Sigma CLI via `progress.json`. Do not edit lock state here.
> **Gate Rule**: Requires the relevant INTENT → ROADMAP → PLAN → EXEC evidence chain to be locked or explicitly accepted before closure.
> **Audience**: Director, future project owner, human reviewer. This document must be understandable without reading every artifact in the chain.

---

## 1. Closure Decision Summary

### Closure Decision

CLOSE_ACCEPTED / CLOSE_ACCEPTED_WITH_LIMITATIONS / DO_NOT_CLOSE / OPEN_NEW_PLAN / UPDATE_CURRENT_EXEC

### One-Paragraph Closure Statement

[Write one clear paragraph explaining whether the project is accepted for closure and why.]

Example structure:

> This project is accepted for closure because [main delivered outcome] is now working and evidenced through [main evidence chain]. The project delivered [major capability groups], while intentionally excluding [non-scope items]. Remaining limitations are documented and either accepted, deferred, or assigned to a new Intent.

### Closure Confidence

High / Medium / Low

### Closure Type

* Full closure
* Closure with accepted limitations
* Technical phase closure
* Pilot closure
* Scope closure before new Intent
* Do not close

### Final Recommendation

[State the final recommendation in direct language.]

---

## 2. Human-Readable Project Story

> This section is the main narrative. It should help a human understand the journey without reading every PLAN, EXEC, and audit artifact.

### Where This Project Started

[Describe the original project intent in plain language. What problem was this project created to solve?]

### How The Project Evolved

[Summarize the major evolution of the project. Avoid listing every artifact. Group the journey into meaningful phases.]

Example:

> The project began as a foundation effort to validate the satellite pipeline and database. It then expanded into product surfaces, admin operations, account and access workflows, estate lifecycle control, deployment hardening, and final raster-serving modernization.

### Where The Project Ended

[Describe the final state of the project. What can the system or product now do that it could not do before?]

### Why Closure Is Reasonable Now

[Explain why this is the right stopping point. This is not the same as saying everything is perfect.]

Good closure reasons may include:

* The original intent has been satisfied.
* The remaining work belongs to a new intent.
* The system reached a stable operational boundary.
* A pilot has produced enough evidence for a decision.
* Further work would expand scope rather than complete the current scope.

---

## 3. Delivered Capability Map

> Use this section to summarize the actual delivered capabilities. Do not write a raw changelog.

| Capability Area                                                        | Delivered Outcome | Evidence Level                              | Notes |
| :--------------------------------------------------------------------- | :---------------- | :------------------------------------------ | :---- |
| [Foundation / Pipeline / Product / Admin / Raster / Deployment / etc.] | [...]             | Strong / Adequate / Partial / Not Delivered | [...] |
| [...]                                                                  | [...]             | [...]                                       | [...] |

### Most Important Delivered Outcomes

List only the highest-value results.

* [...]
* [...]
* [...]

### Primary User / Beneficiary

[Who benefits from this work? Examples: Director, Manager users, Admin users, Super Admin, internal operators, future Phase 2 implementation.]

### Primary Value Delivered

[What concrete value does the delivered system now provide?]

---

## 4. Milestone Journey

> This section compresses many artifacts into a small number of human-readable milestones.

| Milestone               | What Changed | Why It Mattered | Evidence Group |
| :---------------------- | :----------- | :-------------- | :------------- |
| Milestone 1 — [...]     | [...]        | [...]           | [...]          |
| Milestone 2 — [...]     | [...]        | [...]           | [...]          |
| Milestone 3 — [...]     | [...]        | [...]           | [...]          |
| Final Milestone — [...] | [...]        | [...]           | [...]          |

### Major Turning Points

Document only the important decisions or corrections.

* [Decision/correction]: [Why it mattered]
* [Decision/correction]: [Why it mattered]
* [Decision/correction]: [Why it mattered]

### Superseded or Corrected Paths

[State whether any plans or assumptions were superseded, corrected, or absorbed into later work.]

If none:

> No material superseded path affected closure.

If yes:

> The following paths were corrected during the project. These are not hidden failures; they are documented course corrections in the evidence chain.

| Item  | What Changed | Why It Was Corrected | Final Resolution |
| :---- | :----------- | :------------------- | :--------------- |
| [...] | [...]        | [...]                | [...]            |

---

## 5. Intent Satisfaction

> Closure must answer whether the locked Director Intent was satisfied.

### Intent Satisfied

Yes / Partially / No

### Intent Summary

[Summarize the relevant Director Intent in plain language.]

### Satisfaction Assessment

| Intent Element          | Closure Assessment                              | Evidence / Note |
| :---------------------- | :---------------------------------------------- | :-------------- |
| Primary objective       | Satisfied / Partially / Not satisfied           | [...]           |
| Success criteria        | Satisfied / Partially / Not satisfied           | [...]           |
| Scope boundary          | Respected / Deviated / Expanded                 | [...]           |
| Trade-off               | Preserved / Changed / Not applicable            | [...]           |
| Primary failure concern | Addressed / Partially addressed / Not addressed | [...]           |

### Plain-Language Satisfaction Statement

[Explain in 3–6 sentences whether the intent was met and why.]

---

## 6. Evidence Register

> This section proves closure without forcing the reader to inspect every file immediately. Keep it concise. Put large artifact lists in an appendix if needed.

### Primary Evidence

| Evidence Type        | Reference | What It Proves                           | Closure Weight                   |
| :------------------- | :-------- | :--------------------------------------- | :------------------------------- |
| DIR-INTENT           | [...]     | Original destination and scope           | Required                         |
| ROADMAP              | [...]     | Stage breakdown and scope governance     | Required if project used roadmap |
| FMN-PLAN             | [...]     | Build/test contract                      | Required                         |
| DEV-EXEC             | [...]     | Implementation and walkthrough evidence  | Required                         |
| Test Result          | [...]     | Verification against acceptance criteria | Strong                           |
| Git Diff / Commit    | [...]     | Physical code/change trace               | Strong                           |
| Director Observation | [...]     | Manual review or accepted behavior       | Optional but valuable            |
| Audit / Review       | [...]     | Independent weakness/risk assessment     | Optional but valuable            |

### Evidence Clusters

Use this when the project has many artifacts.

| Evidence Cluster               | Artifact Range / References | What This Cluster Proves |
| :----------------------------- | :-------------------------- | :----------------------- |
| Foundation evidence            | [...]                       | [...]                    |
| Product behavior evidence      | [...]                       | [...]                    |
| Security / deployment evidence | [...]                       | [...]                    |
| Final closure evidence         | [...]                       | [...]                    |

### Evidence Quality Assessment

Strong / Adequate / Mixed / Weak

Reason:

[...]

---

## 7. Final Scope Confirmation

### Delivered

* [...]
* [...]
* [...]

### Not Delivered / Deferred

* [...]
* [...]
* [...]

### Explicit Non-Scope Preserved

* [...]
* [...]
* [...]

### Accidental Scope Drift

None / [...]

If scope drift occurred:

| Drift | Impact | Accepted?              | Resolution |
| :---- | :----- | :--------------------- | :--------- |
| [...] | [...]  | Yes / No / Conditional | [...]      |

---

## 8. Product / System Behavior at Closure

> Describe how the delivered system behaves now. This should be understandable to a user or future maintainer.

### Core Flow

1. [...]
2. [...]
3. [...]

### Key Behaviors

| Behavior | Trigger | Output / Result | Notes |
| :------- | :------ | :-------------- | :---- |
| [...]    | [...]   | [...]           | [...] |

### User-Facing Behavior

[What does the user actually experience?]

### Operator / Admin Behavior

[What does an admin, operator, or maintainer do?]

### Backend / System Behavior

[What happens behind the scenes, but only at the level needed for closure understanding.]

---

## 9. Known Limitations and Accepted Risks

> A closure document is stronger when it clearly states what is still limited.

| Limitation / Risk | User Impact | Operational Impact | Workaround / Follow-Up | Accepted?              |
| :---------------- | :---------- | :----------------- | :--------------------- | :--------------------- |
| [...]             | [...]       | [...]              | [...]                  | Yes / No / Conditional |

### Accepted Limitations

* [...]
* [...]

### Not Accepted / Blocking Limitations

* None / [...]

### Why These Limitations Do Not Block Closure

[Explain why the accepted limitations are compatible with closure.]

---

## 10. Deviations From Intent or Plan

| Deviation | Source                                     | Impact | Resolution                              |
| :-------- | :----------------------------------------- | :----- | :-------------------------------------- |
| [...]     | DIR-INTENT / ROADMAP / FMN-PLAN / DEV-EXEC | [...]  | Accepted / Deferred / Requires New Plan |

If none:

> No material deviation from locked DIR-INTENT, ROADMAP, or FMN-PLAN.

### Deviation Summary

[Explain whether deviations were harmless, accepted, or need follow-up.]

---

## 11. Operational and Maintenance Notes

### How to Run / Use

* Setup:
* Run command:
* Required configuration:
* Important dependency:
* Environment:

### Maintenance Notes

* Known operational risks:
* Debug path:
* Monitoring needed:
* Backup / restore notes:
* Follow-up owner:

### Security / Access Notes

* Sensitive credentials:
* Access boundaries:
* Admin-only operations:
* User-facing restrictions:

---

## 12. New Intent Boundary

> This section prevents unfinished future work from being mistaken as a closure failure.

### Work That Must Move To A New Intent

* [...]
* [...]
* [...]

### Why This Is New Intent Work

[Explain why these items are not part of the current closure.]

Examples:

* They expand the product beyond Phase 1.
* They require a new architecture decision.
* They change the user/business destination.
* They introduce new operational risk.
* They require new success criteria.

### Recommended Next Intent Themes

Optional.

* [...]
* [...]
* [...]

### Do Not Carry Forward As Hidden Debt

List any items that must be explicitly planned, not silently assumed.

* [...]
* [...]

---

## 13. Publish-Ready Documentation Notes

> Notes reusable for README, release notes, product documentation, GitHub documentation, or user handoff.

### Short Product Description

[...]

### Feature Summary

* [...]
* [...]
* [...]

### Usage Notes

* [...]
* [...]

### Limitations To Disclose

* [...]
* [...]

### Release Note Draft

[Optional short release note.]

---

## 14. Final Closure Statement

### Director Closure Decision

CLOSE_ACCEPTED / CLOSE_ACCEPTED_WITH_LIMITATIONS / DO_NOT_CLOSE / OPEN_NEW_PLAN / UPDATE_CURRENT_EXEC

### Reason

[...]

### Accepted Limitations

* [...]
* [...]
* [...]

### Required Follow-Up

* [...]
* [...]
* [...]

### Closure Sentence

Write one final sentence that can be read independently.

Example:

> Director accepts closure of [Project/Phase] as [closure type], with [limitations], and directs all further expansion to begin from a new Intent.

---

## Appendix A — Detailed Artifact Index

> Optional. Use this only if the project has many artifacts. Keep the main closure document readable.

| Artifact | Type                                                | Status                                 | Purpose | Notes |
| :------- | :-------------------------------------------------- | :------------------------------------- | :------ | :---- |
| [...]    | INTENT / ROADMAP / PLAN / EXEC / AUDIT / TEST / DOC | LOCKED / SUPERSEDED / DRAFT / ACCEPTED | [...]   | [...] |

---

## Appendix B — Detailed Test Matrix

> Optional. Use only when the closure depends on many tests.

| Test / Evidence | Result                | What It Proves | Limitation |
| :-------------- | :-------------------- | :------------- | :--------- |
| [...]           | PASS / FAIL / PARTIAL | [...]          | [...]      |

---

## Appendix C — Residual Risk Register

> Optional. Use if closure is accepted with limitations.

| Risk  | Severity            | Why Accepted | Required Future Action |
| :---- | :------------------ | :----------- | :--------------------- |
| [...] | Low / Medium / High | [...]        | [...]                  |

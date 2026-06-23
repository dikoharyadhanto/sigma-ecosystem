<!-- SIGMA:DOC type=DIR_CLOSE schema=2 -->
# DIR-CLOSE

> Human-readable project closure document.
>
> Main body: story, decision, and evidence map for human readers.
> Appendix: detailed evidence register for audit and traceability.
>
> **Lock State**: Managed by Sigma CLI via `progress.json`. Do not edit lock state here.
> **Gate Rule**: Requires INTENT -> PLAN -> EXEC chain all LOCKED before `sigma close new`.
> **Audience**: Director, future project owner, operator, and human reviewer.

---

<!-- SIGMA:DIR_CLOSE:SECTION:CLOSURE_DECISION -->
## 1. Closure Decision

### Decision

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe.

- [ ] CLOSE_ACCEPTED
- [ ] CLOSE_ACCEPTED_WITH_LIMITATIONS
- [ ] DO_NOT_CLOSE
- [ ] OPEN_NEW_PLAN
- [ ] UPDATE_CURRENT_EXEC
- [ ] OTHER: [describe]

### Closure Confidence

High / Medium / Low

### One-Paragraph Closure Statement

[State whether the project or phase is accepted for closure and why. Mention the delivered outcome, main evidence basis, accepted limitations, and whether future work must move to a new Intent.]

---

<!-- SIGMA:DIR_CLOSE:SECTION:HUMAN_PROJECT_STORY -->
## 2. Human Project Story

> Explain the project journey without listing every artifact. Keep the story readable for a human who has not read the full evidence chain.

### Where This Project Started

[Describe the original Director Intent in plain language. What problem was this project created to solve?]

### How The Project Evolved

[Summarize the major phases of the project. Group work into meaningful capability or maturity stages instead of listing every PLAN, EXEC, or stage.]

### Where The Project Ended

[Describe the final delivered state. What can the product, system, or team now do that it could not do before?]

### Why Closure Is Reasonable Now

[Explain why this is the right stopping point. Closure does not require perfection; it requires a satisfied intent, sufficient evidence, and clear boundaries for remaining work.]

---

<!-- SIGMA:DIR_CLOSE:SECTION:DELIVERED_STATE -->
## 3. Delivered State

### Primary User / Beneficiary

[Who uses or benefits from the delivered output.]

### Primary Value Delivered

[The concrete value this project now provides.]

### Delivered Capability Map

| Capability Area | Delivered Outcome | Evidence Level | Notes |
| :---            | :---              | :---           | :---  |
| [...]           | [...]             | Strong / Adequate / Partial / Not Delivered | [...] |

### Most Important Delivered Outcomes

- [...]
- [...]

---

<!-- SIGMA:DIR_CLOSE:SECTION:INTENT_SATISFACTION -->
## 4. Intent Satisfaction

Summarize how the delivered output satisfies the locked Director Intent.

| Intent Element          | Closure Assessment                              | Evidence / Note |
| :---                    | :---                                            | :---            |
| Primary objective       | Satisfied / Partially / Not satisfied           | [...]           |
| Success criteria        | Satisfied / Partially / Not satisfied           | [...]           |
| Scope boundary          | Respected / Deviated / Expanded                 | [...]           |
| Trade-off               | Preserved / Changed / Not applicable            | [...]           |
| Primary failure concern | Addressed / Partially addressed / Not addressed | [...]           |

### Plain-Language Satisfaction Statement

[Explain in 3-6 sentences whether the intent was met and why.]

---

<!-- SIGMA:DIR_CLOSE:SECTION:EVIDENCE_MAP -->
## 5. Evidence Map

> This section proves closure at a human-readable level. Put detailed artifact lists, test matrices, and screenshots in the appendix.
>
> At minimum, DIR-CLOSE must reference the locked FMN-PLAN and DEV-EXEC versions that support the closure claim.

### Primary Evidence

| Evidence Type        | Reference | What It Proves                             |
| :---                 | :---      | :---                                       |
| DIR-INTENT           | [...]     | Original destination and scope             |
| FMN-PLAN             | [...]     | Build/test contract used                   |
| DEV-EXEC             | [...]     | Implementation and walkthrough evidence    |
| Test Result          | [...]     | Verification against test contract         |
| Git Diff Evidence    | [...]     | Physical code/change trace                 |
| Director Observation | [...]     | Manual testing signal / accepted follow-up |

### Evidence Clusters

Use this when the project has many artifacts. Keep the body at cluster level.

| Evidence Cluster | Artifact Range / References | What This Cluster Proves |
| :---             | :---                        | :---                     |
| [...]            | [...]                       | [...]                    |

### Evidence Quality Assessment

Strong / Adequate / Mixed / Weak

Reason:

[...]

---

<!-- SIGMA:DIR_CLOSE:SECTION:LIMITATIONS_DEVIATIONS_CORRECTIONS -->
## 6. Limitations, Deviations, and Corrections

> Closure is stronger when accepted limitations, material deviations, and corrected paths are stated plainly.

### Known Limitations and Accepted Risks

| Limitation / Risk | User Impact | Operational Impact | Workaround / Follow-Up | Accepted? |
| :---              | :---        | :---               | :---                   | :---      |
| [...]             | [...]       | [...]              | [...]                  | Yes / No / Conditional |

### Deviations From Intent / Plan

| Deviation | Source                           | Impact | Resolution |
| :---      | :---                             | :---   | :---       |
| [...]     | DIR-INTENT / FMN-PLAN / DEV-EXEC | [...]  | Accepted / Deferred / Needs New Plan |

If none, write:

> No material deviation from locked DIR-INTENT or FMN-PLAN.

### Superseded or Corrected Paths

[State whether any plans, assumptions, or implementation paths were superseded, corrected, or absorbed into later work.]

If none, write:

> No material superseded path affected closure.

---

<!-- SIGMA:DIR_CLOSE:SECTION:OPERATIONAL_HANDOFF_NOTES -->
## 7. Operational Handoff

### How to Run / Use

- Setup:
- Run command:
- Required configuration:
- Important dependency:
- Environment:

### Maintenance Notes

- Known operational risks:
- Debug path:
- Monitoring needed:
- Backup / restore notes:
- Follow-up owner:

### Security / Access Notes

- Sensitive credentials:
- Access boundaries:
- Admin-only operations:
- User-facing restrictions:

---

<!-- SIGMA:DIR_CLOSE:SECTION:NEW_INTENT_BOUNDARY -->
## 8. New Intent Boundary

> This section prevents future work from being mistaken as a closure failure.

### Delivered In This Closure

- [...]
- [...]

### Not Delivered / Deferred

- [...]
- [...]

### Explicit Non-Scope Preserved

- [...]
- [...]

### Work That Must Move To A New Intent

- [...]
- [...]

### Why This Is New Intent Work

[Explain why these items expand the product, change the destination, introduce new risk, or require new success criteria.]

### Do Not Carry Forward As Hidden Debt

- [...]
- [...]

---

<!-- SIGMA:DIR_CLOSE:SECTION:FINAL_DIRECTOR_DECISION -->
## 9. Final Director Decision

> Director-only closure notes. Runtime lock state is managed by Sigma CLI, not by this section.

### Reason

[State the final reason for closure, non-closure, new plan, or current exec update.]

### Accepted Limitations

- [...]

### Required Follow-Up

- [...]

### Closure Sentence

[Write one final sentence that can be read independently.]

Example:

> Director accepts closure of [Project/Phase] as [closure type], with [limitations], and directs all further expansion to begin from a new Intent.

---

## Appendix A - Detailed Evidence Register

> Optional. Use this appendix when the project has many artifacts. Keep the main closure document readable.

| Artifact | Type | Status | Purpose | Notes |
| :---     | :--- | :---   | :---    | :---  |
| [...]    | INTENT / PLAN / EXEC / AUDIT / TEST / DOC | LOCKED / SUPERSEDED / DRAFT / ACCEPTED | [...] | [...] |

---

## Appendix B - Detailed Test Matrix

> Optional. Use this appendix when closure depends on many tests.

| Test / Evidence | Result | What It Proves | Limitation |
| :---            | :---   | :---           | :---       |
| [...]           | PASS / FAIL / PARTIAL | [...] | [...] |

---

## Appendix C - Residual Risk Register

> Optional. Use this appendix when closure is accepted with limitations.

| Risk | Severity | Why Accepted | Required Future Action |
| :--- | :---     | :---         | :---                   |
| [...] | Low / Medium / High | [...] | [...] |

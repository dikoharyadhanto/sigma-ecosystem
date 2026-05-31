# DIR-CLOSE

> Final closure summary, evidence reference, accepted limitations, and publish-ready documentation notes.
>
> **Lock State**: Managed by Sigma CLI via `progress.json`. Do not edit lock state here.
> **Gate Rule**: Requires INTENT → PLAN → EXEC chain all LOCKED before `sigma close new`.

---

## 1. Closure Summary

### What Was Delivered

[1–3 sentence description of what was actually delivered.]

### Primary User / Beneficiary

[Who uses or benefits from the delivered output.]

### Primary Value Delivered

[The concrete value this project now provides.]

---

## 2. Intent Satisfaction

Summarize how the delivered output satisfies the locked Director Intent.

- Intent satisfied:
- Success criteria reached:
- Scope delivered:
- Trade-off respected:
- Primary failure concern addressed:

---

## 3. Evidence References

> DIR-CLOSE must reference the evidence that supports closure. At minimum, one locked DEV-EXEC is required.

| Evidence Type        | Reference | What It Proves                             |
| :---                 | :---      | :---                                       |
| FMN-PLAN             | [...]     | Build/test contract used                   |
| DEV-EXEC             | [...]     | Implementation and walkthrough evidence    |
| Test Result          | [...]     | Verification against test contract         |
| Git Diff Evidence    | [...]     | Physical code/change trace                 |
| Director Observation | [...]     | Manual testing signal / accepted follow-up |

---

## 4. Final Scope Confirmation

### Delivered

- [...]
- [...]

### Not Delivered / Deferred

- [...]
- [...]

### Accidental Scope Drift

- None / [...]

---

## 5. Product Behavior Notes

### Core Flow

1. [...]
2. [...]
3. [...]

### Key Behaviors

| Behavior | Trigger | Output / Result |
| :---     | :---    | :---            |
| [...]    | [...]   | [...]           |

---

## 6. Known Limitations

| Limitation | User Impact | Workaround / Follow-Up | Accepted?              |
| :---       | :---        | :---                   | :---                   |
| [...]      | [...]       | [...]                  | Yes / No / Conditional |

---

## 7. Deviations From Intent / Plan

| Deviation | Source                             | Impact | Resolution                           |
| :---      | :---                               | :---   | :---                                 |
| [...]     | DIR-INTENT / FMN-PLAN / DEV-EXEC   | [...]  | Accepted / Deferred / Needs New Plan |

If none, write:

> No material deviation from locked DIR-INTENT or FMN-PLAN.

---

## 8. Operational / Handoff Notes

### How to Run / Use

- Setup:
- Run command:
- Required configuration:
- Important dependency:

### Maintenance Notes

- Known operational risks:
- Debug path:
- Follow-up owner:

---

## 9. Publish-Ready Documentation Notes

> Notes reusable for README, release note, product page, GitHub documentation, or user handoff.

### Short Product Description

[...]

### Feature Summary

- [...]
- [...]

### Usage Notes

- [...]
- [...]

### Limitations To Disclose

- [...]

---

## 10. Director Closure Decision Notes

> Director-only closure notes. Runtime lock state is managed by Sigma CLI — not by this section.

Closure Decision:

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe.

- [ ] CLOSE_ACCEPTED
- [ ] CLOSE_ACCEPTED_WITH_LIMITATIONS
- [ ] DO_NOT_CLOSE
- [ ] OPEN_NEW_PLAN
- [ ] UPDATE_CURRENT_EXEC
- [ ] OTHER: [describe]

Reason:

[...]

Accepted Limitations:

- [...]

Required Follow-Up:

- [...]

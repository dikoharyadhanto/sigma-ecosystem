# Director's Intent & Decision Constraints

> **Project**: Sigma  
> **Document**: DIR-DI-000-SIGMA-v1.0  
> **Runtime Treatment**: Non-Delta project for execution purposes  
> **Relationship to Delta**: Delta-inspired sibling protocol/product, not governed by Delta Full runtime gates  
> **Purpose**: This document captures the Director's strategic vision and decision constraints for Sigma. It functions as the foundational intent layer for designing Sigma's lightweight execution protocol.

---

## 1. Project Identity

**Project Name**: Sigma

**Former Working Reference**: Delta-Lite

**Brief Description**:  
Sigma is a lightweight, Delta-inspired execution protocol designed to turn Director intent into a usable end-to-end project flow: **start → plan → build → close**. It inherits Delta's principles of intent clarity, traceability, evidence, and Director authority, but remains architecturally separate from Delta Full to avoid CLI complexity, command confusion, and governance overreach.

---

## 2. Strategic Vision

**Why are we doing this? What problem does it solve?**

Delta Full has strong governance, traceability, and audit discipline, but its full lifecycle is too heavy for small-to-medium projects, prototypes, fast execution cycles, and solo-builder workflows. Its CLI surface and document chain are optimized for serious, multi-phase, high-risk execution, not lightweight delivery.

Sigma exists to solve that gap.

The goal is to create a lighter execution protocol that preserves the core value of Delta—clear intent, structured planning, evidence-based completion, and Director-controlled decisions—while reducing ceremony, artifact count, role handoffs, and command complexity.

Sigma should not be a direct modification of Delta Full. Reworking Delta Full's CLI and runtime architecture to support a lightweight mode risks destabilizing the main architecture, increasing conditional logic, creating command confusion, and making both systems harder to maintain. Sigma should therefore be created as a separate sibling product/protocol, using Delta Full as a reference source but not binding itself to Delta Full's runtime rules.

---

## 3. What Success Looks Like

### Concrete Outcome

Sigma v1.0 provides a usable lightweight execution flow that allows a small-to-medium project to move from raw Director intent to completed closure evidence through a minimal lifecycle:

```text
start → plan → build → close
```

The system should support the following practical outputs:

- A strategy/planning artifact that captures Director intent, challengeable assumptions, technical direction, execution boundary, audit findings, and Director lock verdict.
- An execution artifact that combines work order/task plan, pre-build test contract, post-build test report, and implementation report.
- A closure artifact that determines whether the delivered work is sufficient to declare the project complete.
- A minimal CLI/runtime model that tracks lifecycle state without inheriting Delta Full's full command complexity.
- A lightweight memory/evidence model that preserves decision continuity and proof without requiring Delta Full's complete memory architecture.

### Success Threshold

Sigma v1.0 is considered successful when it can support at least one complete small-to-medium project flow from start to close using its own protocol and artifacts, without requiring Delta Full's DI → STRAT → WO → ANT-STR → IMPL/WALK → PDC lifecycle.

Minimum threshold:

- One end-to-end Sigma workflow is defined clearly enough to be implemented.
- Required artifact types are defined.
- Strategy, audit, execution, testing, implementation, and closure responsibilities are clear.
- Runtime state requirements are minimal but sufficient.
- Evidence requirements prevent false closure.
- Sigma is architecturally separate from Delta Full.

### Measurement Method

Success will be verified through:

- Review of Sigma protocol design documents.
- Walkthrough of a simulated small project using the Sigma flow.
- Validation that Sigma can operate without invoking Delta Full runtime gates.
- Director review of whether Sigma feels meaningfully lighter than Delta Full.
- Evidence that Sigma still preserves intent clarity, auditability, and closure proof.

---

## 4. Core Principles & Values

Sigma must be guided by the following principles:

1. **Lightweight execution over full governance ceremony**  
   Sigma should reduce artifact count, role handoffs, and command complexity while retaining enough structure to prevent chaotic execution.

2. **Intent remains sovereign**  
   The Director owns the destination. Audit may challenge the route, assumptions, technical choices, scope, risk, and evidence, but must not override the Director's core intent.

3. **Proof before closure**  
   A project cannot be considered complete merely because a document sounds complete. Closure must be supported by evidence.

4. **Separation from Delta Full**  
   Sigma should inherit principles from Delta but should not be implemented as a fragile extension of Delta Full's CLI/runtime architecture.

5. **Compressed structure, not unstructured execution**  
   Sigma is not a loose checklist. It is a compressed governance protocol where separation of concern happens inside fewer artifacts.

6. **Small-to-medium project fit**  
   Sigma should be optimized for projects where Delta Full is too heavy but raw AI execution is too risky.

7. **No fake confidence**  
   Sigma must distinguish between planned work, completed work, tested work, and accepted closure.

---

## 5. Strategic Trade-Offs (MANDATORY)

**We explicitly choose these priorities:**

### Primary Trade-Off

We prioritize **architectural separation and product clarity** over **direct reuse of the Delta Full CLI/runtime architecture**.

### Secondary Trade-Offs

- We are willing to sacrifice **maximum reuse of Delta Full infrastructure** to gain **a cleaner lightweight execution architecture**.
- We are willing to sacrifice **full Delta-style governance depth** to gain **speed, lower ceremony, and better fit for small-to-medium projects**.
- We are willing to sacrifice **one unified Delta command surface** to gain **reduced command confusion and clearer product identity**.
- We are willing to sacrifice **some formal audit granularity** to gain **a simpler artifact model where governance is separated by section instead of by document**.
- We are willing to sacrifice **early feature completeness** to gain **a usable end-to-end Sigma v1.0 flow**.

**Why these trade-offs matter:**

These trade-offs prevent Sigma from becoming either a broken extension of Delta Full or a vague lightweight checklist. Sigma must preserve the essential discipline of Delta—intent, audit, evidence, closure—while refusing to inherit the full governance cost of Delta Full.

The architectural separation also reduces risk to Delta Full. Delta Full can remain a serious, high-rigor governance system, while Sigma can evolve as a lightweight sibling protocol with its own lifecycle, terminology, command model, and artifact structure.

---

## 6. Risk Appetite (CRITICAL)

**How much risk is acceptable for this project?**

### Fatal Risk Tolerance

How many unmitigated fatal risks can we accept?

- [x] Zero (cannot launch if any fatal risk unmitigated)
- [ ] Conditional (acceptable if mitigation/workaround documented)

Fatal risks include:

- Sigma becomes indistinguishable from Delta Full in complexity.
- Sigma corrupts or destabilizes Delta Full architecture.
- Sigma creates command confusion with existing `delta` commands.
- Sigma allows project closure without evidence.
- Sigma removes Director authority or lets auditors override intent.

### Degrading Risk Tolerance

What level of degraded capability is acceptable at launch?

- [ ] Low (must work fully; zero degradation)
- [x] Medium (acceptable UX friction; reduced features OK)
- [ ] High (significant degradation acceptable for speed)

Sigma v1.0 may launch with limited automation if the protocol, artifact lifecycle, and end-to-end flow are clear. However, it must not compromise the core flow: start → plan → build → close.

### Uncertainty Tolerance

How much "unknown" can we live with?

- [ ] Low (require high confidence in all critical paths)
- [x] Medium (accept some unknowns; mitigate aggressively)
- [ ] High (comfortable proceeding with significant unknowns)

Uncertainty is acceptable around final branding, exact CLI syntax, and implementation details. Uncertainty is not acceptable around product positioning, lifecycle structure, Director authority, or evidence-based closure.

---

## 7. Primary Failure Concern (CRITICAL)

**What is the worst realistic outcome we want to avoid?**

### The Failure

Sigma becomes either:

1. A near-clone of Delta Full with fewer names but similar ceremony, making it fail as a lightweight system; or
2. An overly loose checklist that loses Delta's discipline, making it fast but unreliable.

A secondary failure is that Sigma remains too closely tied to Delta naming and command conventions, causing users or agents to confuse Sigma operations with Delta Full operations.

### Why This Matters

If Sigma becomes too heavy, it does not solve the original problem: Delta Full is already available for high-governance execution. If Sigma becomes too loose, it loses the reason for existing: structured intent-to-proof execution.

If Sigma is architecturally mixed into Delta Full too early, it may increase maintenance burden, introduce lifecycle exceptions, and weaken the clarity of Delta Full's governance model.

### How We'll Guard Against It

- Keep Sigma architecturally separate from Delta Full.
- Use new terminology where necessary instead of forcing Delta naming.
- Limit Sigma v1.0 to the core end-to-end flow.
- Use fewer artifacts, but maintain strong section-level boundaries.
- Require pre-build test contract before implementation.
- Require closure evidence before completion.
- Preserve Director final authority.
- Add promotion logic: if a project exceeds Sigma's lightweight scope, it should move to Delta Full or a more rigorous process.

---

## 8. Scope Definition

### What IS In Scope

Sigma v1.0 must define and support:

- Sigma product identity and philosophy.
- Relationship to Delta as sibling/inspired protocol, not Delta Full subproject.
- End-to-end workflow: start → plan → build → close.
- Strategy layer design using a compressed strategy/planning artifact.
- Audit model based on sublayer authority:
  - Intent Core: sovereign / clarity-only.
  - Director constraints and preferences: challengeable.
  - Strategic translation, technical direction, execution boundary, evidence requirements: fully auditable.
- Role sequence:
  - Director raw intent → GMN/Sigma planner synthesis → GPT/Auditor review → Director lock.
- Execution layer design using one living execution artifact.
- Execution artifact sections:
  1. Work Order / Task Plan.
  2. Pre-Build Test Contract + Post-Build Test Report.
  3. Implementation Report.
- Build process:
  - Create execution document.
  - Fill task plan and pre-build test contract.
  - Director checks/audits and approves build.
  - Build.
  - Test.
  - Complete implementation report and test results.
- Minimal runtime state model.
- Lightweight memory/evidence model.
- Closure layer concept with evidence-based completion.
- Promotion boundary: when Sigma is insufficient and a heavier process is required.

### What IS NOT In Scope

Sigma v1.0 will not attempt to:

- Modify Delta Full CLI architecture directly.
- Merge Sigma into Delta Full runtime gates.
- Reuse all Delta Full document domains.
- Replicate DI → STRAT → WO → ANT-STR → IMPL/WALK → PDC as separate artifacts.
- Implement full NLM knowledge modules by default.
- Implement full skill-routing triple-gate by default.
- Implement full Memory MCP graph by default.
- Support high-risk, regulated, enterprise, or long multi-phase projects as the default use case.
- Resolve final public branding beyond the working name Sigma unless Director explicitly decides it.

### Why This Boundary Matters

If Sigma exceeds this scope, it will likely become a second Delta Full instead of a lightweight execution protocol. That would duplicate complexity, increase maintenance cost, and fail to solve the ceremony problem.

The boundary protects Sigma's purpose: compress governance into action without losing proof.

---

## 9. Timeline & Constraints

**Target completion date or phase**:  
TBD by Director.

**Key milestones**:

1. Complete Sigma DI.
2. Draft Sigma protocol architecture.
3. Define Sigma artifact templates:
   - Sigma Plan / Strategy artifact.
   - Sigma Execution artifact.
   - Sigma Close artifact.
4. Define audit doctrine and sublayer authority labels.
5. Define minimal runtime state model.
6. Define lightweight memory/evidence model.
7. Validate with a simulated project flow.
8. Decide whether to implement CLI prototype.

**Resource constraints**:

- Primary resource: Director + AI-assisted design.
- Existing Delta Full resources may be used as reference material.
- Sigma should avoid requiring deep rewrites of Delta Full architecture.
- Implementation capacity, target platform, and CLI language are TBD.

**Non-negotiable hard constraints**:

- Sigma must not destabilize Delta Full.
- Sigma must not share a confusing command surface with Delta Full.
- Sigma must preserve Director authority.
- Sigma must require evidence before closure.
- Sigma must not allow auditors to override sovereign Director intent.
- Sigma must remain meaningfully lighter than Delta Full.

---

## 10. Explicit Non-Goals (Optional but Powerful)

**We will NOT do the following, even if suggested:**

- We will NOT build Sigma as a direct mutation of the Delta Full CLI unless a later architecture review proves it safe.
- We will NOT preserve Delta terminology where it creates user confusion.
- We will NOT replicate all Delta Full artifact domains.
- We will NOT require full formal handoff between GMN, ANT, CDC, GPT, PPX, and NLM in the default Sigma flow.
- We will NOT treat Sigma as suitable for every project size.
- We will NOT allow closure based only on AI-written narrative without evidence.
- We will NOT let audit challenge the Director's destination; audit challenges the route.
- We will NOT optimize for enterprise governance before Sigma proves its lightweight flow.

---

## 11. Decision Authority

**Who makes final decisions in case of conflict?**

- Strategic conflicts → Director: Diko Hary Adhanto
- Product identity / naming conflicts → Director: Diko Hary Adhanto
- Technical architecture conflicts → Director, informed by GMN/Sigma planner and auditor recommendations
- Risk acceptance → Director
- Whether to remain Sigma or promote to a heavier process → Director

Supporting roles:

- GMN / Sigma Planner: synthesizes Director intent, separates sovereign intent from challengeable assumptions, drafts strategy and execution structure.
- GPT / Auditor: critiques challengeable layers, technical choices, feasibility, scope, evidence, and promotion risk.
- Builder role: executes based on approved Sigma execution artifact.

Auditor verdicts are advisory. Director verdict is authoritative.

---

## 12. Minimal Approval Gate Requirement

> **Applies to**: STRAT only — when this project uses a STRAT path.  
> Sigma is being treated as a non-Delta project and does not use Delta Full's GMN-STRAT path by default.

**Status**: Not Applicable to Delta Full STRAT.

Sigma replaces the Delta STRAT gate with a Sigma strategy/planning baseline gate.

Before Sigma's strategy/planning artifact is accepted as the execution baseline, it must satisfy the following minimum requirements:

- [ ] Intent Core is explicitly captured and separated from assumptions, preferences, and proposed means.
- [ ] Director constraints and preferences are marked as challengeable where appropriate.
- [ ] Scope boundary is explicit: in-scope and out-of-scope items are defined.
- [ ] Technical direction is stated and open to audit.
- [ ] Execution boundary is clear enough to produce a task plan.
- [ ] Evidence requirement is specified before build begins.
- [ ] Audit findings are recorded for challengeable layers.
- [ ] Director approval/lock verdict is recorded.
- [ ] Promotion check is completed: STAY_SIGMA / PROMOTE_TO_HEAVIER_PROCESS.

**Advisory review note**: GPT or other advisory reviewers may critique Sigma's strategy/planning artifact. Their outputs are evidence for Director judgment only and do not satisfy the approval gate by themselves. Only Director approval establishes the execution baseline.

---

# Quick Reference: Document Metadata & Rules

## Naming Convention

**Current Draft Filename:** `DIR-DI-000-SIGMA-v1.0.md`

This project is intentionally treated as a non-Delta project for execution purposes. The file name preserves the DI convention for clarity during design, but Sigma is not bound to Delta Full runtime lifecycle unless the Director later decides otherwise.

## Document Specifics

- **Purpose**: Strategic Intent & Decision Constraint Layer for Sigma.
- **Created by**: Director, assisted by GPT.
- **Input**: Director's strategic thinking, risk tolerance, and decision boundaries.
- **Output**: Control layer for Sigma protocol design.
- **Approval**: Director review and explicit acceptance.
- **Critical to**: Preventing Sigma from becoming either a Delta Full clone or an ungoverned lightweight checklist.
- **Impact on downstream**: Sigma protocol, artifact templates, runtime state model, audit doctrine, CLI design, and memory/evidence model should align with this DI.

---

## Director Review Notes

Pending Director review.

Recommended review questions:

1. Is Sigma's product identity accurate?
2. Is architectural separation from Delta Full correctly stated?
3. Is the v1.0 success target sufficiently concrete?
4. Are the trade-offs acceptable?
5. Are the non-goals strict enough?
6. Is the scope too broad for v1.0?
7. Should the initial output be protocol-only, or protocol + templates + minimal CLI prototype?


# Sigma ROADMAP Fix Implementation

**Date**: 2026-06-02  
**Status**: Draft for review  
**Purpose**: Analyze current Sigma ROADMAP system and define the changes needed so ROADMAP keeps detailed stage tracking while also preserving a manual, stable core-process view.

---

## Executive Summary

The current Sigma ROADMAP system is optimized for:

- stage-by-stage execution planning;
- CLI-managed stage creation;
- auto-generated summary sections from registered `FMN-PLAN` versions.

That works reasonably well for tracking delivery stages.

However, it does **not** serve the separate need the Director is now highlighting:

```text
ROADMAP should also preserve the main system/product process at a high level.
```

Today, Sigma tries to fill that gap with an auto-generated Mermaid dependency diagram in `ROADMAP Section 4`.

After reviewing the current implementation and a real project example in `CanopySense`, the conclusion is:

```text
The auto-generated Mermaid stage chain is low-value.
It duplicates information already present in Stage Overview and PLAN Breakdown.
It does not express the core process of the product/system.
```

So the roadmap system should be adjusted.

The intended future behavior should be:

- `Stage Overview` remains auto-generated;
- `PLAN Breakdown` remains auto-generated;
- stage H2 sections remain CLI-managed;
- the current auto-generated Mermaid dependency section is removed;
- a new manual section is introduced for the high-level core process flow;
- that manual section must never be overwritten by `sigma roadmap render`.

---

## Current System Analysis

### 1. ROADMAP is currently split into two different conceptual layers

From the current template and renderer, ROADMAP mixes:

- **execution staging**
  - stage list
  - stage-to-plan mapping
  - per-stage working notes
- **process visualization**
  - auto-generated Mermaid dependency section

The problem is that the current visualization layer is not actually a process model.

It is only a generated representation of stage sequence:

```text
Stage 1.1 -> Stage 1.2 -> Stage 1.3 -> ...
```

That is execution order, not system behavior.

### 2. The current Mermaid section is generated from stage headings only

In [src/utils/roadmap.ts](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/src/utils/roadmap.ts:1):

- `parseStages()` extracts `## Stage X.Y — Title`
- `generatePhaseDependencies()` creates a Mermaid flowchart from those parsed stage numbers
- `renderRoadmapFile()` rewrites the `phase-dependencies` derived block every time roadmap render runs

This means:

- the diagram is not authored by FMN;
- the diagram is not semantically rich;
- the diagram cannot express branching, role boundaries, data movement, or product behavior;
- the diagram is guaranteed to collapse into a mostly linear pipeline unless stage metadata becomes much more complex.

### 3. The CanopySense example confirms the limitation

In `CanopySense/Sigma/build/ROADMAP-v2.md`, the current `Phase Dependencies` section is a long generated list of nodes:

```text
S_1_1 --> S_1_2 --> S_1_3 --> ... --> S_1_24
```

This adds very little value because:

- the same sequence is already obvious from `Stage Overview`;
- the roadmap already records status per stage;
- the diagram does not help a reader understand the actual CanopySense product or data flow;
- it consumes attention while not clarifying the "main process" of the system.

The Director's concern is therefore correct.

### 4. Current `ROADMAP` doctrine and tooling explicitly treat the Mermaid section as derived

The current system has this assumption in multiple places:

- [Sigma/templates/ROADMAP-TEMPLATE.md](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/Sigma/templates/ROADMAP-TEMPLATE.md:1)
- [src/utils/roadmap.ts](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/src/utils/roadmap.ts:1)
- [src/commands/roadmap.ts](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/src/commands/roadmap.ts:1)
- [src/commands/sync.ts](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/src/commands/sync.ts:1)
- [Sigma/SIGMA_PROTOCOL.md](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/Sigma/SIGMA_PROTOCOL.md:1)
- [Sigma/rules/FMN-RULE.md](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/Sigma/rules/FMN-RULE.md:1)
- [Sigma/SIGMA-OPERATION-REGISTRY.json](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/Sigma/SIGMA-OPERATION-REGISTRY.json:1511)

So this is not just a template tweak.

It is a system-level roadmap contract change.

---

## Target Design Direction

The future ROADMAP should separate two concerns more clearly:

### A. Execution tracking layer

Still CLI-managed:

- `Stage Overview`
- stage H2 sections
- `PLAN Breakdown`

These sections answer:

```text
What are the big build stages?
Which plan maps to which stage?
What is active / locked / superseded?
```

### B. Core process layer

Manual, authored by FMN:

- high-level process flow of the product/system
- major operational path
- main user/system/data sequence

This section answers:

```text
How does the system basically work?
What is the main product/process flow?
What are the important high-level transitions?
```

This is the missing value today.

---

## Recommended ROADMAP Structure

Recommended structure:

1. `Roadmap Purpose`
2. `Source Intent Alignment`
3. `Stage Overview` — auto-generated
4. `Core Process Flow` — manual, not auto-generated
5. `Stage Details`
6. `PLAN Breakdown` — auto-generated
7. `FMN Roadmap Notes`

Important point:

```text
Section 4 should become manual and stable.
It should not be touched by sigma roadmap render.
```

### Why `Core Process Flow` is a better section name

`Phase Dependencies` suggests a dependency graph between work items.

But the Director's intent is different:

- not stage dependency mapping;
- not render-generated ordering;
- but a simplified system/process view.

So the section should be renamed from something like:

```text
Phase Dependencies
```

to something like:

```text
Core Process Flow
```

or:

```text
Main Product / System Flow
```

My recommendation is:

```text
Core Process Flow
```

because it is short, generic, and works for both product and internal system projects.

---

## Required Code and System Changes

## 1. ROADMAP template must change

File:

- [Sigma/templates/ROADMAP-TEMPLATE.md](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/Sigma/templates/ROADMAP-TEMPLATE.md:1)

Required change:

- remove the render-managed `Phase Dependencies` block;
- replace it with a manual section;
- keep the section marker, but rename its meaning.

Recommended target:

```md
<!-- SIGMA:ROADMAP:SECTION:CORE_PROCESS_FLOW -->
## 4. Core Process Flow

> Manual section. FMN writes the high-level product/system flow here.
> This section is not regenerated by `sigma roadmap render`.

[Optional manual Mermaid or plain-text process outline]
```

This section should allow:

- manual Mermaid;
- simple numbered process steps;
- mixed text + diagram;
- future richer explanation without fighting the renderer.

## 2. ROADMAP validator must be updated

File:

- [src/utils/docCheck.ts](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/src/utils/docCheck.ts:1)

Current roadmap required sections include:

```text
PHASE_DEPENDENCIES
```

That should be replaced with:

```text
CORE_PROCESS_FLOW
```

Reason:

- section identity is part of the structural contract;
- if the section is renamed in template but not in validator, ROADMAP check/lock behavior will break.

## 3. ROADMAP renderer must stop generating the Mermaid section

File:

- [src/utils/roadmap.ts](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/src/utils/roadmap.ts:1)

Current behavior:

- `generatePhaseDependencies()` builds Mermaid from stages
- `renderRoadmapFile()` replaces the `phase-dependencies` section

Required change:

- remove `generatePhaseDependencies()` from the render pipeline;
- stop calling `replaceSection(..., 'phase-dependencies', ...)`;
- keep render limited to the truly derived sections only.

Target render behavior:

- render `stage-overview`
- render `plan-breakdown`
- do not touch `Core Process Flow`

This is the most important functional change.

## 4. `sigma roadmap render` command description must change

File:

- [src/commands/roadmap.ts](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/src/commands/roadmap.ts:1)

Current wording says:

```text
Regenerate derived sections (Stage Overview, Phase Dependencies, PLAN Breakdown)
```

That should become:

```text
Regenerate derived sections (Stage Overview, PLAN Breakdown)
```

This is important because the CLI description is part of the user contract.

## 5. `sync` migration logic must change

File:

- [src/commands/sync.ts](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/src/commands/sync.ts:1)

This file still writes legacy/migration ROADMAP content that includes:

- `Phase Dependencies`
- render delimiters for `phase-dependencies`
- guidance text saying Mermaid is regenerated

Required change:

- remove legacy generation of the derived Mermaid block;
- insert the new manual `Core Process Flow` section instead;
- update all printed migration guidance accordingly.

If this is not updated, migrated ROADMAP documents will keep reintroducing the old structure.

## 6. ROADMAP documentation and role rule text must change

Files:

- [Sigma/SIGMA_PROTOCOL.md](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/Sigma/SIGMA_PROTOCOL.md:1)
- [Sigma/rules/FMN-RULE.md](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/Sigma/rules/FMN-RULE.md:1)
- [Sigma/SIGMA-OPERATION-REGISTRY.json](/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/Sigma/SIGMA-OPERATION-REGISTRY.json:1511)

Required documentation updates:

- derived sections should no longer mention Mermaid or `Phase Dependencies`;
- ROADMAP doctrine should explicitly say that `Core Process Flow` is manual;
- FMN rule should explicitly tell FMN that this section captures the main product/system process in simplified form;
- registry description for `roadmap render` should be updated.

Without this, runtime behavior and governance doctrine will drift.

## 7. ROADMAP policy text inside template must change

Current policy text says:

```text
Derived sections (Stage Overview, Phase Dependencies, PLAN Breakdown) are regenerated by sigma roadmap render.
```

That must become:

```text
Derived sections (Stage Overview, PLAN Breakdown) are regenerated by sigma roadmap render.
Core Process Flow is manual and must not be overwritten by render.
```

This matters because the document itself is the user's first source of truth.

---

## What Should Not Change

To preserve the useful parts of the current roadmap system, these behaviors should remain:

### 1. Stage H2 sections remain CLI-managed

Keep:

- `sigma plan new` appends stage stubs
- `sigma plan promote` appends/promotes stage-linked plan entries
- `sigma roadmap reconcile --fix` can append missing stage stubs

This is still useful and separate from the process-flow concern.

### 2. `Stage Overview` remains derived

Keep it generated from:

- ROADMAP stage headings
- plan state
- plan title/focus
- supersede reason

This section still provides high-value operational visibility.

### 3. `PLAN Breakdown` remains derived

This is still useful because it gives a compact mapping:

```text
FMN-PLAN version -> Stage -> Status
```

### 4. `parseStages()` can mostly stay as-is

`parseStages()` already reads:

- stage version
- stage title
- stage focus comment

This parser is still valid for the execution-tracking layer.

The roadmap fix does not require rethinking stage parsing unless later the system wants richer stage metadata.

---

## Implementation Risks

## 1. Section renumbering side effects

If the new section remains at position 4 and `Stage Details` stays at 5, numbering impact is minimal.

That is the safest path.

Recommended:

- keep section numbering stable;
- only rename section meaning, not move all following sections.

## 2. Validator/template drift

If template is changed before `docCheck` is updated, `sigma roadmap check` will fail.

So these changes must land together:

- template section marker;
- doc checker required section list;
- any generated content references.

## 3. Legacy migration drift

If `sync.ts` is not updated, migrated roadmaps may still generate obsolete sections.

That would create two competing roadmap shapes in the same ecosystem.

## 4. User confusion if policy text is stale

If CLI stops generating Mermaid but policy/rules still say it does, FMN behavior will become inconsistent.

This is a doctrine/runtime mismatch risk, not just a wording issue.

---

## Recommended Rollout Plan

### Stage 1 — Structural change

- update ROADMAP template
- update section marker from `PHASE_DEPENDENCIES` to `CORE_PROCESS_FLOW`
- update doc checker

### Stage 2 — Renderer change

- remove Mermaid generation from `renderRoadmapFile()`
- update `roadmap render` command wording

### Stage 3 — Migration and doctrine cleanup

- update `sync.ts`
- update template policy text
- update `SIGMA_PROTOCOL`
- update `FMN-RULE`
- update operation registry descriptions

### Stage 4 — Optional compatibility support

Optional only if needed:

- allow roadmap validator to accept old `PHASE_DEPENDENCIES` marker temporarily with warning
- or provide a migration command/path for old ROADMAP documents

This depends on how much backward compatibility the Director wants.

---

## Final Recommendation

The roadmap system should be changed in exactly this direction:

```text
Remove auto-generated Mermaid stage dependency flow.
Replace it with a manual Core Process Flow section.
Keep Stage Overview and PLAN Breakdown derived.
Keep stage sections CLI-managed.
```

This preserves the useful operational parts of Sigma ROADMAP while restoring the missing strategic value:

```text
What is the main process of the system, in simple terms?
```

That question is not answered well by the current auto-generated Mermaid.

It should be answered manually by FMN in the roadmap.

---

## Suggested Next Step

If approved, the next implementation pass should modify:

- `Sigma/templates/ROADMAP-TEMPLATE.md`
- `src/utils/docCheck.ts`
- `src/utils/roadmap.ts`
- `src/commands/roadmap.ts`
- `src/commands/sync.ts`
- supporting doctrine files

in one coordinated change set, so template, renderer, validation, and documentation stay aligned.

# PLAN-17 — DIR-INTENT: Comprehensive Research Section

**Source**: Director discussion, 2026-07-03 (Professional Mode)
**Date**: 2026-07-03
**Status**: DRAFT FOR REVIEW
**Note**: This is a plain implementation plan authored in Professional Mode. It is not a Sigma FMN-PLAN and carries no Sigma lock/gate authority.

---

## Objective

Add an optional **Comprehensive Research** section to the `DIR-INTENT` template so ARC can flag, and Sigma can track, when a project's intent depends on theory, methodology, or real-world data that isn't yet well understood — without introducing a new artifact type, new role, or new lock gate.

```text
Most intents don't need this.
When they do, the gap should be visible and enforced, not left to memory.
No new ceremony beyond one section and one checklist line.
```

---

## Problem Statement

`DIR-INTENT` currently assumes the Director/ARC already knows enough about the domain to state Objective, Scope, Technical Direction, and Solution Assumptions. That's true for most Sigma projects, but not all of them.

Some projects need actual investigation — of a concept, a methodology, prior art, or real-world problem data — before intent can be responsibly bounded. `Implementation/sigma_mcp_roadmap_dev.md` is a live example: it's a research/direction document that was never brought into the DIR-INTENT lifecycle. That pattern repeats across `Discussion/*.md` today:

- no schema, no section markers, no lock state;
- not linked to any `ASM-ID` or `REQ-ID` it's supposed to resolve;
- nothing forces the research to have actually happened — a rushed placeholder looks the same as real investigation;
- easy to lose track of when it was superseded or whether it's still current.

Section 7.3 (`Solution Assumptions`) already has a `Confidence` column (Low/Medium/High) that implicitly flags this exact gap, but there's no structured place to resolve a low-confidence assumption and no enforcement that it gets resolved before `sigma intent lock`.

---

## Design Principles

| Principle | Constraint for this plan |
| --- | --- |
| Optional by default | `Comprehensive Research` status defaults to `NOT_NEEDED`. Most intents skip it entirely with a one-line status. |
| No new artifact, role, or lock gate | Lives inside `DIR-INTENT` itself — same document, same review, same lock as everything else. |
| Status drives enforcement | If `NEEDED`, the four subsections must be filled or explicitly marked N/A before lock-readiness, mirroring how Quality Bar dimensions must be stated or marked not applicable. |
| Tool-based investigation when NEEDED | ARC must actually use available research tools (WebSearch/WebFetch/reading real sources) when status is `NEEDED` — not recall-fill the section from memory. This is a behavioral rule in `ARC-RULE.md`, not just a template field, because a field with no enforced behavior becomes decoration. |
| Research and verification are different jobs, same as AUD already models | `AUD-RULE.md` already splits AUD into Critic Mode / Verificator Mode / Hybrid Mode — distinct gears within one role instead of new roles. ARC gets the same treatment: a bounded **Research Mode** for proactive, open-ended investigation *before* Intent Core is drafted, separate from ARC's normal interview-and-draft work. AUD is not given this job — Verificator Mode is explicitly scope-guarded to verifying claims already present in a Director-authorized artifact (`AUD-RULE.md` §2, "Scope Guard"), which is reactive fact-checking, not open discovery, and it runs structurally *after* ARC drafts — too late to inform Intent Core. |
| Reuse AUD's research discipline, don't reinvent it | ARC Research Mode follows the same source-verification discipline already defined in `AUD-RULE.md` §2 (Citation Rule: official docs → changelogs → reputable sources, unverifiable claims marked as such) instead of defining a parallel standard. |
| AUD verifies ARC's research afterward | Once Comprehensive Research is drafted, it becomes ordinary claim content inside `DIR-INTENT` — AUD's existing Verificator Mode can check it the same way it checks any other claim, with no rule change needed beyond making it a named trigger category. This gives ARC's research a real second check without AUD doing the legwork itself. |
| Traceability over free-floating prose | Research entries should reference the `ASM-ID` / `REQ-ID` they resolve wherever applicable, instead of being disconnected narrative. |
| Placement informs downstream sections | Section sits early — right after Intent Core, before Success Definition — because research should shape scope, success criteria, and technical direction, not be filed after the fact as an appendix. |
| Sources live outside the document, not inside it | `DIR-INTENT` holds research prose/findings only. The raw source list (links, journal references, data references) and any downloaded data live in a companion **`reference-list.md`**, so the intent document stays readable and source-list upkeep never touches a locked artifact. |
| One shared reference list, not one per intent version | `reference-list.md` is project-wide, not per-`DIR-INTENT`-version. A project's v1.0, v1.1, and v2.0 intents accumulate into the same file — research doesn't need to be re-gathered or fragmented every time intent is revised. |
| Scaffolding is automatic and role-independent | `reference-list.md` is created once, by `sigma project start` — the same moment every other Sigma subfolder is scaffolded — not by ARC and not per intent. This removes "remembering to create it" from every role entirely. |
| Local artifacts are synced by a command, not typed by hand | `sigma reference update` scans the local data folder and writes rows for files found there. Website/online-source entries stay manual — ARC or any AI role types those rows directly, because there's nothing to scan for a URL that was never downloaded. |

---

## Scope

### In scope

- New `DIR-INTENT` template section: **Comprehensive Research**, inserted as new Section 2 (existing Sections 2–12 renumber to 3–13).
- New section marker `<!-- SIGMA:DIR_INTENT:SECTION:COMPREHENSIVE_RESEARCH -->`, following the existing marker convention.
- Bump template document marker to `schema=3` (same mechanism used for the recent Quality Bar addition, which bumped `schema=1` → `schema=2`).
- Section fields:
  - **Status**: `NEEDED` / `NOT_NEEDED` (binary — keep it simple).
  - If `NEEDED`, four subsections:
    1. **Theory and Concept** — the conceptual/theoretical grounding needed before intent can be trusted.
    2. **Issue, Problem, and Real-World Data** — real-world evidence of the problem (incidents, user reports, measured pain), not assumed pain.
    3. **Methodology** — how the investigation was conducted and how conclusions will be validated.
    4. **Source / Data** — pointer to the project-wide `reference-list.md`, not inline citations.
  - Each subsection entry may reference an `ASM-ID` (Section 7.3, renumbered 8.3) or `REQ-ID` (Section 8, renumbered 9) it resolves.
- New project-wide companion artifact **`Sigma/reference/reference-list.md`**, created once by `sigma project start`. See "Reference List & Local Artifact Folder" below.
- New template `Sigma/templates/REFERENCE-LIST-TEMPLATE.md`, following the same convention as `CSO-TEMPLATE.md` / `MSG-TEMPLATE.md`.
- New CLI command **`sigma reference update`** (`src/commands/reference.ts`) that scans `Sigma/reference/data/` and syncs the reference list's Local Artifact table.
- `src/config.ts` change: add `'reference'` to the `SUBFOLDERS` array.
- `src/commands/project.ts` (`runStart`) change: after the existing `SUBFOLDERS` loop, scaffold `Sigma/reference/reference-list.md` via `copyTemplateToArtifact('REFERENCE-LIST-TEMPLATE.md', ...)` — same pattern already used for governance docs in that function.
- Defensive create-if-missing: `sigma reference update` also ensures `reference-list.md` exists before syncing, so pre-existing projects (initialized before this feature shipped) self-heal on first use instead of requiring `project start --reinit`.
- Add `COMPREHENSIVE_RESEARCH` to the `requiredSections` array for the `intent` domain in `src/utils/docCheck.ts` (currently lines 43–56), so the marker/heading structure is validated the same way `QUALITY_BAR` and other sections already are. Structural presence is required (so every new intent has a status line); subsection depth is conditional on status.
- New line in the Final Validation Checklist (Section 12, renumbered 13): "If Comprehensive Research status = NEEDED, all four subsections are filled or explicitly marked N/A, and `reference-list.md` has real entries for this intent's research — not just leftover entries from earlier work."
- `ARC-RULE.md` addition: a new **Research Mode** section, structured the same way `AUD-RULE.md` already structures Critic Mode / Verificator Mode / Hybrid Mode (Purpose, Activation Triggers, Scope Guard, Source Priority, Must / Must Not). See "Proposed ARC-RULE.md Addition" below. Place it near the existing assumption-handling guidance (`ARC-RULE.md` lines ~30, ~60, ~126 area).
- `AUD-RULE.md` addition: one line in Verificator Mode's existing Activation Triggers list (`AUD-RULE.md` ~lines 288–298) naming "DIR-INTENT Comprehensive Research claims" as a trigger category, so AUD's already-existing fact-checking behavior explicitly covers ARC's research output. No change to AUD's Scope Guard, passivity, or Source Priority — this only names a category AUD already implicitly covers ("technical claims", "factual uncertainty that may affect project decisions").
- Update `test/doc-check.test.ts` fixtures/assertions for the new required section and renumbered schema.
- Regenerate any golden/fixture DIR-INTENT files used by existing tests so they include the new section (status `NOT_NEEDED` is enough for fixtures that don't test this feature specifically).

### Out of scope

- New role, new artifact type, or a new lock gate specifically for research (e.g. no `RSCH-NOTE` document, no research-lock command).
- CLI-level enforcement that goes beyond structural marker validation and reference-list scaffolding (e.g. Sigma does not attempt to verify that ARC "actually" did web research, does not parse `reference-list.md` content or row completeness beyond the Local Artifact sync, and does not validate individual source URLs — those stay behavioral rules enforced by ARC discipline and AUD's Verificator Mode, not machine checks). There is deliberately no runtime "does reference-list.md exist" lock gate — existence is guaranteed by construction at `project start`, with a self-healing fallback in `reference update`.
- Mirroring this section into `FMN-PLAN` or `DEV-EXEC` templates. Research lives at intent time; downstream artifacts reference `reference-list.md` instead of duplicating it.
- Retroactively adding the Comprehensive Research *template section* to already-locked or in-flight `DIR-INTENT` documents. New intents only, from schema=3 onward. (`reference-list.md` itself is retrofittable via the self-healing fallback above, since it's project-wide, not tied to a specific intent version.)
- Making `NEEDED` the default or mandatory for all projects.
- `sigma reference update` auto-classifying the `Category` or writing `Notes` for local artifacts — it only fills `Link or Local Path`. Category and Notes are always a manual/AI-role judgment call, same as Website Link and Online Source Data rows.
- Changing `progress.json` schema or any engine function. This is a template + rule + docCheck + new-command change only.

---

## Source Policy (per subsection)

Each Comprehensive Research subsection carries a different evidence standard, because each is answering a different kind of question. This policy is more specific than — and takes precedence over, for this section only — the generic Source Priority list in `AUD-RULE.md` §2. It does not change `AUD-RULE.md` itself.

| Subsection | Allowed sources | Explicitly forbidden / out of tier |
| --- | --- | --- |
| 2.2 Theory and Concept | Peer-reviewed international research journals and academic/scholarly books only. | General websites, forums, Wikipedia, and similar tertiary/crowd-sourced sources. No exceptions — this subsection is theoretical grounding and needs the highest evidence tier. |
| 2.3 Issue, Problem, and Real-World Data | Open — any source is permitted. Preferred, in no strict order: research journals, forums, news reporting, official reports, or official documentation from the relevant official website. | Nothing forbidden outright; the preference list is guidance, not a hard gate. |
| 2.4 Methodology | Official documentation from the official/authoritative website (preferred), or a reputable technical Q&A community (e.g. Stack Overflow, GIS Stack Exchange). | Sources outside those two tiers — general blogs, marketing pages, unverified tutorials, Wikipedia. |
| 2.5 Source / Data | Open — any source is permitted. Preferred: official data-reporting or data-extraction sources (e.g. Kaggle, BPS, OpenStreetMap, or the domain-equivalent official registry). | Nothing forbidden outright; official/authoritative data provenance is preferred, not mandatory. |

This table is reproduced both inline in the template (as a short per-subsection hint) and in full in `ARC-RULE.md` Research Mode (the authoritative version ARC actually follows). It governs *which sources qualify* — it says nothing about how a `reference-list.md` row is formatted, which stays deliberately informal (see below).

**Enforcement stays behavioral, not automated.** `docCheck.ts` does not attempt to parse source URLs and check them against a domain allow/deny list (e.g. regex-blocking `wikipedia.org`). That's unreliable and easy to defeat. The tiering is enforced by `ARC-RULE.md` Research Mode discipline and by AUD's Verificator Mode catching a miscited source after the fact — the same two-layer model already established for the rest of this plan.

---

## Reference List & Local Artifact Folder

Sources do not live inside `DIR-INTENT`, and the file that holds them is not any role's responsibility to create — it's scaffolded once, automatically, when the Sigma project itself is initialized.

### Naming clarification

`reference-list.md` is a plain **source/access index**, not a formal bibliography. It doesn't require citation-style formatting (APA/MLA/etc.) or academic rigor in how entries are written. The only thing that matters is that any Sigma role, later, can read an entry and go directly to that link or local file — a path or URL and a short description is enough. The Source Policy above (what's an *acceptable source*) is independent of, and stricter than, the *formatting* of the entry itself, which stays informal on purpose.

### Location

Following the existing top-level artifact convention under `Sigma/` (`Sigma/design/`, `Sigma/build/`, `Sigma/close/`, `Sigma/pending/`, `Sigma/templates/` — verified against `src/config.ts` `SUBFOLDERS` and `src/commands/project.ts`), `Sigma/reference/` becomes a new top-level sibling folder:

```text
Sigma/reference/reference-list.md
Sigma/reference/data/                    (local artifacts — only populated if something was downloaded)
```

One shared file and one shared data folder for the whole project — **not** versioned per `DIR-INTENT`. A superseded intent version doesn't need its research re-gathered; it's already in the same list, still valid unless something specifically contradicts it.

### Automatic creation — at `sigma project start`, not `sigma intent new`

Creating this per intent version would be wrong once it's a shared, cumulative file — a project only starts once, but intent gets drafted and revised repeatedly. So it's scaffolded where every other Sigma subfolder is scaffolded: `runStart()` in `src/commands/project.ts`.

Today, `runStart` already does this for every subfolder:

```typescript
// src/config.ts
export const SUBFOLDERS = ['design', 'build', 'close', 'rules', 'logs', 'memory', 'role-memory'];

// src/commands/project.ts, inside runStart()
for (const sub of SUBFOLDERS) {
  ensureDir(path.join(sigmaDir, sub));
}
```

This plan adds `'reference'` to `SUBFOLDERS`, and adds one `copyTemplateToArtifact` call right after that loop — the same utility already used for `DIR-INTENT-TEMPLATE.md`, which already `fs.ensureDirSync`s its parent directory:

```typescript
copyTemplateToArtifact(
  'REFERENCE-LIST-TEMPLATE.md',
  path.join(sigmaDir, 'reference', 'reference-list.md'),
);
```

No new filesystem logic — this reuses the exact pattern the codebase already has for scaffolding artifacts.

**Retrofit for existing projects**: a project initialized before this feature shipped won't have `Sigma/reference/` until it re-runs `project start --reinit`. Rather than requiring that, `sigma reference update` (below) defensively creates `reference-list.md` if it's missing before syncing — so the first time anyone runs it on an older project, the file self-heals into existence.

### `reference-list.md` template — three sections, one simple table each

```markdown
<!-- SIGMA:DOC type=REFERENCE_LIST schema=1 -->
# Reference List

> Project-wide source index for Comprehensive Research (DIR-INTENT Section 2).
> Not a formal bibliography — a path/link and a short note is enough for any
> Sigma role to revisit the source later.

## Local Artifact

> Synced automatically by `sigma reference update` from Sigma/reference/data/.
> Link or Path is filled by the command; Category and Notes are filled manually.

| Link or Path | Category | Notes |
| --- | --- | --- |
| `data/example.csv` | Source / Data | [...] |

## Website Link

> General reading material — journal articles, docs, forum posts, news.
> Filled manually.

| Link or Path | Category | Notes |
| --- | --- | --- |
| https://... | Theory and Concept | [...] |

## Online Source Data

> External datasets or data portals referenced but not downloaded locally.
> Filled manually.

| Link or Path | Category | Notes |
| --- | --- | --- |
| https://... | Source / Data | [...] |
```

`Category` is always one of the four Comprehensive Research subsections (`Theory and Concept` / `Issue, Problem, and Real-World Data` / `Methodology` / `Source / Data`), so the Source Policy tiering above still governs every row regardless of which of the three sections it's in.

### `sigma reference update` — syncs Local Artifact only

This is the one place automation replaces manual typing. Behavior:

1. Scan `Sigma/reference/data/` recursively for files.
2. For each file not already listed (matched by path) in the Local Artifact table, append a new row with `Link or Path` filled in and `Category` / `Notes` left as `[...]` placeholders.
3. Never touch existing rows — idempotent and non-destructive, so manually-added Category/Notes are never overwritten by re-running the command.
4. If a listed file no longer exists on disk, flag it (e.g. a warning line in command output) rather than silently deleting the row — a human decides whether that's stale or intentional.
5. Website Link and Online Source Data sections are never touched by this command — there's nothing to scan for a URL that was never downloaded, so ARC or any AI role writes those rows directly.

### Download-or-cite rule (Source/Data category only)

Applies specifically to the **Source/Data** category (raw datasets — Kaggle/BPS/OpenStreetMap-style sources), not to journal articles or web pages, which are recorded by link only:

1. When a dataset is available for download and license/size make it practical, ARC downloads it into `Sigma/reference/data/`, then runs `sigma reference update` to sync the Local Artifact row, then fills in Category/Notes manually.
2. When download isn't possible (paywalled, API-only, too large, licensing-restricted, or similar), ARC records the source directly under Online Source Data instead — this is mandatory whenever Comprehensive Research status is `NEEDED`, not best-effort.

### Git hygiene recommendation

Every other file under `Sigma/` — `role-memory/`, `templates/`, `rules/`, the registry JSONs — is tracked in git; there is no existing precedent of Sigma artifacts being gitignored by default. `Sigma/reference/data/` follows that same convention: **track by default**. `reference-list.md` alone would only preserve a path/link, not the actual evidence — if the local file is ever lost or the repo is cloned fresh, provenance without the file isn't enough for research that's supposed to ground an Intent. Exclusion from git is a case-by-case call, not a blanket rule: ARC or the Director may skip committing a *specific* dataset when it's genuinely large or license-restricted, and note that decision in `reference-list.md`'s `Notes` column rather than in `.gitignore`.

---

## Proposed Section Text (draft, for template insertion)

```markdown
<!-- SIGMA:DIR_INTENT:SECTION:COMPREHENSIVE_RESEARCH -->
## 2. Comprehensive Research

> **Audit Status**: FULL_AUDIT
> Optional. Mark NEEDED when the Director or ARC is not confident existing
> knowledge is sufficient to responsibly formulate this Intent, or when
> Intent must match real-world conditions verified at implementation time,
> not assumed at design time.

### 2.1 Status

- [ ] NEEDED
- [ ] NOT_NEEDED

If NOT_NEEDED, skip to Section 3. State briefly why existing knowledge is sufficient:

[...]

### 2.2 Theory and Concept

> Sources: peer-reviewed international research journals or academic/scholarly books only. No general websites, forums, Wikipedia, or similar.

[The conceptual or theoretical grounding required before this Intent can be trusted. Reference ASM-ID/REQ-ID where applicable.]

### 2.3 Issue, Problem, and Real-World Data

> Sources: open. Prefer research journals, forums, news reporting, or official reports/documentation from the relevant official website.

[Real-world evidence of the problem — incidents, user reports, measured pain — not assumed pain.]

### 2.4 Methodology

> Sources: official documentation from the official/authoritative website (preferred), or a reputable technical Q&A community (e.g. Stack Overflow, GIS Stack Exchange). Nothing outside those two tiers.

[How this investigation was conducted, and how conclusions will be validated during implementation.]

### 2.5 Source / Data

> Sources: open. Prefer official data-reporting or data-extraction sources (e.g. Kaggle, BPS, OpenStreetMap, or the domain-equivalent official registry). Download into Sigma/reference/data/ when practical; record in the reference list regardless.

[Brief description of what data was needed, if any. The full source list and any locally saved data live in `Sigma/reference/reference-list.md` — do not duplicate source content here.]
```

---

## Proposed `ARC-RULE.md` Addition: Research Mode (draft)

Mirrors the existing `AUD-RULE.md` mode pattern (Critic Mode / Verificator Mode / Hybrid Mode) so ARC's research responsibility is a distinct, bounded gear — not blended into open-ended interviewing, and not handed to AUD (see Design Principles above for why AUD doesn't fit).

```markdown
## Research Mode

### Purpose

Research Mode is ARC's investigation gear, used only when Comprehensive
Research status is set to NEEDED in the drafted DIR-INTENT.

ARC acts as Investigator, not Decision-Maker: Research Mode produces
findings that inform Intent Core. It does not substitute for Director
sovereign intent, and it is not a verification pass — that remains AUD's
Verificator Mode, run afterward on the drafted claims.

### Activation Triggers

Research Mode activates when:

- the Director or ARC marks Comprehensive Research status as NEEDED, or
- ARC's own confidence in the theory, methodology, or real-world grounding
  behind a stated Objective, Scope item, or Solution Assumption is not
  high enough to draft it responsibly from existing knowledge.

### Scope Guard

Research Mode does not expand Intent scope.

ARC investigates only what is needed to responsibly fill the Comprehensive
Research subsections and resolve the specific low-confidence ASM-ID/REQ-ID
that triggered NEEDED status. If investigation surfaces a need to change
Objective, Scope Boundary, or Success Definition, ARC surfaces that to the
Director as a finding — it does not silently rewrite Intent Core.

### Source Priority

Research Mode follows a per-subsection source tier, stricter in places than
the general Source Priority in `AUD-RULE.md` Section 2, because each
subsection answers a different kind of question:

- **Theory and Concept**: peer-reviewed international research journals or
  academic/scholarly books only. General websites, forums, Wikipedia, and
  similar tertiary sources are forbidden outright — no exceptions.
- **Issue, Problem, and Real-World Data**: open. Prefer research journals,
  forums, news reporting, or official reports/documentation from the
  relevant official website, in no strict order.
- **Methodology**: official documentation from the official/authoritative
  website (preferred), or a reputable technical Q&A community (e.g. Stack
  Overflow, GIS Stack Exchange). Nothing outside those two tiers.
- **Source / Data**: open. Prefer official data-reporting or
  data-extraction sources (e.g. Kaggle, BPS, OpenStreetMap, or the
  domain-equivalent official registry).

Unverifiable claims must still be marked as unverified, matching the
Citation Rule discipline in `AUD-RULE.md` Section 2.

### Research Mode Must

ARC must:

- use available research tools (WebSearch/WebFetch/reading real sources)
  before filling Comprehensive Research subsections,
- record every source in `Sigma/reference/reference-list.md` — never
  inline in DIR-INTENT itself,
- for local artifacts: download into `Sigma/reference/data/`, run
  `sigma reference update` to sync the Local Artifact row, then fill in
  Category and Notes manually,
- for web sources and undownloaded datasets: add the row to Website Link
  or Online Source Data manually, with Category and Notes,
- for the Source/Data category specifically, attempt local download when
  practical; when not practical, record it under Online Source Data
  instead — this is mandatory, not best-effort,
- link each finding to the ASM-ID/REQ-ID it resolves where applicable,
- mark unresolved questions as open rather than guessing.

### Research Mode Must Not

ARC must not:

- fill Comprehensive Research from unverified recall,
- treat Research Mode findings as Director-approved without presenting
  them back for confirmation,
- expand scope, budget, or timeline decisions unilaterally from research
  findings.
```

---

## Task Breakdown

### Stage 1 — DIR-INTENT Template and Marker

- Insert the Comprehensive Research section into `Sigma/templates/DIR-INTENT-TEMPLATE.md` as Section 2; renumber existing Sections 2–12 to 3–13 (including their marker comments' surrounding headings, cross-references such as "Replaces ARC-PLAN..." in the current Section 10, and the Final Validation Checklist).
- Bump the document marker to `schema=3`.

### Stage 2 — Reference List Template and Project-Start Scaffolding

- Add `Sigma/templates/REFERENCE-LIST-TEMPLATE.md` (see three-section table draft above).
- Add `'reference'` to `SUBFOLDERS` in `src/config.ts`.
- In `runStart()` (`src/commands/project.ts`), add a `copyTemplateToArtifact('REFERENCE-LIST-TEMPLATE.md', ...)` call after the existing `SUBFOLDERS` loop, scaffolding `Sigma/reference/reference-list.md` once per project.
- No `.gitignore` entry for `Sigma/reference/data/` — tracked by default, consistent with the rest of `Sigma/` (see Git hygiene recommendation above).

### Stage 3 — `sigma reference update` Command

- New `src/commands/reference.ts`: `sigma reference` command group with a `update` subcommand.
- Implement the scan-and-sync behavior described above: recursively list `Sigma/reference/data/`, append missing rows to the Local Artifact table only, never touch existing rows, flag (don't delete) rows whose file no longer exists.
- Defensive create-if-missing: if `Sigma/reference/reference-list.md` doesn't exist when this command runs, scaffold it first via the same template, then proceed — this is what makes the command self-healing for projects initialized before this feature existed.
- Register the command in `src/cli.ts` alongside the other command groups.

### Stage 4 — Marker Validation

- Add `COMPREHENSIVE_RESEARCH` to `requiredSections` for `intent` in `src/utils/docCheck.ts` (validates the DIR-INTENT template's section marker only — unrelated to `reference-list.md`, which has no structural CLI validation beyond the Local Artifact sync).
- Update/extend `test/doc-check.test.ts` for the new required marker and renumbered schema.

### Stage 5 — Role Rule Updates (ARC Research Mode + AUD Cross-Reference)

- Add the **Research Mode** section to `ARC-RULE.md` (see draft above): Purpose, Activation Triggers, Scope Guard, Source Priority, Must / Must Not.
- Add "DIR-INTENT Comprehensive Research claims" to `AUD-RULE.md`'s existing Verificator Mode Activation Triggers list, so AUD's fact-checking explicitly names this category. No other change to `AUD-RULE.md`.

### Stage 6 — Fixtures and Regression

- Update any test fixture `DIR-INTENT.md` files to include the new section (status `NOT_NEEDED` where the fixture isn't testing this feature).
- Add a test asserting `sigma project start` creates `Sigma/reference/reference-list.md` once, project-wide (not per intent version).
- Add tests for `sigma reference update`: appends new local-artifact rows, is idempotent on repeat runs, never overwrites existing Category/Notes, flags missing files, self-heals a missing `reference-list.md`.
- Run full `npm test` to confirm no existing intent/project-start test breaks from the renumbering, new subfolder, or new command.

---

## Risk Notes

- **Decorative field risk**: a status field with no behavioral enforcement becomes checkbox theater. Mitigated by Stage 5 (`ARC-RULE.md` requirement) and the Final Validation Checklist line — the CLI enforces structural presence, the rule enforces genuine investigation, the checklist enforces subsection completeness when NEEDED.
- **Renumbering churn**: inserting a new Section 2 renumbers everything after it, touching every cross-reference inside the template (e.g., Section 10's note "Replaces ARC-PLAN"). Needs a careful single-pass edit, not incremental patches, to avoid mismatched section numbers.
- **Backward compatibility with existing locked intents**: schema=2 documents remain valid as-is; the template change only affects new `DIR-INTENT` documents created after the bump. `reference-list.md` retrofits independently via the self-healing fallback in `sigma reference update`, so existing projects aren't blocked either way.
- **ARC workload growth**: Research Mode adds real work to ARC beyond interviewing. Mitigated by keeping it a distinct, boundaried mode (own Scope Guard, own Must/Must Not) rather than blending it into free-form interview time, and by keeping status `NOT_NEEDED` the default so it only activates when actually justified.
- **Role-boundary drift**: without the Scope Guard, Research Mode could quietly turn into ARC re-deciding Objective/Scope instead of just investigating. Mitigated by the explicit rule that scope-changing findings go back to the Director, not into a silent rewrite.
- **AUD trigger-list change is additive only**: adding "DIR-INTENT Comprehensive Research claims" to Verificator Mode's Activation Triggers does not touch AUD's Scope Guard, passivity, or CLAUDE.md's "AUD must not scan files... without explicit Director authorization" constraint.
- **One shared list growing unbounded**: since `reference-list.md` is project-wide and cumulative across every intent version, it can grow large or mix sources from unrelated research efforts over a project's life. Mitigated lightly by convention, not structure: entries can note which intent version or ASM-ID they were gathered for in the free-text `Notes` column — kept optional and informal, consistent with "simply as that."
- **Downloaded data bloating the repo**: raw datasets can be large or license-sensitive. Mitigated by tracking `Sigma/reference/data/` by default (consistent with the rest of `Sigma/`, none of which is gitignored) and leaving exclusion of a specific large/restricted dataset as a case-by-case ARC/Director call, noted in `reference-list.md`'s `Notes` column rather than enforced structurally.
- **Existing-project retrofit**: projects initialized before this feature ships won't have `Sigma/reference/` until something creates it. Resolved by the self-healing check in `sigma reference update` — no separate migration command needed.

---

## Director Decisions Recorded

- **`Sigma/reference/` location**: confirmed to stay under `Sigma/`, consistent with every other top-level artifact folder (`design/`, `build/`, `templates/`, etc.) — not moved to project root.
- **`Sigma/reference/data/` git hygiene**: confirmed tracked by default, not gitignored — matches the rest of `Sigma/` (nothing in it is currently gitignored). Exclusion of a specific large/license-restricted dataset is a case-by-case ARC/Director call, not a blanket rule.

---

## Draft Acceptance Criteria

- [ ] `Sigma/templates/DIR-INTENT-TEMPLATE.md` includes the Comprehensive Research section at position 2, with correct renumbering of all subsequent sections and cross-references.
- [ ] Template document marker reads `schema=3`.
- [ ] `src/utils/docCheck.ts` requires the `COMPREHENSIVE_RESEARCH` marker for the `intent` domain.
- [ ] `ARC-RULE.md` includes a distinct Research Mode section (Purpose, Activation Triggers, Scope Guard, per-subsection Source Priority table, Must/Must Not), structurally consistent with `AUD-RULE.md`'s existing mode pattern.
- [ ] The per-subsection Source Policy (Theory/Concept: journals+books only; Real-World Data: open, journal/forum/news/official preferred; Methodology: official docs or reputable technical Q&A only; Source/Data: open, official data sources preferred) appears in both the template's inline hints and `ARC-RULE.md` Research Mode, and the two stay in sync.
- [ ] `AUD-RULE.md` Verificator Mode Activation Triggers names "DIR-INTENT Comprehensive Research claims" as a trigger category, with no other change to AUD's scope or passivity rules.
- [ ] Final Validation Checklist includes the new completeness line for NEEDED status.
- [ ] `npm test` passes, including updated `test/doc-check.test.ts` coverage for the new section marker.
- [ ] A status of `NOT_NEEDED` requires no more than one line of justification — confirmed lightweight for the common case.
- [ ] Role split is unambiguous in the rules: ARC investigates and drafts (proactive, pre-draft), AUD verifies what was drafted (reactive, post-draft, scope-guarded) — no overlap, no new role.
- [ ] `Sigma/templates/REFERENCE-LIST-TEMPLATE.md` exists with the three-section structure (Local Artifact / Website Link / Online Source Data), each a simple `Link or Path | Category | Notes` table; `DIR-INTENT` Section 2.5 points to it instead of holding source content inline.
- [ ] `sigma project start` creates `Sigma/reference/reference-list.md` exactly once per project, regardless of Comprehensive Research status — verified by a new test, not by a runtime existence gate at intent time.
- [ ] `sigma reference update` correctly syncs the Local Artifact table from `Sigma/reference/data/`: adds new rows, never overwrites existing Category/Notes, flags missing files, and self-heals a missing `reference-list.md`.
- [ ] `Sigma/reference/data/` is tracked in git by default (no `.gitignore` entry), consistent with the rest of `Sigma/`.
- [ ] `reference-list.md`'s framing (in the template and in `ARC-RULE.md`) is explicit that it's an informal source index, not a formal citation/bibliography format.

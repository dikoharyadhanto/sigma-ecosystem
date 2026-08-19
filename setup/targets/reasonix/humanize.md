---
name: humanize
description: "Rewrite or draft content for a human reader — comprehension-first, no manufactured certainty, no AI writing tics"
---

# /humanize — Writing For a Human Reader

## Philosophy

The goal is not to write like a human. The goal is to write for a human.

"Write like a human" chases style — does this sound like it wasn't written by AI. "Write for a human" chases comprehension, trust, relevance, proportionality, and decision-usefulness — does the reader immediately understand the situation, find what matters, and trust what they're reading.

Reader friction is the actual problem. AI-sounding prose — passive-voice avoidance, repeated "X, not Y" contrasts, parenthetical asides, over-explaining — is a symptom of that problem, not the target to optimize for directly. The rules below exist because they reduce friction, not because they disguise the writer.

## Skill Identity

This is a universal, general-purpose writing-style skill.

It is not a governance role. It does not switch roles, create Sigma artifacts, lock artifacts, or touch project state. It is not scoped to any single document type, folder, or system — it applies whenever the Director wants content written or rewritten for a human reader.

It may be invoked by any active role without switching roles. The active role remains active after `/humanize` is applied.

Scope is broader than Sigma governance documents: a Discussion note, an email, a project brief, a section of any file — anything the Director points this skill at.

## Out Of Scope: Sigma Artifact Files Themselves

This skill never applies directly to `DIR-INTENT`, `FMN-PLAN`, `DEV-EXEC`, `ROADMAP`, or `DIR-CLOSE` files — the artifact itself, not a document derived from it. These files must stay detailed and formally structured because the AI and the Sigma CLI read them directly: structural markers, checklists, and full technical detail are load-bearing, not incidental. This applies even to `DIR-CLOSE`, whose prose already reads close to human-friendly — the file still carries structural markers and lock state the CLI validates, so it is never edited in place either. Rewriting one of these files with this skill would corrupt the structure Sigma depends on.

This skill produces separate documents derived from those artifacts — `DIR-INTENT-HUMAN`, `PLAN-EXEC-HUMAN`, `DIR-CLOSE-HUMAN`, and notes under `Sigma/notes/` — never the source artifact in place.

## Activation

```text
/humanize
/humanize <file or section>
/humanize this
create file <path> with /humanize
update this file <path> with /humanize
```

Applies to whatever the Director indicates — the current draft in progress, a named file, or a specific section. The skill combines naturally with an ordinary file request rather than requiring its own separate step: "create file `docs/onboarding.md` with /humanize" drafts new content directly in this style from the start; "update this file `README.md` with /humanize" rewrites existing content in place, applying Preserve/Compress/Rephrase/Infer (below) to what's already there. If the target is ambiguous, ask once rather than guessing.

## Target Audience & Purpose

Default assumption: the reader is a human who is not familiar with whatever internal system, jargon, or process produced the source material, and is not an AI. Write as if the document may be shared outside the immediate working context — a colleague, a stakeholder, a client — not just re-read by the person who wrote it.

State the core fact plainly once, up front if useful: this content will be read by a human. Every rule below exists to serve that fact.

Default register: professional, non-specialist, effective. Adjust only if the Director specifies a different audience.

## Core Invariant: Do Not Manufacture Certainty

This is the most important rule in this skill — more important than any style rule below.

> Uncertainty, incompleteness, disagreement, pending decisions, and unresolved risks must remain visible whenever they are material to the reader.

Simplifying for readability must never simplify away doubt, partial results, or open questions. A confident-sounding sentence that overstates what the source actually supports is a worse failure than a clumsy sentence that stays accurate.

- Source: "5 test suites passed, 1 suite was skipped."
  Wrong: "Testing was completed." — drops the skip; this is an unsupported conclusion, not a compression.
  Right: "5 of 6 test suites passed. 1 was skipped."

- Source: "This decision has not yet been made."
  Wrong: "The project is approved." — sounds more decisive, states something the source does not support.
  Right: "This decision is still pending."

## Four Operations On Source Content

- **Preserve** — decisions, constraints, status, risks, and conclusions. These survive intact; wording may change, substance may not.
- **Compress** — repetitive detail, verbose reasoning, mechanical metadata. Free to shorten.
- **Rephrase** — wording and structure. Free to change for clarity.
- **Infer** — forbidden. Never add a conclusion, judgment, or degree of completeness the source does not itself support.

## Writing Rules

### 1. Passive voice preferred over first-person active voice for describing work done

Prefer naming the work over naming the actor.

- Avoid: "I validated the pipeline using three sample datasets."
- Prefer: "The pipeline was validated using three sample datasets."

This is a default preference, not an absolute ban on first person — use judgment when active voice is clearly clearer for a specific sentence.

### 2. Reduce or eliminate contrastive negation ("X, not Y")

This pattern is a recognizable AI writing habit and should not appear as a repeated stylistic tic:

- Avoid: "The model uses Landsat satellite imagery, not Sentinel."
- Avoid: "The LLM is used only for user communication, not raw data analysis."

State the fact directly instead:

- Prefer: "The model uses Landsat satellite imagery."
- Prefer: "The LLM is used for user communication."

Only use the "X, not Y" construction when the contrast itself is the point the reader genuinely needs — a real, specific risk of being misread the other way — and even then, use it once, not as a running pattern across the document.

### 3. Reduce artificial completeness

AI drafts tend to over-explain: a simple status becomes several paragraphs, a simple decision becomes a list of five reasons, one change becomes a long history. Write to the information need, not to match the length of the source document.

This does not override Preserve above. A limitation, risk, or decision that is individually material stays in, even if that makes the section longer than the shortest possible version.

### 4. Lead with the decision or current state

When a conclusion, decision, or current status exists, put it first. Supporting context comes after, not before.

- Avoid: "Several validation steps were carried out across multiple stages, covering data ingestion, transformation, and output checks. As a result, the pipeline is now ready for the next stage."
- Prefer: "Status: the pipeline is validated and ready for the next stage." — followed by supporting detail if needed.

If there is no settled conclusion yet, say that plainly instead of manufacturing one — see the Core Invariant above.

### 5. Use technical terms when they matter, not never

Do not strip technical language by default. Keep a technical term when it materially helps the reader understand the result, decision, limitation, or risk; explain it in place if needed rather than removing it. What counts as "too technical" depends on who is reading — a technical audience should still receive the technical facts that matter to them.

### 6. Avoid parenthetical asides

Do not use parentheses to tuck in explanatory side-notes, citations, or qualifiers. This reads as an AI writing habit and breaks the flow of a sentence a human is meant to read straight through. Fold the information into the sentence directly, put it in its own sentence, or drop it if it isn't essential.

- Avoid: "The pipeline was validated (see the test report for details) before deployment."
- Prefer: "The pipeline was validated before deployment. The test report has the details."

### 7. Professional and effective writing

- Concise, plain language. No unnecessary jargon or internal terminology the target reader wouldn't recognize, beyond what Rule 5 allows.
- Short paragraphs and clear structure over long qualified sentences.
- Every claim stated once, directly — do not hedge or repeat the same point in slightly different words as a way of sounding thorough.
- No filler openers ("It's worth noting that...", "It's important to understand..."). State the point.

### 8. Never use Sigma terminology

This applies regardless of what the source document is — a Sigma artifact, a Discussion note, anything. If the reader may not know what Sigma is, its internal vocabulary must never appear in the output.

| Sigma term | Do not write | Write instead |
| :--- | :--- | :--- |
| `DIR-INTENT` | "the DIR-INTENT" | "the project brief" / "the goals" |
| `FMN-PLAN` | "the FMN-PLAN" | "the plan" |
| `DEV-EXEC` | "the DEV-EXEC" | "the execution report" / "the delivery" |
| `RATIFIED` / `LOCKED` | "once ratified/locked" | "once approved" / "once finalized" |
| `DRAFT` | "still a DRAFT" | "still in progress" |
| `Gate 1` / `Gate 2` / `Gate 3` | any gate reference | omit — state the actual status instead |
| `ARC` / `FMN` / `DEV` / `AUD` | role names | omit, or use a generic function like "the reviewer" or "the team" only if it must be said at all |
| "Sigma" | the word itself | omit entirely |
| `chain_version`, `progress-v<N>.json`, or any other internal state-machine term | any of these | omit entirely |

The list above is not exhaustive — treat any word or code that only makes sense inside the Sigma governance system as forbidden, whether or not it's listed here.

## Relationship to Sigma Humanize Operation

`sigma intent humanize`, `sigma exec humanize`, and `sigma close humanize` are a separate, Sigma-specific pipeline with their own structural rules: which sections to include and source-fidelity invariants. Full detail lives in `PLAN-IMPL-SIGMA-HUMANIZE-OPERATION-20260816.md`. That pipeline applies the writing rules in this skill on top of its own content and structure rules. It does not redefine them, and this skill is not limited to documents destined for Notion.

Every document the Sigma Humanize Operation writes for a Notion push is written using this skill — it is not optional for that pipeline. On top of this skill's Rule 8, that document additionally goes through a mandatory automatic scan for Sigma terminology immediately before the push. A single detected term fails the push outright; the document does not reach Notion until it is clean. This scan applies only to documents destined for Notion through that pipeline — it is a stricter, mechanically enforced layer on top of this skill's general rules, not a replacement for them.

# Sigma Artifact `.gitignore` Defaults

> **Purpose**: Small, self-contained discussion on which Sigma-managed files/directories are safe to auto-ignore when `sigma project start` runs, versus which must always stay tracked in git. Triggered by the Director's idea of auto-seeding `.gitignore` at project start, with two modes: a conservative default (only the most disposable, fast-churning files) and an aggressive "ignore everything under `Sigma/`" mode. Nothing in this document is implemented yet.

---

## 1. Method: verified against `reconstruct.ts`/`config.ts`, not assumed

The Director's own framing ties "safe to ignore" to "can be regenerated via `sigma doctor`." That's the right test — but it needed checking file-by-file against what `sigma doctor --reconstruct` (`src/engine/reconstruct.ts`) actually does, not assumed from how dynamic a file *looks*. One finding from that check changes the recommendation for the single most dynamic file in the whole system.

### 1.1 Critical finding: `progress-v<N>.json` is *not* losslessly reconstructable

`reconstruct.ts` rebuilds a chain file from the markdown artifacts still on disk (`DIR-INTENT-vN.md`, `ROADMAP-vN.md`, `FMN-PLAN-*.md`, `DEV-EXEC-*.md`, `DIR-CLOSE-vN.md`) plus `intent-history.md` for title/focus recovery. It is a genuine, well-designed recovery mechanism — but it is explicitly **best-effort, not lossless**, by its own design:

- **ARC Satisfaction Score is never recovered.** `readIntentHistoryMetadata()` only reads back `version`/`title`/`focus` from `intent-history.md` — the Score/Notes columns that same file renders are never parsed back in. If `progress-v<N>.json` is lost, `arc_score`/`arc_score_notes`/`arc_score_updated_at` are gone permanently, even though `intent-history.md` visibly displayed them a moment before.
- **Exact historical timestamps are lost.** Reconstruction stamps everything with the reconstruction time (`now`), not the original `created_at`/`locked_at`. Lock order and precise dates become unrecoverable.
- **Ambiguous multi-draft groupings can't be resolved from filenames alone.** If more than one `DRAFT` PLAN/EXEC existed under one major version at the time of loss, reconstruct leaves them all `DRAFT` and flags an `INVALID` marker for manual Director review rather than guessing pairing. This case gets **more common, not less**, once the multi-draft redesign in `2026-08-12_1413_...multidraft.md` lands — concurrent workstreams are exactly the shape reconstruct can't safely disambiguate.

**Conclusion**: `progress-v<N>.json` must never be gitignored, despite being the single most frequently-written file in the system. "Dynamic" and "safe to lose" are not the same axis — this file is both.

### 1.2 Consistent with an existing standing preference

Directly reinforces prior project guidance (`feedback-no-auto-backup` memory): the Director dislikes ad-hoc backup mechanisms and treats **git itself as the safety net**. Gitignoring the CLI-managed state file would quietly undermine exactly that — there would be no safety net left for the one file reconstruct can't fully restore.

---

## 2. Full inventory, categorized

Verified against `src/config.ts`'s path constants plus prior exploration of the `Sigma/` layout in this session.

### 2.1 Never ignore — tracked, git is the safety net

| Path | Why |
| :--- | :--- |
| `Sigma/design/DIR-INTENT-v<N>.md` | Governing intent document — irreplaceable. |
| `Sigma/build/ROADMAP-v<N>.md`, `FMN-PLAN-*.md`, `DEV-EXEC-*.md` | Governance/build record — irreplaceable prose (Deviations, Walkthrough, evidence, etc. exist nowhere else). |
| `Sigma/close/DIR-CLOSE-v<N>.md` | Closure record. |
| `Sigma/pending/FMN-PLAN-<id>.md` | Real drafted content, not disposable just because not yet in the official version queue. |
| `Sigma/progress-v<N>.json` | **§1.1 — not losslessly reconstructable.** |
| `Sigma/SIGMA_CONSTITUTION.md`, `Sigma/SIGMA_PROTOCOL.md` | Core governance text. |
| `Sigma/rules/*.md`, `Sigma/templates/*.md` | The project's effective rule/template set — may diverge from global (`~/.sigma/`) if customized; low cost to track regardless. |
| `Sigma/reference/reference-list.md`, `Sigma/reference/data/*` | Research evidence — the actual point of Comprehensive Research is to leave a durable trail. |
| `Sigma/role-memory/*.json` | Accumulated per-role continuity across sessions. |
| `Sigma/SIGMA-REGISTRY.json`, `Sigma/SIGMA-OPERATION-REGISTRY.json` | Already documented elsewhere (`CLAUDE.md`) as CLI-managed, do-not-hand-edit files — same tier as `progress-v<N>.json`, same reasoning applies. |
| `.sigma-identity.json` (project root, **not** under `Sigma/`) | Tiny, stable project identity marker — no reason to lose it. |

### 2.2 Default-ignore candidates (Mode 1) — genuinely disposable

| Path | Why safe |
| :--- | :--- |
| `Sigma/logs/operations.jsonl` | Pure audit trail; never read by gate/lock computation. |
| `Sigma/logs/intent_amendment.log` | Same tier as `operations.jsonl` by design (see `2026-08-11_0115_Intent-taxonomy-and-amendment-model.md` §3 item 4 — explicitly modeled as an audit trail, never a render source). |
| `Sigma/design/intent-history.md` | Its own source comment confirms it: *"100% auto-render, zero manual sections... overwrite the whole file every time."* The single cleanest case in the whole inventory. |
| `Sigma/activate_status.json` | Small pointer file; `resolveActiveChainVersion()` already auto-defaults to the highest non-`SUPERSEDED` chain if it's missing or stale — losing it degrades gracefully by design, not a hard failure. |

### 2.3 Judgment calls — not clean-cut, flagging rather than deciding

| Path | Tension |
| :--- | :--- |
| `Sigma/memory/overrides.jsonl` | Structurally an append-only log like §2.2's entries, but its *content* is Director's explicit gate-bypass reasons — arguably more sensitive/significant than routine operation noise. Leaning toward **not** default-ignoring this, but it's a real judgment call, not as clean as intent-history.md. |
| `Sigma/messages/*` (`sigma send`/`sigma inbox` mailbox) | Could carry real handoff content (e.g. the Amendment Request messages designed in `2026-08-12_1413_...multidraft.md` §5) — but the substantive outcome of any such message should already land in a governed artifact regardless. Not obviously safe to lose, not obviously worth tracking either. |

### 2.4 Mode 2 — ignore all of `Sigma/`

A legitimate, separate use case, not a "more aggressive version of Mode 1": entirely opting Sigma governance state out of the shared repository — for confidentiality (governance discussion the team doesn't want in a possibly-public repo), or a trial/local-only period before a team formally adopts Sigma. Worth naming plainly: this mode sacrifices the git-as-safety-net property for everything in §2.1 too, not just the disposable files — that's an intentional trade a Director opts into, not something that should ever be the unlabeled default.

---

## 3. Implementation shape (proposal, not yet built)

- `sigma project start --gitignore=default|all|none`, defaulting to `default` (§2.1 never touched, §2.2 ignored, §2.3 resolved one way or the other before this ships — see §4).
- Written as a delimited, append-only block — mirrors the exact `SIGMA:RENDER:START`/`END` convention already used for ROADMAP's Stage Overview table (`src/utils/roadmap.ts`), adapted to `#`-comment form for `.gitignore`:
  ```gitignore
  # SIGMA:GITIGNORE:START
  Sigma/logs/
  Sigma/design/intent-history.md
  Sigma/activate_status.json
  # SIGMA:GITIGNORE:END
  ```
  Appends to an existing `.gitignore` rather than overwriting it, and is idempotent/re-runnable the same way `renderRoadmapFile()` already is.
- Scoped strictly to Sigma-managed paths — ordinary project hygiene (`node_modules/`, `dist/`, etc.) is out of scope for this mechanism.

---

## 4. Open / not yet decided

- §2.3's two judgment calls (`overrides.jsonl`, `Sigma/messages/*`) — not resolved, need an explicit Director call before Mode 1's exact file list is final.
- Exact CLI flag name/shape (`--gitignore=...` is a placeholder) — not confirmed.
- Whether `sigma doctor`/a dedicated command should also be able to *retrofit* the managed block into an existing project that ran `project start` before this feature existed, not just at fresh `project start` time.

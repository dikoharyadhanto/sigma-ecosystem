# Sigma v2 — Clean Operation Guide

Written 2026-10-15 for Sigma 2.1.0 (master commit `61c1dce`); updated 2026-10-20 for Sigma 2.2.0 (gitignore by default, identity guardrail, snapshot-mode INTENT baseline, portability); updated 2026-10-26 for Sigma 2.3.0 (post-build review checkpoints, PLAN schema 4, EXEC schema 5). Facts were verified against the code, the CLI help, and the machine on those dates. Items marked **[Inference]** were not verified.

**Audience:** any AI that is active inside an existing Sigma project while the machine's global Sigma installation is already the latest version, and the Director who supervises it.

**This guide is self-sufficient.** You do not need to find the Sigma master folder, read the Sigma source code, or guess. Every `sigma` command resolves the master by itself. Everything you need to read about the project is inside the project (`Sigma/rules/`, `Sigma/SIGMA_PROTOCOL.md`, `Sigma/SIGMA_CONSTITUTION.md`, `Sigma/templates/`). If this guide and a project rule disagree, the rule wins and this guide is out of date: report it.

---

## 0. Read this first (one minute)

1. The global installation is current. **Your project is probably not.** The CLI code is already new in every project; the project's copied documents (rules, templates, role memory, bridge files) may still be old. Old documents with new code is the main source of confusion.
2. Do **only read-only commands** until the Director approves a sync. Run the orientation in section 2.
3. Do not run bare `sigma doctor`. It reconciles state and can write. The read-only form is `sigma doctor --check-assets`.
4. Do not activate ARC, FMN, DEV, or AUD on your own. A governance role needs explicit Director activation.
5. If a command prints `[SIGMA BLOCKED — MISSING LOCAL SIGMA FILES]`, stop: this clone has no Sigma files and must not be re-registered (section 1.8).
6. If anything is unclear, stop and ask the Director with a recommendation. Do not infer.

---

## 1. What is new or changed (you must be aware of this)

Because the CLI is shared, items marked **applies now** already hold in your project, even before any sync.

### 1.1 INTENT is a strategic mandate; PRODUCT REVIEW replaces scoring (applies now)

| Topic | Now | What you must do differently |
|---|---|---|
| INTENT meaning | A strategic mandate over **one main objective**: what is produced, for whom, to what quality, and how success is recognised on the **final product**. It survives changes of feature, method, and stage. | Do not put features, technologies, or work lists in an INTENT. Those belong to ROADMAP and PLAN. |
| INTENT template | Schema 6. `Core Requirements` (Required Capability + Acceptance Standard), `Evidence Required` (not "Measurement Method"), Quality Standards with domain-specific rows allowed, Project Failure, Mandate Coverage. Summary is at most five sentences. | New INTENTs use schema 6. Existing schema-5 INTENTs stay valid and are not rewritten. |
| Changing a RATIFIED INTENT | Classified **T1** (feature/method/stage, INTENT untouched), **T2** (sharpen the same objective, amend), **T3** (change of direction, new independent INTENT). Few amendments is a quality signal, not a gate. | Classify before proposing anything. State T3 as a factual finding; do not recommend a new INTENT unless the Director asks. |
| ARC activation | Offers three paths only: discussion only, check the current INTENT (amend or not), final product evaluation. A new INTENT is not offered, except when the project has none. ARC gives no recommendation unless asked. | ARC: do not infer the path from the phrasing of the request. Present the paths and wait. |
| PRODUCT REVIEW (new artifact) | `Sigma/review/PRODUCT-REVIEW-vN.md`, one per INTENT, no status of its own. FMN's review request, then verdicts by ARC, AUD (unless `SKIP_FOR_AUDIT`), and the Director: `PASS`, `PASS_WITH_RISK`, `REVISE`, `REJECT_RECOMMENDED`. Only PASS and PASS_WITH_RISK are accepted and they are permanent. Findings are append-only. ARC and AUD review independently. | Commands: `sigma review new`, `sigma review check`. Created only after the Director states the final product is ready. |
| CLOSE | `sigma close new` needs Gate 3 **and** an accepted PRODUCT REVIEW. CLOSE schema 3 is a closing report of the final product. `sigma close check` is read-only and runs before the CLOSE exists. | Run `sigma close check` first. |
| `sigma close lock` | Has no content gate. Needs Gate 3 (nothing left open) on **every** lifecycle model. | A CLOSE does not block new PLANs, before or after it is locked. Continuing inside the same mandate is allowed; a new objective is a new INTENT. |
| Removed | `sigma intent score`, the ARC satisfaction score, Gate 3.5 as a score gate, score columns of `intent-history.md`, ARC score-driven Trigger 2, Petition / Admission Review. Existing `arc_score` data stays and is no longer read. | Do not look for or recommend any of these. |
| `sigma intent ratify` | No longer supersedes other chains. `intent lock` is removed. | Only `sigma intent supersede --v <chain> --director-confirm` cascades SUPERSEDED. |

### 1.2 Lifecycle and approval

- **Two lifecycle models coexist.** A chain without a `lifecycle_model` field is `legacy_lock` (PLAN/EXEC end LOCKED, `legacy_offset` numbering). A chain created by `sigma intent new` on 2.1.0 is `paired_approval` (PLAN/EXEC are APPROVED, numbering aligned: INTENT-vN pairs with PLAN-vN.x). `sigma intent new` never changes an existing chain.
- **`sigma plan lock` and `sigma exec lock` are removed.** Use `sigma plan approve` / `sigma exec approve` (preview first; the exact meaning follows the chain's lifecycle model).
- New in `paired_approval` chains: `sigma plan revise` (FMN: controlled revision of an APPROVED contract) and `sigma exec acknowledge-plan` (DEV acknowledges the latest PLAN revision; grants no coding authority).
- Do not migrate a legacy chain (`sigma doctor --migrate-lifecycle --director-confirm`) unless the Director decides so per chain. Migration turns LOCKED PLANs into APPROVED and needs baseline review.
- `sigma intent new` also **activates** the new chain. The old chain stays untouched and inactive. `sigma intent activate --v <chain>` switches back and needs no confirmation, so treat it as consequential: every later command acts on the active chain.

### 1.3 INTENT amendment: Git mode and snapshot mode (F05; snapshot mode since 2.2.0)

`sigma intent baseline check` → edit → `sigma intent amendment preview` (read-only diff, hash, PLAN/EXEC impact; it prints `Mode: git` or `Mode: snapshot`) → Director reviews → record the amendment. Sigma never stages, commits, or pushes. Approval relayed by another role is not approval.

| | Git mode | Snapshot mode |
|---|---|---|
| Used when | The chain already has a Git baseline, or the INTENT is tracked by Git | Git does not track the INTENT (the default while the Sigma gitignore is on, see 1.8) or there is no Git |
| Baseline | `sigma intent baseline adopt --commit <ref> --director-confirm` (commit + local tag) | `sigma intent baseline adopt --director-confirm` (no `--commit`; stores `Sigma/revisions/INTENT-v<N>/base.md`) |
| Between preview and record | Commit the reviewed content to Git | Nothing |
| Record | `sigma intent amendment --change ... --purpose-changed ... --commit <ref> --doc-sha256 <hash> --director-confirm` | The same without `--commit` (passing it is rejected); stores `amd-<NNN>.md` |

A chain that has a Git baseline stays in Git mode even after its INTENT stops being tracked; `sigma config set gitignore on` lists such chains and the Director moves one with `sigma intent baseline adopt --v <chain> --director-confirm` (no `--commit`). Sigma does this only on that explicit approval.

### 1.4 Artifacts, files, and changelog

- **File names have no role prefix** (F10): new files are `INTENT-vN.md`, `PLAN-vN.M.md`, `EXEC-vN.M.md`, `CLOSE-vN.md`. Older files (`DIR-INTENT-…`, `FMN-PLAN-…`, `DEV-EXEC-…`, `DIR-CLOSE-…`) keep their names and are never renamed. Both forms are valid. Do not rename or "normalize" files.
- **Product changelog** (F17): the EXEC template is schema 5 and has a required `Changelog` section (a flat list, or exactly `No product changes.`). New EXEC drafts use it, including in old chains. When an EXEC becomes LOCKED/APPROVED through `sigma exec approve --director-confirm`, the list is written into the project's `CHANGE-RECORD.md` (not `CHANGELOG.md`). If recording is skipped, a message says why; fix the file and resolve before the next EXEC.
- Current template schemas: INTENT 6, CLOSE 3, PLAN 4, EXEC 5, PRODUCT-REVIEW 1, ROADMAP 1.

### Post-build review checkpoints

PLAN schema 4 adds Checkpoint for Post-Build Review. FMN chooses the fewest checkpoints needed for dependencies and risk, default 1 after all implementation and verification. Pre-build review is separate. For custom totals, each numbered bullet states After and Focus; only the last bullet is marked `(Final)` and covers all implementation and verification and the whole result. Descriptions use the configured document language. DEV's technical stage breakdown does not add reviews. DEV waits before dependent work and resumes within existing Director authorization after FMN responds that findings are resolved. Escalate material blockers earlier when needed.

EXEC schema 5 places FMN-owned Intermediate Post-Build Reviews immediately before FMN Post-Build Review. FMN updates Last Checkpoint Reviewed and free-form Content to replace the previous intermediate review; use N/A if none. Follow-up rounds retain the checkpoint number; FMN Post-Build Review remains the final overall verdict, followed by Summary and Changelog. Intermediate reviews do not expand ordinary contract revision checkpoints or add runtime gates. Existing documents retain their schema and single-final-review default when no schedule exists. PLAN cloning supports 3→4 and 4→4 and resets the schedule for FMN reassessment.

### 1.5 Messaging and memos

- Every `sigma send` needs `--related-artifact <artifact or GENERAL>`. Mailboxes are per INTENT plus `GENERAL`. A version written in the subject does not select a mailbox.
- Valid messaging roles: arc, fmn, dev, aud. The Director communicates directly.
- Read your unread messages (`sigma inbox`) before sending. **Never create, rename, move, or delete message files by hand.**
- `OUTDATED` is a status for surplus READ messages (auto-swept, default keeps the 5 most recent). Files are retained. `sigma inbox --outdated` shows them.
- `sigma memo write | list | read | clear`: a self-to-self operational brief for continuity across sessions, quota per owning INTENT and role. Reading a memo's full content needs an explicit Director instruction.

### 1.6 Version signals (F12) — your guidance system

Inside a project, ordinary commands print one stderr line when something is behind. **Treat it as an instruction trigger, not noise.**

| Line says | Meaning | Your action |
|---|---|---|
| "the global installation (~/.sigma) … is behind the installed CLI … Run: sigma setup update" | Host is behind master | Stop. Tell the Director. Host-level; you do not run `setup update`. |
| "this project was last synced at … and is behind ~/.sigma … Run: sigma project sync" | Project copies are behind host | Section 3, step 4. Dry run only until approved. |
| "no version stamp" | Project was never synced under 2.1.0 or later | Same as above. |

`sigma doctor --check-assets`, `sigma session bootstrap`, `sigma project start|register|sync`, and `sigma setup` do not print this line; they report version status themselves.

### 1.7 Other additions and removals

- **Added:** `sigma notes new|list|update` (free-form notes, registered), `sigma control` (trusted local Director surface, never reachable by MCP), `sigma audit` (hash-bound audit snapshots), clone commands (`sigma intent clone`, `sigma plan clone`: preview first), read-only PLAN source review, two MCP servers (`sigma-mcp` query, `sigma-control`), opencode as a target (with a `protect-sigma` plugin).
- **Removed:** the Notion integration and `sigma notion`, `sigma intent|exec|close humanize` commands (the `/humanize` skill and `sigma scan` remain), the HUMAN templates, the Cursor target.
- **Protected files:** the Claude Code hook and the opencode plugin block direct edits to `Sigma/progress-v<N>.json`. Chain state is changed only by `sigma` commands.

### 1.8 Gitignore by default, the identity guardrail, and moving between machines (2.2.0; the guardrail and new-project behavior apply now)

| Topic | Now | What you must do differently |
|---|---|---|
| Gitignore | `git.gitignore_sigma` (default on). `sigma project start` writes a `# >>> sigma-managed >>>` block to `.gitignore` listing `/Sigma/`, the five bridge files, `.mcp.json`, `opencode.json(c)`, `CHANGE-RECORD.md`, and inside the DEV workspace only `dev/.sigma-workspace.json` and `dev/CHANGE-RECORD.md`. `dev/` itself is never ignored. `.sigma-identity.json` is the one Sigma file left in Git. | Do not edit inside the block. Do not add `.gitignore` rules below it that re-include or exclude Sigma files. |
| Existing projects | Not changed by a sync. The setting shows as `ON [default]` until the Director runs `sigma config set gitignore on`. | Never run `on` yourself. It is a Director decision per project (see 5 and the sync guide in `Discussion/`). |
| What `on` does | Writes the block and detaches already-tracked Sigma files from the Git index (`git rm --cached`). Files on disk are untouched; nothing is committed. | Report the `git status` afterwards; the Director commits. |
| Other clones | After the cleanup commit is pushed, `git pull` in any other clone **removes that clone's tracked Sigma files from disk**, and that clone is then blocked. | Before anyone pulls it, make sure other clones have their Sigma files copied somewhere safe. |
| Guardrail | If `.sigma-identity.json` exists but `Sigma/` does not, every `sigma` command except `sigma setup` (including `project start`, `register`, `sync`) and every MCP server refuses with `[SIGMA BLOCKED — MISSING LOCAL SIGMA FILES]`. The message names the original machine when the identity records one (`origin_machine`, set by `project start` or `sigma config set origin-machine`) and says whether this is that machine. The record is informational; it never decides the block. | Do not try to work around it, re-register, or recreate `Sigma/`. Report it. |
| Moving a project to another machine | `sigma config set gitignore off`, commit and push all Sigma files from the original machine, `git pull` on the other. | Never copy `Sigma/` by hand into a blocked clone without the Director. |
| Stable identity | `.sigma-identity.json` no longer carries the version stamp (`sigma_applied`) or `logs_created_at`; they live in `Sigma/activate_status.json`. | Do not read the stamp from the identity file. |
| Self-heal | Before a command that changes state, a `.mcp.json`/`opencode.json` that names another project root is refreshed, and a missing `dev/.sigma-workspace.json` is rebuilt from the identity record. Read-only commands never do this. | Expect a one-line stderr note; it is not an error. |

---

## 2. Orientation (read-only; run these first)

```text
sigma project status          # lifecycle, artifacts, gates of the project
sigma intent list             # every chain and its state
sigma intent status           # the active chain
sigma doctor --check-assets   # master / host / project asset comparison, no writes
git status --short            # is the working tree clean?
```

From the output, record and report to the Director:

1. **Active chain** and the state of each chain (DRAFT / RATIFIED / BUILD / CLOSED / SUPERSEDED).
2. **Lifecycle model** of the chain you will work in: legacy (`legacy_lock`) or `paired_approval`. `sigma plan status` prints `lifecycle_model` and, for a legacy chain, the warning that revision evidence is not required.
3. **Asset status** from `doctor --check-assets`: the lines beginning `[master-host]`, `[host-project]`, `[master-project]`, `[master-installed]`, and the `Version:` line with its `status:`.
4. **Git state**: number of changed files and whether any are under `Sigma/`.

---

## 3. Recommended operating sequence in an existing project

Follow in order. "STOP" means do nothing further until the Director answers.

| # | Step | Command / action | Writes? | Gate |
|---|---|---|---|---|
| 1 | Orient | Section 2 | No | — |
| 2 | Classify asset state | Use the table below | No | — |
| 3 | Report | Summarize state, differences, and a **recommendation**, then ask the Director for the decisions in step 4–6 | No | STOP |
| 4 | Sync project assets (if needed) | Section 3.2 | Yes | Director approval |
| 5 | Re-read what changed | Section 3.3 | No | — |
| 6 | Decide the old chain's fate | Section 3.4 | Possibly | Director decision |
| 7 | Continue work | Existing chain (3.5) or new INTENT (section 4) | Yes | Per role rule |

### 3.1 Classify the asset state (step 2)

The `Version:` line of `sigma doctor --check-assets` ends with a `status:` value. The CLI evaluates it in this order, so the first match wins:

| `status:` | Other signal | State | What it means | Action |
|---|---|---|---|---|
| `host_unknown` or `host_outdated` | `[master-host]` / `[master-installed]` differences; "global installation … not found / no version stamp / behind the installed CLI" | **A. Host behind master** | The global install was not refreshed | STOP. Tell the Director to run `sigma setup update` (host-level; for `host_unknown` with "not found", `sigma setup install`). Do not sync the project. |
| `project_unknown` or `project_outdated` | `[host-project]` / `[master-project]` differences; "project … is behind ~/.sigma" or "has no version stamp" | **B. Project behind host** | Normal case after a global update | Go to 3.2 after the Director approves. |
| `current` | No differences | **C. Current** | Project is up to date | Skip to step 6. |

Because host problems are evaluated first, a project can only be reported as `project_*` when the host is current. If you see `host_*`, the project's own differences are not yet meaningful.

### 3.2 Sync the project's assets (step 4; Director approval required)

1. Make sure the project's working tree is clean or that you and the Director understand every pending change. Sync never stages or commits; Git is the only safety net.
2. Dry run: `sigma project sync`. It lists each managed file and every DIFF with an acceptance token. Show it to the Director.
3. Apply non-conflicting files: `sigma project sync --confirm`.
4. For each DIFF the Director approves: `sigma project sync --confirm --accept <token>`, one `--accept` per file. A DIFF the Director does not approve stays untouched. `--accept` is rejected without `--confirm`.
5. Verify: `sigma doctor --check-assets` again. Expect no `[master-project]` or `[host-project]` differences, except files the Director deliberately kept.
6. Do not stage or commit unless asked. Report the list of files that changed.

Expected content change: `SIGMA_PROTOCOL.md`, ARC/AUD/FMN rules, DIR-INTENT and DIR-CLOSE templates, the new PRODUCT-REVIEW template, ARC/AUD/FMN role memory, both registries, and the bridge files (AGENTS/CLAUDE/GEMINI, each behind its own token).

Side effects of `--confirm` (so they are not a surprise):

- upserts the `sigma` entry in the project's `.mcp.json` and `opencode.json(c)`;
- **rewrites the global `~/.codex/config.toml` and `~/.gemini/config/mcp_config.json` `sigma` entry to point at this project** (last project synced wins). If several projects are synced in a row, tell the Director the global entry now points at the last one; `sigma setup update` resets it to discovery mode;
- creates an empty `CHANGE-RECORD.md` only if none exists in the root or `dev/`;
- writes the version stamp into `Sigma/activate_status.json` (since 2.2.0; not the identity file) only when every managed file then matches, and removes a stamp that an older version left on `.sigma-identity.json`;
- re-asserts the gitignore block only when the project explicitly chose `on` (a project that never ran `sigma config set gitignore` is left alone);
- backs up replaced files under `~/.local/share/sigma/sync-backups/`.

### 3.3 Reload what you rely on (step 5)

Your instructions come from project files that the sync may have just replaced. After a sync, in this session:

1. Re-read your role rule: `Sigma/rules/<ROLE>-RULE.md` (ARC, FMN, DEV, or AUD).
2. Re-load your role memory: `sigma memory --<role>` (read-only).
3. If you are an AI tool whose skills were refreshed by `sigma setup update`, the Director must **restart the session** so the new skills load.
4. Do not rely on any earlier statement about the protocol that came from before the sync.

### 3.4 Decide the old chain's fate (step 6; Director decision, one project at a time)

If the Director plans a **new INTENT** for this project (to restate the mandate under the new definition), the old chain is not removed. Options:

| Option | Command | Effect |
|---|---|---|
| Keep as history, leave open | none | Stays as is; working in it later needs `sigma intent activate --v <chain>` |
| Finish and close it | normal lifecycle: `sigma review new` → `sigma close check` → `sigma close new` → `sigma close lock` | Chain ends CLOSED |
| Retire it | `sigma intent supersede --v <chain> --reason "<why>" --director-confirm` | SUPERSEDED cascades to its ROADMAP, PLAN, EXEC, CLOSE |

Do not choose for the Director. Report any open PLAN/EXEC work in a chain you will stop operating. Do not leave a DRAFT or half-finished chain unmentioned.

### 3.5 Continuing inside an existing legacy chain

You may keep working in a legacy chain if the Director decides so. Remember:

- `plan approve` / `exec approve` behave as the old lock (state LOCKED). The behavior in section 1.1 (PRODUCT REVIEW, no score, `close lock` gate) already applies to it.
- A schema-5 INTENT keeps its schema; an amendment does not upgrade it. Restating it under schema 6 is a new INTENT (section 4), or `sigma intent clone` as a draft base, reviewed by the Director.
- Role rules now speak the new vocabulary. Where a legacy artifact uses old wording (for example a score field), it is historical; do not act on it.

---

## 4. Starting a clean INTENT (new-chain workflow)

Prerequisite: section 3 is done for this project (state C).

| Step | Role | Command / action | Authority |
|---|---|---|---|
| 1 | ARC | `sigma intent new --title "<t>" --focus "<f>"` | Draft. Creates and **activates** an isolated chain. |
| 2 | ARC + Director | Interview and draft INTENT (schema 6) | Director owns the destination |
| 3 | ARC | `sigma intent check` until `Lock readiness: Eligible` | Read-only |
| 4 | AUD (optional) | Audit; ARC transcribes the verdict exactly | `SKIP_FOR_AUDIT` only on explicit Director instruction |
| 5 | Director | Approve `sigma intent ratify` | Approval |
| 6 | ARC | Message FMN: `sigma send --from arc --to FMN ... --related-artifact "INTENT-vN"` | Mandatory trigger |
| 7 | FMN | ROADMAP, then `sigma plan new` | Draft |
| 8 | DEV | `sigma exec new` (needs an approved PLAN) | Draft |
| 9 | Director | `sigma plan approve` / `sigma exec approve` (preview first) | Approval |
| 10 | Director → ARC | States the final product is ready; ARC runs `sigma review new` | One PRODUCT REVIEW per INTENT |
| 11 | ARC, AUD, Director | Verdicts recorded, append-only; PASS is permanent | Independent |
| 12 | ARC | `sigma close check`, then `sigma close new` | Gate 3 + accepted verdicts |
| 13 | Director | `sigma close lock` | Approval |

---

## 5. What you may and may not run

| Class | Commands |
|---|---|
| Read-only (free to run when relevant) | `sigma doctor --check-assets`, `sigma project status`, `sigma intent status|list|check`, `sigma intent amendment preview`, `sigma intent baseline check`, `sigma plan status|list|check`, `sigma exec status|list|check`, `sigma close status|check`, `sigma review check`, `sigma inbox`, `sigma memory --<role>`, `sigma report …`, `sigma git evidence` |
| Draft / operational (your role only, per its rule) | `sigma intent new`, `sigma plan new`, `sigma exec new`, `sigma review new`, `sigma close new`, `sigma send`, `sigma memo write`, `sigma notes new` |
| **Director approval required** | `sigma intent ratify`, `sigma plan approve`, `sigma exec approve`, `sigma close lock`, `sigma intent amendment`, `sigma intent baseline adopt`, `sigma intent supersede`, `sigma override`, `sigma config set gitignore on|off` (changes the Git index and, for other clones, what a pull deletes), `sigma config set origin-machine` (writes the Git-tracked identity file), `sigma project sync --confirm [--accept]`, `sigma doctor` with any reconciling flag, `sigma setup install|update|uninstall` |

Behavior rules:

- Plan first, execute second. State the plan and wait for explicit approval before anything multi-step or outward-facing. "OK", "noted", or "go ahead" in passing is not approval for a high-impact action.
- Sigma documents (rules, templates, protocol) are English. Do not paste other-language prose into them; translate it.
- Do not edit `progress-v*.json`, `activate_status.json`, or `.sigma-identity.json` by hand.
- Verify a claim against a file or command output before you state it; mark anything unverified as an inference.
- When something does not match this guide, stop and report instead of adapting silently.

---

## 6. Troubleshooting by signal

| You see | Cause | Do |
|---|---|---|
| "host is behind the installed CLI" | Global install not refreshed | State A in 3.1. Report; Director runs `sigma setup update`. |
| "project … is behind ~/.sigma" or "no version stamp" | Project copies stale | State B. Dry-run, then ask approval. |
| `sigma close new` refuses: no accepted PRODUCT REVIEW | Required verdicts not PASS/PASS_WITH_RISK | `sigma review check`; see which party's verdict is missing. Do not edit a verdict that is not yours. |
| `sigma close lock` refuses | Gate 3 not satisfied (a PLAN or EXEC is still open) | `sigma plan status`, `sigma exec status`; resolve or supersede with Director approval. |
| `sigma plan lock` / `exec lock` / `intent lock` | Removed commands | Use `approve` / `ratify`. |
| `sigma intent new` says the active chain is CLOSED | Pre-flight guard | Confirm with the Director; `--yes` skips the prompt only when the Director said so. |
| Commands act on a chain you did not expect | Active chain changed (`intent new` or `intent activate`) | `sigma intent list`; `sigma intent activate --v <chain>` only with the Director's knowledge. |
| `sigma send` rejects the artifact reference | Missing/unknown `--related-artifact` | Use a registered artifact of the active INTENT, or `GENERAL` explicitly. Never substitute silently. |
| Changelog was not recorded because … | F17 guard on `CHANGE-RECORD.md` | Fix the file manually, then resolve; do not re-run blindly. |
| `[SIGMA BLOCKED — MISSING LOCAL SIGMA FILES]` | This clone holds only `.sigma-identity.json`; the project's Sigma files are not in Git (gitignore on). The message says which machine registered the project, or that none was recorded. | Stop. Report to the Director, quoting the machine line. The way forward is on the original machine (1.8); do not re-register. If the message says this machine IS the origin, the files were lost here: restore from backup or Git history. |
| `sigma intent amendment` says `--commit is not used` / `--commit is required` | Mode mismatch (snapshot vs Git) | Read `Mode:` from `sigma intent amendment preview`; use the matching form (1.3). |
| `sigma intent baseline check` fails `intent_tracked` | A Git-baseline chain whose INTENT is no longer tracked | Report; the Director decides on `sigma intent baseline adopt --v <chain> --director-confirm` (1.3). |
| Codex/Antigravity MCP answers about the wrong project | Global entry is pinned to the last synced project | Report; Director runs `sigma setup update` or re-syncs the intended project last. |

---

## 7. Known caveats

- **This guide is not a managed Sigma asset.** The global copy is `~/.sigma/SIGMA-V2-CLEAN-OPERATION-GUIDE.md`; any project copy is placed there manually by the Director. `sigma setup update` leaves the global copy alone, `sigma doctor --check-assets` and the version stamp ignore it, and `sigma setup uninstall --confirm` removes it with the rest of `~/.sigma/`. Copies are refreshed by hand, so if a copy and the master version differ, say so to the Director instead of choosing one.
- `sigma setup update` creates its own timestamped backup under `~/.sigma/backups/` on every run; these accumulate and their removal is a Director decision.
- `sigma setup uninstall --confirm` deletes the whole `~/.sigma/` including `~/.sigma/backups/`. It is not a refresh; `setup update` already removes retired assets by an explicit list.
- A file in `~/.sigma/templates` that the package does not ship is kept, and `project sync` copies it into projects.
- `sigma-mcp` with no arguments runs in discovery mode. **[Inference]** It binds to the project the client reports; not tested end to end.
- `sigma close new --ack-stale-intent` never existed in the CLI. Older copies of the Reasonix bridge (`REASONIX.md`) listed it as a command needing authorization; the shipped bridge no longer does. A project that still carries it receives the fix through `sigma project sync`. It is harmless.
- User-written permission patterns in an AI tool's own config (for example `ask` lists in `~/.reasonix/config.toml`) are not owned by Sigma. `sigma plan lock`, `sigma exec lock`, and `sigma intent lock` are retired; their replacements are `plan approve`, `exec approve`, and `intent ratify`.

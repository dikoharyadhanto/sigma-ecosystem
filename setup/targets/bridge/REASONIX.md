# Reasonix — Sigma Ecosystem Integration

## Ownership

This file bridges Reasonix with the Sigma ecosystem.
Primary doctrine for DeepSeek/Reasonix: `DEEPSEEK.md` at the project root.

## Primary Doctrine

Follow `DEEPSEEK.md` above all other project-level rule files.
Do not read CLAUDE.md, GEMINI.md, or AGENTS.md unless the Director explicitly
requests it.

## Sigma Shell Whitelist

The following commands are safe to run without Director authorization:

```
sigma --help
sigma project status
sigma intent status
sigma roadmap list
sigma plan status
sigma exec status
sigma close status
sigma git evidence
sigma intent check
sigma plan check
sigma exec check
sigma close check
sigma roadmap check
sigma notes list
sigma notes update --dry-run
sigma notes new --title "<title>"
```

The following commands require explicit Director authorization before running:

```
sigma intent ratify
sigma plan approve
sigma exec approve
sigma close lock
sigma close new --ack-stale-intent
sigma * supersede
sigma notes update
sigma notes update --rebuild-registry --director-confirm
```

## CLI Operator Model

Do not ask the Director to manually run Sigma commands when you can run them
through available tooling. Identify the command, state whether it requires
authorization, ask, then execute only after authorization when required.

Before recommending or running any lock command, run the matching
`sigma {domain} check` first and confirm it reports `Lock readiness:
Eligible` (or `Eligible with warnings`). `check` is on the whitelist above —
it never requires Director authorization. If `check` reports `Not
eligible`, resolve the unsatisfied Lock Requirements shown in its output
before recommending lock.

When explicitly operating as a Sigma governance role, load role memory if
available and follow the matching `Sigma/rules/{ROLE}-RULE.md`. Do not treat
`sigma session bootstrap` as mandatory for every role; run it only when the
role rule, Director request, or direct runtime evidence chain requires it.

## MCP Orientation Layer (read-only)

When a `sigma-mcp` client is configured, the tools `sigma_get_state`,
`sigma_get_gates`, `sigma_get_orientation`, `sigma_list_artifacts`, and
`sigma_doctor` return the same read-only orientation data as the whitelist
commands above, as structured JSON instead of CLI stdout. CLI remains the
sole authority for every write, gate, or lock operation — MCP tools never
lock, supersede, or mutate state.

## Notes

Do not edit `Sigma/notes-registry.json` or `Sigma/notes/note-list.md`; `sigma notes` manages both.

Notes (`Sigma/notes/`):

- Create a note only with `sigma notes new --title "<title>"`; never create a `.md` file directly under `Sigma/notes/` (it would not be registered, and `sigma notes update` would move it to `unregistered-notes/`).
- A role may create a note without prior approval for a memo attachment, an output of its own PLAN/EXEC task, or an important note on its own initiative (report the note ID and path in the same response). The Director's explicit instruction always suffices.
- A note is free-form, independent, and non-authoritative. It never replaces an artifact: conclusions and claims that matter belong in the artifact itself. An artifact may cite a note by ID and path; a note does not cite or depend on an artifact.
- `sigma notes update --dry-run` is free for any role. Run `sigma notes update` for real only on the Director's instruction.

## Director Authorization Language

Sufficient: "approved", "lock it", "I approve this plan", "go ahead", "run it"
Ambiguous (not sufficient for lock/risk): "okay", "noted", "makes sense"

If authorization is unclear, ask before executing.

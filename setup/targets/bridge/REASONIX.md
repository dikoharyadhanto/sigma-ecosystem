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
sigma project list
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
```

The following commands require explicit Director authorization before running:

```
sigma intent lock
sigma roadmap activate
sigma plan lock
sigma exec lock
sigma close lock
sigma close new --ack-stale-intent
sigma * supersede
sigma project reset
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

## Director Authorization Language

Sufficient: "approved", "lock it", "I approve this plan", "go ahead", "run it"
Ambiguous (not sufficient for lock/risk): "okay", "noted", "makes sense"

If authorization is unclear, ask before executing.

## Memory Isolation

`~/.sigma/memory_sigma.jsonl` is Sigma ecosystem-level only.
Do not store project-specific facts or session context there.

# Sigma Personal Language Preference Note

## Purpose

This note defines a **personal Director preference** for writing Sigma project documents in Bahasa Indonesia.

This is **not** a global Sigma Ecosystem rule.

Sigma’s public/default language remains English.

---

## Director Preference

For Diko’s own Sigma projects, Sigma document prose may be written in **Bahasa Indonesia** to reduce reading fatigue and improve review speed.

This preference applies to human-readable prose inside Sigma documents, reports, messages, and notes.

It does **not** change Sigma’s formal identifiers, artifact names, CLI commands, runtime states, filenames, or machine-readable fields.

Control sentence:

```text
Translate the prose, not the protocol.
```

---

## Default Language Policy

| Scope | Language |
| :--- | :--- |
| Public Sigma Ecosystem default | English |
| Diko’s personal project document prose | Bahasa Indonesia |
| Formal Sigma identifiers | English / unchanged |
| CLI commands | English / unchanged |
| Runtime states | English / unchanged |
| JSON keys / registry fields | English / unchanged |
| Filenames | English / unchanged |

---

## What May Use Bahasa Indonesia

The following content may be written in Bahasa Indonesia:

- objective explanation,
- scope explanation,
- constraint explanation,
- risk notes,
- findings,
- recommendations,
- implementation summaries,
- test descriptions,
- Director notes,
- closure summaries,
- `/report` body,
- CSO narrative,
- mailbox message body,
- role discussion notes.

Example:

```markdown
## Scope

Project ini hanya mencakup pembuatan workflow dasar untuk validasi intent, plan, execution, dan closure. Integrasi eksternal tidak termasuk dalam scope build pertama.
```

---

## What Must Stay Unchanged

The following must remain in formal Sigma language:

- `DIR-INTENT`
- `ROADMAP`
- `FMN-PLAN`
- `DEV-EXEC`
- `DIR-CLOSE`
- `CSO`
- `DRAFT`
- `LOCKED`
- `SUPERSEDED`
- `BUILDING`
- `TESTING`
- `COMPLETED`
- `sigma intent lock`
- `sigma plan new`
- `sigma exec advance testing`
- file names,
- JSON keys,
- registry fields,
- section anchors used by CLI/parser,
- any machine-readable or command-related syntax.

Example:

```markdown
# FMN-PLAN

## Build Objective

Membangun validasi awal untuk role mailbox agar pesan antar-role dapat dikirim, dibaca, dan ditampilkan di session bootstrap.

## Advisory Verdict

READY_FOR_BUILD
```

`Build Objective` content may be Indonesian. `FMN-PLAN` and `READY_FOR_BUILD` remain unchanged.

---

## Recommended Project Config

If Sigma supports project-level preferences, use:

```json
{
  "document_language": "id",
  "interaction_language": "id",
  "formal_identifier_language": "en"
}
```

Recommended location:

```text
Sigma/project.config.json
```

This preference should be displayed during session bootstrap.

Example bootstrap output:

```text
Project Preferences:
- Document language: Bahasa Indonesia
- Interaction language: Bahasa Indonesia
- Formal Sigma identifiers: English / unchanged
```

---

## Recommended Bootstrap Reminder

AI roles should treat this as a project/session preference, not a universal rule.

Recommended bootstrap reminder:

```text
Director language preference detected:
Write Sigma document prose in Bahasa Indonesia.
Keep Sigma artifact codes, CLI commands, filenames, state names, and machine-readable fields unchanged.
```

---

## Rule for AI Roles

When drafting or editing Sigma artifacts for Diko’s personal project:

1. Write prose content in Bahasa Indonesia unless the Director asks otherwise.
2. Keep Sigma artifact codes and formal terms unchanged.
3. Keep CLI commands unchanged.
4. Keep runtime states unchanged.
5. Do not translate filenames or JSON fields.
6. If uncertain whether a field is machine-readable, keep it in English.
7. If the Director switches language preference for a specific document or session, follow the latest explicit instruction.

---

## Non-Goal

This note does **not** mean Sigma Ecosystem should default to Bahasa Indonesia.

This note does **not** require public README, protocol, templates, or role files to be Indonesian by default.

This note does **not** change Sigma’s naming convention or CLI language.

---

## Final Doctrine

Sigma’s default public language remains English.

Diko’s personal Sigma documents may use Bahasa Indonesia for readability.

Formal Sigma identifiers remain stable.

```text
Document content follows Director preference.
Sigma identifiers remain stable.
```

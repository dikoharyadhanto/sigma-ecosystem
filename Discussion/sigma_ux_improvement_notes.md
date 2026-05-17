# Catatan Perbaikan UX Sigma

## Ringkasan

Sigma sudah memiliki fondasi governance yang kuat: AI role mengoperasikan CLI, CLI menegakkan gate, artifact menyimpan bukti, dan Director tetap menjadi otoritas approval. Masalah utama bukan kompleksitas doctrine itu sendiri, melainkan bagaimana kompleksitas tersebut ditampilkan kepada Director.

Perbaikan utama yang disarankan:

> Tampilkan makna manusia terlebih dahulu, lalu tampilkan kode artifact formal sebagai referensi governance.

Format inti:

```text
Human Meaning (Formal Artifact Code)
```

Contoh:

```text
Intent Doc (DIR-INTENT)
Plan Doc (FMN-PLAN)
Execution Evidence (DEV-EXEC)
Closure Doc (DIR-CLOSE)
Roadmap Doc (ROADMAP)
Context Handoff (CSO)
```

---

## 1. Prinsip UX Utama

Sigma sebaiknya diposisikan sebagai:

> AI-operated governance runtime under human authority.

Artinya:

- Director tidak perlu menghafal seluruh command Sigma.
- AI role membaca protocol, artifact, gate, dan runtime state.
- CLI menegakkan aturan lifecycle dan authorization.
- Director hanya membuat keputusan authority: approve, reject, revise, accept risk, supersede, close.

Formula UX:

```text
Human sees decisions.
AI handles procedure.
CLI enforces doctrine.
Artifacts preserve trace.
```

---

## 2. Jangan Hilangkan Kode Artifact

Kode seperti `DIR-INTENT`, `FMN-PLAN`, `DEV-EXEC`, dan `DIR-CLOSE` tidak perlu dihilangkan.

Kode tersebut penting untuk:

- traceability,
- audit,
- cross-agent handoff,
- artifact reference,
- CLI operation,
- debugging governance state.

Yang perlu diperbaiki adalah urutan penyajiannya.

Buruk:

```text
DIR-INTENT v1 [LOCKED]
FMN-PLAN v1 [LOCKED]
DEV-EXEC v0.1 [LOCKED]
DIR-CLOSE v1 [LOCKED]
```

Lebih baik:

```text
Intent Doc (DIR-INTENT v1) [LOCKED]
Plan Doc (FMN-PLAN v1) [LOCKED]
Execution Evidence (DEV-EXEC v0.1) [LOCKED]
Closure Doc (DIR-CLOSE v1) [LOCKED]
```

---

## 3. Recommended Artifact Labels

| Director-facing label | Formal artifact code | Meaning |
|---|---|---|
| Intent Doc | `DIR-INTENT` | Tujuan, scope, constraints, success definition |
| Plan Doc | `FMN-PLAN` | Work contract dan test contract sebelum build |
| Execution Evidence | `DEV-EXEC` | Implementasi, hasil test, evidence, known issues |
| Closure Doc | `DIR-CLOSE` | Keputusan final bahwa cycle selesai |
| Roadmap Doc | `ROADMAP` | Staging besar untuk work cycle berikutnya |
| Context Handoff | `CSO` | Snapshot konteks session untuk continuity |

Catatan: `DEV-EXEC` sebaiknya ditampilkan sebagai **Execution Evidence**, bukan hanya **Execution Doc**, karena nilai utamanya adalah bukti bahwa pekerjaan dilakukan dan diuji.

---

## 4. Pola Penyajian di `/report`

`/report` adalah fitur UX paling penting untuk Director. Ia sebaiknya diposisikan sebagai orientation layer utama, bukan sekadar utility shortcut.

### Tujuan `/report`

Menjawab:

```text
Apa yang Director perlu tahu sekarang?
```

Bukan:

```text
Apa seluruh detail internal runtime Sigma?
```

### Struktur ideal `/report`

```text
Sigma Briefing — {project_name}
Date: {date}
Verdict: {plain-English state}

Current State
- Lifecycle: {phase}
- Locked evidence chain: {human labels + artifact codes}
- Open blockers: {none / list}

What this means
{1–3 kalimat konsekuensi praktis untuk Director}

Recommended next move
{1 rekomendasi utama}

Director options
1. {primary action phrase}
2. {secondary option}
3. {deeper inspection option}

Technical notes
{hanya jika relevan atau jika ada risiko}
```

---

## 5. Contoh `/report` yang Direvisi

```text
Sigma Briefing — sigma-ecosystem
Date: Sunday, 17 May 2026

Verdict:
Previous cycle is CLOSED. Sigma is ready for a new objective.

Current State
- Lifecycle: CLOSED
- Locked evidence chain:
  Intent Doc (DIR-INTENT v1)
  → Plan Doc (FMN-PLAN v1)
  → Execution Evidence (DEV-EXEC v0.1)
  → Closure Doc (DIR-CLOSE v1)
- Roadmap Doc (ROADMAP v1) is locked.
- No active blockers detected.

What this means
The previous work cycle has been formally closed with locked intent, plan, execution evidence, and closure record.
Sigma should not continue building under the old objective unless the Director explicitly opens a new cycle.

Recommended next move
Activate ARC and define the Seed Intent for the next cycle.

Director options
1. "Activate ARC. New intent: [objective]."
2. "Review Roadmap Doc (ROADMAP v1) and suggest the next candidate task."
3. "Give me deeper status on the locked artifacts."

Technical notes
- Recent Context Handoff (CSO): CSO-ANON-20260516-2004.md, CSO-DEV-20260516-2004.md
- Governance role files and memory appear initialized.
- Agent must not directly modify Sigma/progress.json.
```

---

## 6. Information Hierarchy Rule

Gunakan urutan ini di semua prompt Director-facing:

```text
1. Meaning
2. Artifact code
3. CLI command
```

### Example: status output

Baik:

```text
Intent Doc (DIR-INTENT v1) [LOCKED]
```

Kurang baik:

```text
DIR-INTENT v1 [LOCKED]
```

### Example: approval prompt

Baik:

```text
You are approving the Intent Doc (DIR-INTENT v1).

Consequence:
BUILD may begin after this lock.
```

Kurang baik:

```text
Run sigma intent lock?
```

### Example: gate block

Baik:

```text
Build cannot start yet.
Reason: the Intent Doc has not been locked.
Required artifact: DIR-INTENT.
```

Kurang baik:

```text
Gate 1 blocked: DIR-INTENT must be LOCKED before FMN-PLAN can be created.
```

CLI boleh tetap memberi error teknis. AI role wajib menerjemahkannya ke bahasa Director-facing.

---

## 7. `/report` Sebagai Primary Director Interface

Saat ini `/report` tidak boleh diposisikan hanya sebagai fitur tambahan. Secara UX, `/report` adalah jembatan utama antara governance doctrine dan kontrol manusia.

Saran positioning README:

```text
When lost, type /report.
Sigma will tell you the current state, open risks, and the next valid move.
```

Versi lebih tegas:

```text
You do not inspect Sigma manually.
You ask /report.
```

Tempatkan `/report` lebih awal di README, dekat Quick Start.

---

## 8. Prompt Interaktif: Jangan Dihapus, Tapi Diturunkan Prioritasnya

Interactive prompt teknis tetap berguna, terutama untuk AI operator dan advanced users. Namun untuk Director, prompt harus decision-first.

### Buruk

```text
Next Operations:
- sigma intent new
- sigma roadmap new
```

### Lebih baik

```text
Recommended next move:
Activate ARC and define the Seed Intent for the next cycle.

Operational command:
sigma intent new

Authority:
Operational command; AI may run within ARC workflow.
```

Director melihat keputusan dahulu. Command tetap tersedia sebagai evidence/procedure.

---

## 9. Approval Prompt Standard

Untuk semua approval-class operation, gunakan format:

```text
You are approving:
- {Human Label} ({Artifact Code + Version})
- Scope: {summary}
- Exclusions: {summary}
- Evidence required: {summary}
- Known risks: {summary}

Consequence:
{what becomes allowed after approval}

Authority required:
Explicit Director approval.

To approve, say:
"Approved. Lock it."
```

Contoh:

```text
You are approving:
- Intent Doc (DIR-INTENT v1)
- Scope: Sigma UX improvement cycle
- Exclusions: CLI command redesign, protocol rewrite
- Evidence required: updated README copy and validated /report output
- Known risks: terminology may still feel heavy for new users

Consequence:
BUILD planning may begin after this lock.

Authority required:
Explicit Director approval.

To approve, say:
"Approved. Lock it."
```

---

## 10. Gate Block Message Standard

Gunakan format:

```text
{Action} cannot start yet.

Reason:
{plain-English reason}

Required next step:
{human action}

Formal gate:
{gate name and artifact code}
```

Contoh:

```text
Build planning cannot start yet.

Reason:
The Intent Doc has not been locked.

Required next step:
Review and approve the Intent Doc.

Formal gate:
Gate 1 — DIR-INTENT must be LOCKED before FMN-PLAN can be created.
```

---

## 11. README Improvement Suggestions

Tambahkan bagian awal:

```markdown
## You Do Not Operate Sigma Manually Most of the Time

Sigma is designed to be operated by AI roles under your authority.

You give intent and approval.
AI roles operate the workflow.
Sigma CLI enforces gates.
Artifacts preserve proof.

When lost, type:

/report
```

Tambahkan juga table istilah:

```markdown
## Human Labels and Formal Artifacts

| What you see | Formal artifact | Purpose |
|---|---|---|
| Intent Doc | DIR-INTENT | Objective, scope, constraints |
| Plan Doc | FMN-PLAN | Build contract and test contract |
| Execution Evidence | DEV-EXEC | Implementation report and proof |
| Closure Doc | DIR-CLOSE | Final closure decision |
| Roadmap Doc | ROADMAP | Optional staging map |
| Context Handoff | CSO | Session continuity |
```

---

## 12. Final Recommendation

Jangan kurangi doctrine Sigma. Doctrine adalah kekuatan utama.

Yang harus dikurangi adalah exposure doctrine kepada Director pada momen yang tidak perlu.

Final rule:

```text
Doctrine stays strong.
Director interface stays simple.
AI role performs translation.
CLI enforces boundaries.
```

Atau dalam bentuk operasional:

```text
Meaning first.
Artifact code second.
Command third.
```

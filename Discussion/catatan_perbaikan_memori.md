# Catatan Perbaikan Memori Sigma

**File**: `catatan_perbaikan_memori.md`  
**Purpose**: Catatan desain untuk implementasi role memory JSON Sigma.  
**Status**: Draft keputusan hasil diskusi.  
**Context**: Perbaikan ini ditujukan untuk pemakaian personal Sigma agar AI role lebih fokus, patuh, dan tidak melebar saat activation/bootstrap.

---

## 1. Latar Belakang

Sigma sudah memiliki `*-RULE.md` untuk setiap role, tetapi rule file tersebut berfungsi sebagai **aturan lengkap**. Dalam praktik, AI role kadang tetap mengalami masalah:

- membaca terlalu banyak konteks;
- melakukan over-check / over-inspection;
- tidak jelas sedang mengerjakan apa;
- lupa stop point;
- bertanya untuk langkah yang seharusnya otomatis;
- otomatis berjalan terlalu jauh pada langkah yang seharusnya berhenti;
- membaca artifact historis yang tidak diminta;
- compliance berbeda-beda tergantung model AI.

Karena itu dibutuhkan **role memory JSON** sebagai ringkasan operasional pendek.

---

## 2. Tujuan Role Memory JSON

Role memory JSON bukan pengganti rule file.

Perbedaannya:

| File | Fungsi |
| :--- | :--- |
| `*-RULE.md` | Full law / aturan lengkap role |
| `*-memory.json` | Operating cue / checklist pendek perilaku role |

Role memory menjawab:

> Dalam 30 detik pertama role aktif, apa yang paling tidak boleh dilupakan AI?

Role memory harus menjadi **behavioral compression layer**, bukan mini-protocol baru.

---

## 3. Prinsip Desain

### 3.1 Reminder-only

Role memory tidak memiliki authority lebih tinggi dari rule, protocol, runtime state, atau Director instruction.

Wajib ada authority note:

```json
"authority": "Reminder only. Role rules, Sigma protocol, CLI output, runtime state, locked artifacts, and Director instructions override this file."
```

### 3.2 Tidak boleh memicu pembacaan artifact `.md`

Role memory tidak boleh berisi referensi artifact file tertentu seperti:

```text
Read FMN-PLAN-v1.12.md
Read ROADMAP-v1.md
Read DEV-EXEC-v1.12.md
```

Alasannya: ini akan memicu AI membaca ulang artifact dan membuat konteks melebar.

Yang boleh adalah instruksi berbasis runtime:

```text
Use the locked plan selected by Sigma runtime.
Use the active roadmap selected by Sigma runtime.
Use artifact versions reported by Sigma CLI.
```

### 3.3 Rule file reference boleh sebagai fallback

Referensi ke role rule file masih boleh, tetapi hanya sebagai fallback ketika:

- role boundary ambigu;
- Director approval ambigu;
- runtime state konflik;
- task keluar dari normal lifecycle;
- terjadi edge case.

### 3.4 Pendek, tegas, imperatif

Setiap command sebaiknya:

- satu kalimat;
- tidak naratif;
- tidak berisi rationale panjang;
- tidak berisi edge case langka;
- langsung mengatur perilaku.

---

## 4. Command CLI yang Diusulkan

Command yang diusulkan:

```bash
sigma memory --arc
sigma memory --fmn
sigma memory --dev
sigma memory --aud
```

Output command menampilkan role memory sesuai role.

File yang diusulkan:

```text
Sigma/role-memory/arc-memory.json
Sigma/role-memory/fmn-memory.json
Sigma/role-memory/dev-memory.json
Sigma/role-memory/aud-memory.json
```

Catatan: folder `role-memory` lebih disarankan daripada `memory`, agar tidak tercampur dengan sistem memory historis lama.

---

## 5. General Rules — Approved

General rules berlaku untuk semua role.

```json
{
  "general": [
    "Use Sigma CLI for all runtime operations; never edit progress.json manually.",
    "Respect Director intent and decisions as the highest project authority within Sigma boundaries.",
    "Maintain independent judgment; state agreement, doubt, disagreement, or ambiguity clearly.",
    "Use Sigma messaging for all formal role-to-role communication; never bypass it.",
    "Ask explicit Director approval before locks, risk acceptance, supersession, closure, or authority-sensitive actions.",
    "Stay within the direct evidence chain; stop and ask before expanding investigation scope."
  ]
}
```

### Catatan penting

Rule terakhir dibuat untuk mengontrol over-inspection.

Maksudnya bukan melarang recheck. Recheck tetap valid jika masih berada dalam direct evidence chain.

Yang dilarang adalah silent scope expansion, misalnya:

- mulai mencari masalah baru;
- hipotesis berubah tanpa melapor;
- membaca artifact historis tanpa diminta;
- scan banyak file/subsystem saat masalah awal masih sempit;
- terus menggali karena “mungkin ada hal lain”.

Jika investigasi mulai melebar, role harus berhenti dan bertanya ke Director.

---

## 6. DEV Memory — Approved

DEV adalah execution role. Saat DEV dipanggil, DEV tidak perlu bertanya apakah perlu membuka DEV-EXEC jika Gate 2 valid. DEV langsung mengikuti locked plan execution flow.

```json
{
  "role_specific": [
    "When DEV is called, immediately follow the locked plan execution flow without asking whether to open DEV-EXEC.",
    "Do not ask the Director to confirm routine DEV startup steps when Sigma gates already permit them.",
    "Study the locked FMN-PLAN selected by Sigma runtime before creating or filling DEV-EXEC.",
    "Create DEV-EXEC as the operational execution document when Gate 2 is valid.",
    "Fill the DEV-EXEC pre-implementation plan before writing material code.",
    "After pre-implementation planning, message FMN for review, then stop and report to Director.",
    "Do not begin material implementation until FMN review exists and Director explicitly approves implementation.",
    "Implement only within the locked FMN-PLAN scope and raise clarification if the plan is unclear.",
    "Record implementation results, deviations, verification, changed files, and limitations truthfully in DEV-EXEC.",
    "After implementation evidence is complete, message FMN for post-build review, then stop and report to Director."
  ]
}
```

### DEV flow

```text
DEV called
  ↓
Study locked FMN-PLAN
  ↓
Open DEV-EXEC
  ↓
Fill pre-implementation plan
  ↓
Send message to FMN requesting review
  ↓
STOP and report to Director
  ↓
Wait for FMN review + explicit Director approval
  ↓
Implement code
  ↓
Fill implementation result / evidence
  ↓
Send message to FMN for post-build review
  ↓
STOP and report to Director
```

DEV stop point utama hanya dua:

1. setelah pre-implementation plan + message FMN;
2. setelah implementation evidence + message FMN.

---

## 7. FMN Memory — Approved

FMN adalah planning router, build contract owner, dan review controller. FMN tidak otomatis langsung membuat plan saat dipanggil. FMN harus orientasi dulu dan berhenti untuk memberi Director pilihan.

```json
{
  "role_specific": [
    "When FMN is called, first run session orientation and roadmap listing before creating or changing any plan.",
    "After orientation, stop and brief the Director on pending plans, latest progress, active roadmap direction, and planning options.",
    "Do not create, promote, or lock a plan until the Director selects the next planning direction.",
    "Use the ACTIVE ROADMAP as the staging backbone for official FMN-PLAN work.",
    "Turn the Director-selected direction into a bounded FMN-PLAN with tasks, non-scope, constraints, acceptance criteria, and test contract.",
    "Treat AUD notes and reference files as advisory input unless Director explicitly selects them as planning scope.",
    "Do not invent requirements, success criteria, or scope beyond locked intent, roadmap direction, or Director-selected input.",
    "After FMN-PLAN is ready, stop and report to Director for approval, revision, or lock instruction.",
    "After FMN-PLAN is locked, send DEV a handoff message to open DEV-EXEC and complete pre-implementation planning.",
    "Review DEV pre-build plans and post-build evidence against FMN-PLAN, then request DEV revision or recommend Director decision."
  ]
}
```

### FMN flow

```text
FMN called
  ↓
session orientation
  ↓
roadmap listing
  ↓
brief Director:
  - pending plans
  - latest progress
  - active roadmap direction
  - planning options
  ↓
STOP
  ↓
Director selects planning route
```

Possible planning routes:

- promote pending plan;
- create next plan from specific intent breakdown;
- evaluate previous version;
- create plan from audit/reference notes;
- review DEV pre-build plan;
- review DEV post-build evidence.

FMN punya banyak stop point karena arah kerja FMN sangat bergantung pada Director.

---

## 8. AUD Memory — Approved

AUD adalah advisory-only role. AUD tidak membutuhkan memory panjang karena dari awal sudah sangat terisolasi.

```json
{
  "role_specific": [
    "Audit only the artifact, evidence, or scope explicitly requested by the Director.",
    "Treat AUD verdicts as advisory only; never approve, reject, lock, or mutate runtime state.",
    "Do not challenge Director sovereign intent; critique only the route, assumptions, evidence, plan, execution, or closure claim.",
    "State missing evidence, ambiguity, risk, contradiction, or false-closure concern clearly and proportionally.",
    "Send findings to ARC for intent review or FMN for plan review when Sigma messaging rules require it."
  ]
}
```

AUD memory total lebih pendek karena role ini tidak menjalankan workflow operation seperti FMN/DEV.

---

## 9. ARC Memory — Approved

ARC adalah intent intake and synthesis role. ARC tidak menjalankan `sigma session bootstrap` sebagai default dan tidak peduli progress project kecuali Director meminta. ARC tidak otomatis membuat DIR-INTENT saat dipanggil.

```json
{
  "role_specific": [
    "When ARC is called, stop immediately and ask whether the Director wants to open a new DIR-INTENT.",
    "Do not run session bootstrap, inspect progress, or read roadmap, plan, exec, or code unless explicitly asked.",
    "If the Director only wants discussion, clarify ideas without creating an intent document.",
    "When the Director expresses product, project, or major feature intent, offer to write it into DIR-INTENT.",
    "Create DIR-INTENT only after the Director explicitly agrees to open intent documentation.",
    "After opening DIR-INTENT, study the intent template and begin structured Director interview.",
    "Separate sovereign Director intent from challengeable route, assumptions, preferences, and implementation choices.",
    "Do not invent requirements, fake constraints, implementation details, or missing Director decisions.",
    "After AUD reviews intent, defend valid ARC reasoning, accept valid findings, and revise agreed points.",
    "After DIR-INTENT is locked, send FMN a handoff message with key intent notes for roadmap and planning."
  ]
}
```

### ARC flow

```text
ARC called
  ↓
STOP immediately
  ↓
Ask Director:
  "ARC aktif. Apakah Director berniat membuka DIR-INTENT baru?"
```

If Director says no:

```text
discussion mode only
no intent document created
ARC clarifies ideas conversationally
```

If Director starts expressing product/project/major feature intent:

```text
ARC detects intent signal
ARC offers to write it into DIR-INTENT
```

If Director agrees:

```text
sigma intent new
study intent template
structured interview
draft DIR-INTENT
AUD review
ARC defense/revision
Director lock
send FMN handoff message
```

---

## 10. Expected Effects

Jika role memory diterapkan:

- AI role activation lebih deterministik.
- AI lebih sedikit membaca konteks yang tidak perlu.
- Stop point lebih dipatuhi.
- Director tidak perlu terus menginterupsi.
- Perilaku antar-model lebih konsisten.
- DEV tidak bertanya untuk startup steps yang sudah jelas.
- FMN tidak langsung membuat plan sebelum orientasi.
- ARC tidak membaca progress/roadmap ketika hanya diminta membentuk intent.
- AUD tetap scoped dan advisory-only.

---

## 11. Risk If Not Implemented

Jika role memory tidak diterapkan, Sigma tetap berjalan tetapi beberapa masalah tetap muncul:

- role behavior bergantung terlalu besar pada kualitas model;
- AI membaca rule panjang tapi gagal mengambil perilaku paling penting;
- over-inspection tetap sering terjadi;
- Director tetap menjadi micro-manager;
- role sering lupa stop point;
- role bisa membaca artifact historis yang tidak diperlukan;
- DEV/FMN/ARC punya activation behavior yang tidak konsisten.

---

## 12. Core Rationale

`*-RULE.md` tetap diperlukan sebagai aturan lengkap. Namun rule file tidak cukup efektif sebagai operating cue singkat.

Analogi:

```text
RULE.md = manual lengkap
memory.json = cockpit checklist
```

Role memory JSON penting karena menjembatani gap antara:

```text
aturan tersedia
```

dan

```text
AI benar-benar berperilaku sesuai role saat session berjalan
```

---

## 13. Implementation Notes

Proposal name:

```text
P24 — Role Memory Summary
```

Recommended files:

```text
Sigma/role-memory/arc-memory.json
Sigma/role-memory/fmn-memory.json
Sigma/role-memory/dev-memory.json
Sigma/role-memory/aud-memory.json
```

Recommended CLI:

```bash
sigma memory --arc
sigma memory --fmn
sigma memory --dev
sigma memory --aud
```

Recommended behavior:

- Command prints general rules + role-specific rules.
- Command must not print artifact file paths.
- Command must not trigger artifact reading.
- Command should be usable during skill activation.
- Command output should remain short and deterministic.
- Role memory should be updated when role rules change materially.

---

## 14. Final Approved Counts

| Role | General Rules | Role-Specific Rules | Total |
| :--- | ---: | ---: | ---: |
| ARC | 6 | 10 | 16 |
| FMN | 6 | 10 | 16 |
| DEV | 6 | 10 | 16 |
| AUD | 6 | 5 | 11 |

---

## 15. Final Principle

Role memory must guide behavior, not expand context.

```text
Behavior first.
Runtime selects artifacts.
Rules handle edge cases.
Director owns authority.
```

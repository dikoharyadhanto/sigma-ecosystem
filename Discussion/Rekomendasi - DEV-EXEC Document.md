Untuk **DEV-EXEC**, kompresinya paling tepat:

```
DEV-EXEC = CDC-IMPL + CDC-WALK versi Sigma
```

Delta `CDC-IMPL` berisi pre-implementation plan: pendekatan teknis, files to modify, dependency changes, testing plan, risk, dan compliance terhadap work order.  
Delta `CDC-WALK` berisi walkthrough setelah implementasi: apa yang dibangun, file berubah, verification evidence, issues, residual risk, dan handoff ke QA.

Untuk Sigma, jangan bawa metadata runtime, approval gate formal, skill routing, NLM, atau command lifecycle ke template. `DEV-EXEC` cukup menjawab:

```
Apa pendekatan implementasinya?
Apa yang diubah?
Apa deviasi dari FMN-PLAN?
Apa hasil verifikasi developer?
Apa issue dan technical debt?
Apa evidence yang mendukung?
Apa status handoff kembali ke FMN/Director?
```

## Rekomendasi template `DEV-EXEC`

```
# DEV-EXEC

> Implementation approach, execution report, verification evidence, and developer walkthrough.

---

## 1. Source Plan Alignment

Summarize how this execution follows the locked FMN-PLAN.

- FMN task plan followed:
- Acceptance criteria targeted:
- Test contract referenced:
- Constraints respected:
- Known implementation boundary:

---

## 2. Implementation Approach

### What Will Be Built / Changed

[...]

### Technical Approach

[...]

### Rationale

Why this approach fits the FMN-PLAN and DIR-INTENT:

[...]

### Alternatives Considered

| Option | Reason Rejected / Deferred |
| :--- | :--- |
| [...] | [...] |

---

## 3. Files / Components To Change

| File / Component | Action | Purpose |
| :--- | :--- | :--- |
| [...] | Create / Modify / Delete | [...] |
| [...] | Create / Modify / Delete | [...] |

---

## 4. Key Technical Decisions

| Decision | Rationale | Trade-Off / Risk |
| :--- | :--- | :--- |
| [...] | [...] | [...] |

---

## 5. Implementation Walkthrough

### What Was Implemented

[...]

### How It Works

[...]

### Main Flow

1. [...]
2. [...]
3. [...]

### Important Logic / Abstractions

- [...]

---

## 6. Deviations From FMN-PLAN

> Record any deviation from the locked FMN-PLAN. Do not hide deviations.

| Deviation | Reason | Impact | Needs FMN Review? |
| :--- | :--- | :--- | :--- |
| [...] | [...] | Low / Medium / High | Y
es / No |

If no deviation exists, write:

```text
No material deviation from FMN-PLAN.


## 7. Dependency / Environment Changes
Dependency / Tool / Environment	Action	Reason	Risk
[...]	Add / Update / Remove / Configure	[...]	[...]

If none:
No dependency or environment changes.


## 8. Developer Verification

DEV records checks performed before handing back to FMN.

Check	Command / Method	Result	Evidence
Build / compile	[...]	PASS / FAIL / N/A	[...]
Unit tests	[...]	PASS / FAIL / N/A	[...]
Integration tests	[...]	PASS / FAIL / N/A	[...]
Manual smoke check	[...]	PASS / FAIL / N/A	[...]


## 9. Git / Change Evidence

Minimal physical trace. Mark N/A only if no material file changes exist.

Field	Value
Branch	[...]
Latest Commit	[...]
Working Tree State	clean / dirty
Changed Files	[...]
Diff Summary	[...]


## 10. Issues Encountered
Issue	Cause	Resolution	Residual Risk
[...]	[...]	[...]	[...]
If none:
No material implementation issues encountered.

## 11. Known Limitations / Technical Debt
Item	Impact	Recommended Follow-Up
[...]	[...]	[...]
If none:
No known technical debt introduced.

## 12. DEV Completion Statement
Completion Summary

[...]

DEV Advisory Status

IMPLEMENTED / PARTIALLY_IMPLEMENTED / BLOCKED / NEEDS_FMN_REVIEW

Notes for FMN
[...]
[...]
```

Kenapa template ini cocok  

Saya sengaja tidak memasukkan:

```
Project ID
Version
Runtime State
Locked At
CLI lifecycle
Formal approval gate
Skill routing
NLM request
Learning memory
```

Itu semua terlalu Delta Full atau runtime concern.

`DEV-EXEC` harus tetap developer-readable dan tidak menjadi dokumen administratif. Bagian penting dari Delta `CDC-IMPL` yang tetap dipertahankan adalah approach, rationale, files to change, technical decisions, dependency changes, testing plan, dan risks.  
Bagian penting dari Delta `CDC-WALK` yang tetap dipertahankan adalah implementation summary, change inventory, verification evidence, constraint compliance, issues/RCA, residual risks, dan handoff status.

## Boundary dengan `FMN-PLAN`

`FMN-PLAN` menjawab:

```
Apa yang harus dibangun?
Apa acceptance criteria-nya?
Apa test contract-nya?
Apa hasil test terhadap contract?
Apa observasi Director?
```

`DEV-EXEC` menjawab:

```
Apa yang benar-benar DEV lakukan?
Kenapa dilakukan begitu?
File/komponen apa yang berubah?
Apakah ada deviasi?
Apa hasil verifikasi developer?
Apa issue teknis yang tersisa?
```

Jadi `DEV-EXEC` tidak perlu mengulang test contract panjang. Ia cukup merujuk dan melaporkan implementasi terhadap `FMN-PLAN`.

# DIRECTOR MANUAL TESTING REPORT

Untuk Sigma, **jangan buat Manual Testing Report formal seperti Delta `DIR-STR`**. Delta sendiri bahkan sudah menandai `DIR-STR` sebagai retired/legacy-only, dan manual testing baru diarahkan masuk ke ANT-STR/PDC/CSO atau approval notes.

Untuk Manual Testing Report untuk Director di `FMN-PLAN`, cukup satu section sederhana:

```
## Director Observation Testing Report
Director observations are raw manual testing signals. FMN may interpret them into fix/retest recommendations, but they do not create a separate document or runtime gate.

- [ ] **OBS-001** — [Masalah/error yang ditemukan]
  - Location:
  - Severity: Low / Medium / High / Critical
  - Follow-up: Need Fix / Need Recheck / Need Explanation
  - Category: Critical Error / Hidden Bug / Mismatch With Intent / Question / Positive Feedback  
- [ ] **OBS-002** — [...]
  - Location:
  - Severity:
  - Follow-up:
  - Category :
```

## Kenapa cukup satu section

Karena di Sigma, manual testing adalah **Director observation**, bukan domain dokumen sendiri. Yang Anda butuhkan hanya:

```
Apa error-nya?
Terjadi di mana?
Seberapa parah?
Perlu diperbaiki atau diterima?
Statusnya apa?
```

Tidak perlu:

```
strategic alignment assessment panjang
manual test verdict formal
ANT interpretation queue terpisah
completeness checklist
runtime lifecycle khusus
```

Delta `DIR-STR` punya semua itu karena dulu manual testing diperlakukan seperti artifact sendiri, tapi sekarang template itu pun retired.

## Letaknya di mana?

Saya sarankan section ini masuk ke **FMN-PLAN bagian testing/report**, bukan ke `DEV-EXEC`.

Alasannya:

```
FMN owns test contract and testing judgment.
DEV owns implementation and walkthrough.
Director observations should feed FMN's test/fix decision.
```

Struktur `FMN-PLAN` bisa begini:

```
 FMN-PLAN-{Version}

## 1. Source Intent Alignment
## 2. Work Order / Task Plan
## 3. Acceptance Criteria
## 4. Pre-Build Test Contract
## 5. Automated / Simulation Test Plan
## 6. Post-Build Test Result
## 7. Foreman Advisory Verdict
## 8. Director Observation Testing Report
```

# Recommendation Template

```
# FMN-PLAN

> Build contract, test contract, test result, and Foreman advisory recommendation.

---

## 1. Source Alignment

Summarize how this plan serves the locked Director Intent.

- Intent point served:
- Scope boundary respected:
- Success criteria supported:
- Constraint or risk addressed:

---

## 2. Work Order / Task Plan

### Build Objective

[...]

### Task Breakdown

| Task ID | Task | Expected Output | Priority |
| :--- | :--- | :--- | :--- |
| TASK-001 | [...] | [...] | Must |
| TASK-002 | [...] | [...] | Should |

---

## 3. Acceptance Criteria

| AC ID | Criteria | Verification Method | Required Result |
| :--- | :--- | :--- | :--- |
| AC-001 | [...] | [...] | [...] |
| AC-002 | [...] | [...] | [...] |

---

## 4. Implementation Constraints

| Constraint | Source / Reason | DEV Freedom |
| :--- | :--- | :--- |
| [...] | [...] | Non-negotiable / Guided / Flexible |

---

## 5. Pre-Build Test Contract

> Must be completed before DEV starts implementation.

| Test ID | Behavior / Requirement | Test Method | Expected Result | Evidence Required |
| :--- | :--- | :--- | :--- | :--- |
| TC-001 | [...] | [...] | [...] | [...] |
| TC-002 | [...] | [...] | [...] | [...] |

---

## 6. DEV Handoff Instructions

DEV must:

- [...]
- [...]

DEV must not:

- [...]

DEV should report in DEV-EXEC:

- Implementation approach
- Deviations
- Changed files/components
- Known issues
- Evidence summary

---

## 7. Post-Build Test Result

> Filled after DEV completes implementation.

| Test ID | Expected Result | Actual Result | Status | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| TC-001 | [...] | [...] | PASS / FAIL / NOT_RUN | [...] |
| TC-002 | [...] | [...] | PASS / FAIL / NOT_RUN | [...] |

---

## 8. FMN Findings & Advisory Recommendation

### Findings

- [...]

### Advisory Verdict

READY_FOR_BUILD / TEST_PASS / TEST_FAIL / COMPLETE_WITH_RISK / REVISION_REQUIRED

### Recommendation to Director

[...]

---

## 9. AUD Findings — Optional

- [...]

---

## 10. Director Observation Testing Report

Director observations are raw manual testing signals. Locked FMN-PLAN content must not be modified except this section, which may receive append-only observations after lock.

- [ ] **OBS-001** — [Masalah/error yang ditemukan]
  - Location:
  - Severity: Low / Medium / High / Critical
  - Follow-up: Need Fix / Need Recheck / Need Explanation / Accept Limitation / Open New Version
  - Category: Critical Error / Hidden Bug / Mismatch With Intent / Question / Positive Feedback
  - Status: Open / Resolved / Explained / Accepted / Carried To Next Version

- [ ] **OBS-002** — [...]
  - Location:
  - Severity:
  - Follow-up:
  - Category:
  - Status:

---

## 11. Director Follow-Up Decision Notes

> Director-only notes for deciding what happens after manual observation. Runtime approval and lock state are still managed by Sigma CLI.

Decision:

OPEN_NEW_PLAN / UPDATE_CURRENT_EXEC / CONSIDER_CLOSE / ACCEPT_AS_LIMITATION / NEED_EXPLANATION

Notes:

[...]

---


```

## Notes:

Makna Decision Final by Director:

```
OPEN_NEW_PLAN
Dipakai jika masalah mengubah task plan, acceptance criteria, test contract, scope, atau interpretasi intent.

UPDATE_CURRENT_EXEC
Dipakai jika plan masih valid, tetapi implementasi butuh fix minor, bugfix, adjustment, atau retest. Tidak perlu FMN-PLAN baru.

CONSIDER_CLOSE
Dipakai jika hasil cukup baik untuk masuk DIR-CLOSE.

ACCEPT_AS_LIMITATION
Dipakai jika masalah diketahui, tapi Director menerima sebagai batasan versi ini.

NEED_EXPLANATION
Dipakai jika Director belum yakin masalahnya bug, expected behavior, trade-off, atau misunderstanding.
```



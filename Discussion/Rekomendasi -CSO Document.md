**CSO Sigma tidak perlu banyak berubah**. Struktur Delta CSO sudah cukup tepat: ia menangkap konteks sesi, keputusan, work completed, open questions, integrity notes, memory candidates, dan handoff. Yang perlu diubah hanya terminologi, artifact list, role list, dan menghapus konsep Delta yang tidak ada di Sigma seperti override/block. Template Delta juga sudah menegaskan bahwa CSO adalah optional handoff/audit support dan **bukan workflow gate**, prinsip ini harus tetap dipertahankan di Sigma.

# Yang perlu diubah dari Delta CSO

Dari:

```
GMN / ANT / CDC / GPT / PPX / DIR
DI / STRAT / WO / STR / IMPL / WALK / PDC
delta cso ...
~/.delta/memory_delta.jsonl
Active overrides or blocks
```

Menjadi:

```
ARC / AUD / FMN / DEV / DIR
DIR-INTENT / FMN-PLAN / DEV-EXEC / DIR-CLOSE / CSO
sigma cso ...
~/.sigma/memory_sigma.jsonl
Active runtime warnings / stale intent flags
```

Karena Sigma tidak punya `override`, `block`, atau `unblock`, section itu lebih baik diganti menjadi:

```
Runtime warnings or stale references
```

# Rekomendasi template `CSO` Sigma

```
# CSO-[ROLE]-[YYYYMMDDHHMM]

**Sigma Cognitive State Object (CSO)**

> **Purpose**: A CSO captures session context for handoff and audit support. It is optional, complete-state evidence and never a workflow gate. Project-specific context belongs here or in governed Sigma artifacts, not in global memory.

---

## 1. Session Metadata

| Field | Value |
| :--- | :--- |
| Role / Agent | [ARC / AUD / FMN / DEV / DIR] |
| Created At | [YYYYMMDDHHMM] |
| Runtime State | DRAFT / COMPLETE |
| Linked Artifact(s) | [DIR-INTENT / FMN-PLAN / DEV-EXEC / DIR-CLOSE / none] |
| Session Topic | [Brief title] |

---

## 2. Director Signal

- **Explicit request**: [What the Director asked for]
- **Constraints stated by Director**: [Constraints]
- **Decisions explicitly approved**: [Approved decisions]
- **Preferences or direction signals**: [Non-binding but relevant Director signals]

---

## 3. Active Role Context

- **Role active in this session**: [ARC / AUD / FMN / DEV / DIR]
- **Applicable governance**: [SIGMA_CONSTITUTION / SIGMA_PROTOCOL / role rule files read]
- **Runtime state checked**: [Commands used and relevant result]
- **Runtime warnings**: [None / stale intent / schema warning / missing artifact / other]

---

## 4. Artifact Context

Use weak `related_to` references. CSO links provide historical context; they do not create authority over formal artifacts.

| Artifact Type | File | Relationship | State At Capture |
| :--- | :--- | :--- | :--- |
| DIR-INTENT | [file] | related_to | [state] |
| FMN-PLAN | [file] | related_to | [state] |
| DEV-EXEC | [file] | related_to | [state] |
| DIR-CLOSE | [file] | related_to | [state] |

---

## 5. Decisions & Rationale

| Decision | Rationale | Trade-Off | Approved By |
| :--- | :--- | :--- | :--- |
| [decision] | [why] | [cost/risk] | Director / Pending |

---

## 6. Advisory Judgments

> Advisory judgments are decision-support signals only. They do not approve, reject, lock, or block runtime state.

| Role | Advisory Verdict | Reason | Recommended Director Action |
| :--- | :--- | :--- | :--- |
| ARC / AUD / FMN / DEV | [verdict] | [reason] | [recommendation] |

---

## 7. Work Completed

| Item | Owner | Status | Evidence |
| :--- | :--- | :--- | :--- |
| [task] | [role] | Pending / In Progress / Done | [file/command/result] |

---

## 8. Open Questions & Blockers

- **Critical blockers**: [Items that halt progress]
- **Non-blocking questions**: [Items to resolve later]
- **Deferred items**: [Items intentionally left out]
- **Next decision needed from Director**: [Specific decision]

---

## 9. Integrity Notes

- **Validated facts**: [Facts verified from files, CLI, or Director]
- **Assumptions**: [Assumptions still needing validation]
- **Risks**: [Known risks]
- **Do not assume**: [Guardrails for next session]

---

## 10. Memory & Persistence Candidates

Only ecosystem-level, Director-approved facts may be promoted to Sigma MCP memory. Project-specific facts stay in CSO/project artifacts.

| Candidate | Classification | Promotion Recommendation | Director Approval |
| :--- | :--- | :--- | :--- |
| [fact] | Constitutional / Operational Sigma / Project-only / Ephemeral | Promote / Keep in CSO / Discard | Pending / Approved / Rejected |

---

## 11. Handoff Instructions

- **Mandatory next action**: [Specific next action]
- **Files to read first**: [Files]
- **Useful commands**: [Commands for the next role]
- **Do not modify**: [Locked or sensitive sections/artifacts]
- **Recommended role next**: [ARC / AUD / FMN / DEV / DIR]

---

## 12. Summary Snapshot

[Two or three sentences summarizing current state and next step.]

---

# Quick Reference

- Create with `sigma cso new --agent <ARC|AUD|FMN|DEV|DIR>`.
- Save under `Sigma/logs/`.
- CSO is optional and never a workflow gate.
- Runtime state remains governed by `Sigma/progress.json`.
```

## Perubahan penting yang saya rekomendasikan

### 1. Hapus Project ID dari body

Konsisten dengan keputusan template Sigma: jangan tulis runtime/admin metadata yang sudah dimiliki `progress.json`.

Jadi saya hilangkan:

```
Project ID
```

dari metadata body.

### 2. Tambahkan `Advisory Judgments`

Ini berguna untuk Sigma karena role seperti AUD/FMN/DEV sering memberi recommendation verdict, tapi tidak punya authority final.

Section ini menangkap:

```
AUD: PASS_WITH_RISKFMN: READY_FOR_BUILDDEV: NEEDS_FMN_REVIEW
```

tanpa membuatnya menjadi approval.

### 3. Ganti `Active overrides or blocks`

Delta punya override/block. Sigma tidak.

Penggantinya:

```
Runtime warnings
```

Contoh:

```
stale intentschema mismatchmissing artifactgate blocked
```

### 4. Memory classification disederhanakan

Delta punya Constitutional / Operational / Project-only / Ephemeral. Sigma cukup:

```
ConstitutionalOperational SigmaProject-onlyEphemeral
```

Tidak perlu Learning Memory karena sudah diputuskan tidak masuk Sigma default.

## Verdict

CSO Sigma sebaiknya **90% sama dengan Delta CSO**, tapi lebih bersih secara terminologi dan authority. Jangan overdesign. CSO bukan artifact utama; ia hanya handoff object.

Final prinsip:

```
CSO captures context.CSO does not create authority.CSO does not change runtime state.CSO does not replace governed artifacts.
```

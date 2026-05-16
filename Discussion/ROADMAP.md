# ROADMAP

> Optional FMN-owned implementation staging document. ROADMAP breaks a locked Director Intent into large build stages before each stage is converted into FMN-PLAN. It is not a runtime gate.

---

## 1. Roadmap Purpose

Why this roadmap exists:

[...]

What this roadmap helps prevent:

- oversized FMN-PLAN
- unclear build order
- missing dependency sequencing
- premature implementation
- unmanaged scope expansion

---

## 2. Source Intent Alignment

Summarize how this roadmap serves the locked DIR-INTENT.

- Intent point served:
- Success criteria supported:
- Scope boundary respected:
- Constraint or risk addressed:
- Primary trade-off preserved:

---

## 3. Stage Overview

| Stage | Focus | Main Output | Suggested PLAN | Priority |
| :--- | :--- | :--- | :--- | :--- |
| Stage 0A | [...] | [...] | FMN-PLAN-v0.1 | Must |
| Stage 0B | [...] | [...] | FMN-PLAN-v0.2 | Must |
| Stage 1 | [...] | [...] | FMN-PLAN-v0.3 | Should |

---

## 4. Stage Details

### Stage 0A — [Stage Name]

**Focus**:  
[...]

**Main Output**:  
[...]

**Main Tasks**:

- [...]
- [...]
- [...]

**Dependency / Gate Before Next Stage**:

- [...]

**Risk / Watch-Out**:

- [...]

---

### Stage 0B — [Stage Name]

**Focus**:  
[...]

**Main Output**:  
[...]

**Main Tasks**:

- [...]
- [...]
- [...]

**Dependency / Gate Before Next Stage**:

- [...]

**Risk / Watch-Out**:

- [...]

---

### Stage 1 — [Stage Name]

**Focus**:  
[...]

**Main Output**:  
[...]

**Main Tasks**:

- [...]
- [...]
- [...]

**Dependency / Gate Before Next Stage**:

- [...]

**Risk / Watch-Out**:

- [...]

---

## 5. Phase Dependencies Summary

```text
Stage 0A
  ↓
Stage 0B
  ↓
Stage 1
  ↓
Stage 2
```

Notes:

- [...]
- [...]

---

## 6. PLAN Breakdown

| PLAN | Covers Stage | Expected Purpose |
| :--- | :--- | :--- |
| FMN-PLAN-v0.1 | Stage 0A | [...] |
| FMN-PLAN-v0.2 | Stage 0B | [...] |
| FMN-PLAN-v0.3 | Stage 1 | [...] |

---

## 7. Pending Items

| Item | Why It Matters | Resolve Before |
| :--- | :--- | :--- |
| [...] | [...] | Stage [...] |

---

## 8. FMN Roadmap Notes

FMN notes:

[...]

Recommended next PLAN:

[...]

---

## 9. Director Roadmap Notes

> Semantic notes only. Runtime state is still managed by Sigma CLI and progress.json.

Decision Signal:

USE_AS_GUIDE / REVISE / DEFER / IGNORE

Notes:

[...]

---

## Roadmap Policy

ROADMAP is optional.

ROADMAP is FMN-owned.

ROADMAP lives in BUILD context.

ROADMAP is not a runtime gate.

ROADMAP does not replace FMN-PLAN.

ROADMAP divides implementation into large stages before PLAN.

If ROADMAP conflicts with DIR-INTENT, DIR-INTENT wins.

If FMN-PLAN deviates from ROADMAP, FMN should explain the deviation or ask Director.

Control sentence:

```text
ROADMAP says how many big stages.
FMN-PLAN says what to build next.
```

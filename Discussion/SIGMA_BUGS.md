# Sigma CLI — Bug & Improvement Notes

Ditemukan selama session FMN (MO2 Hardlink Builder, 2026-05-17/18).

---

## Bug 1: Gate 2 Lock Order — PLAN locked before EXEC verification

**Severity:** High (design flaw)

**Current behavior:**
```
FMN-PLAN DRAFT → sigma plan lock → LOCKED (Gate 2 open) → sigma exec new
```

PLAN bisa di-lock sebelum DEV-EXEC dibuat. Begitu di-lock, Sections 1–9 beku — tidak bisa diubah meskipun DEV menemukan bug yang mengharuskan revisi test contract.

**Expected behavior:**
```
FMN-PLAN DRAFT → Director APPROVE (record to decisions.jsonl, no freeze)
    → DEV sigma exec new → testing → EXEC complete
    → Director LOCK (freeze Sections 1–9 + Gate 2 open)
```

Perlu mekanisme `approve` yang merekam ke decision log tanpa membekukan sections. Lock baru terjadi setelah EXEC memverifikasi plan akurat.

**Workaround sekarang:** Supersede ke v2 jika perlu revisi. Atau catat deviasi di Section 10/11 (append-only).

---

## Bug 2: `sigma send --message` truncates multi-line content

**Severity:** Medium

**Discovered by:** ARC (CSO-ARC-20260518-0414)

**Workaround:** Gunakan `--message-file <path>` untuk konten multi-baris. Tulis body ke temp file dulu, lalu kirim.

---

## Bug 3: `decisions.jsonl` — no read command

**Severity:** Medium

**Current behavior:**
- CLI MENULIS ke `decisions.jsonl` pada: `sigma intent lock`, `sigma plan lock`, `sigma override`
- CLI TIDAK PUNYA command untuk MEMBACA `decisions.jsonl`
- Agent harus baca file mentah (`read_file("Sigma/memory/decisions.jsonl")`)

**Expected:** Tambahkan `sigma decision log` atau `sigma memory log` untuk menampilkan:
- Semua lock events dengan timestamp
- Director notes per artifact
- Risk notes dan evidence references

---

## Bug 4: `sigma plan lock` captures director_notes prematurely

**Severity:** Low (side effect of Bug 1)

Saat `sigma plan lock`, CLI membaca Section 10 (Director Observation Testing Report) dan menyimpannya sebagai `director_notes` di decisions.jsonl. Tapi Section 10 dirancang sebagai **append-only post-lock** — artinya catatan Director yang ditambahkan SETELAH lock tidak akan masuk decision log.

Jika Bug 1 diperbaiki (lock setelah EXEC), ini teratasi otomatis — saat lock, Section 10 sudah terisi penuh.

---

## Improvement 1: CSO auto-population

**Suggestion:** `sigma cso new` bisa mengisi otomatis beberapa field dari `progress.json`:
- `Related Artifact` — detect dari active artifact
- `Related Artifact State` — LOCKED/DRAFT dari progress.json
- `Created By Role` — dari `--role` flag

Saat ini template berisi placeholder `[ROLE]`, `[YYYYMMDDHHMM]` yang harus diisi manual.

---

## Improvement 2: Bootstrap checklist untuk governance roles

**Suggestion:** Tambahkan `decisions.jsonl` ke daftar bacaan wajib di Bootstrap Protocol. Saat ini FMN-RULE menyebut "Sigma/progress.json state via sigma session bootstrap" tapi tidak menyebut decisions.jsonl.

Checklist seharusnya:
1. `sigma session bootstrap`
2. `Sigma/memory/decisions.jsonl` ← tambahan
3. Active DIR-INTENT
4. CSO cross-role check

---

_Dicatat oleh FMN, 2026-05-18._

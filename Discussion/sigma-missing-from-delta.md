# Sigma Ecosystem — Fitur Missing dari Delta

> Dibuat: 17 Mei 2026  
> Konteks: Analisis perbandingan Delta Ecosystem vs Sigma Ecosystem  
> Tujuan: Referensi fitur Delta yang belum ada di Sigma dan perlu dipertimbangkan

---

## 🔴 Missing Krusial — Prioritas Tinggi

### 1. Test Suite

**Ada di Delta:** `npm test` dengan integration lifecycle checks, cascade block behavior, external skill registry behavior, dan setup install regression coverage.  
**Di Sigma:** Belum ada sama sekali.

**Kenapa penting:**

- Sigma justru yang direncanakan untuk rilis publik
- CLI yang mengelola state governance (`progress.json`) sangat rentan bug silent
- Bug kecil bisa corrupt seluruh lifecycle project pengguna tanpa error yang jelas

**Saran implementasi:**

- [ ] Pilih testing framework: `vitest` (lebih ringan) atau `jest`
- [ ] Port minimal test dari Delta yang relevan untuk Sigma
- [ ] Test yang paling kritis:
  - Gate enforcement: `sigma plan new` gagal kalau INTENT belum LOCKED?
  - `sigma intent lock` memperbarui `progress.json` dengan benar?
  - Chain gate: INTENT → PLAN → EXEC diperiksa secara berurutan?
  - Error message: informatif, tidak crash dengan stack trace mentah?
- [ ] Tambahkan `"test": "vitest"` ke `package.json`

---

### 2. `.npmignore`

**Ada di Delta:** File `.npmignore` yang mengontrol apa yang ikut ter-publish ke npm.  
**Di Sigma:** Belum ada.

**Kenapa penting:**

- Tanpa `.npmignore`, semua file di repo ikut ter-publish ke npm
- Folder `Discussion/`, `Intent/`, file development, dan dokumen internal tidak perlu ada di npm package
- Ini mempengaruhi ukuran package dan kesan profesionalisme

**Saran isi `.npmignore`:**

```
# Development & internal docs
Discussion/
Intent/
Implementation/
.claude/
scripts/
sigma_phase_implementation.md

# Config & tooling
tsconfig.json
.gitignore

# Source (sudah ada dist/)
src/

# Test files (kalau ada nanti)
test/
*.test.ts
```

- [ ] Buat file `.npmignore` di root repo
- [ ] Verifikasi dengan `npm pack --dry-run` sebelum publish

---

### 3. Cursor Support (`.cursor`)

**Ada di Delta:** Folder `.cursor` dengan bridge file untuk Cursor IDE.  
**Di Sigma:** Tidak disebut sama sekali di supported targets.

**Kenapa penting:**

- Cursor adalah salah satu AI coding tool dengan market share terbesar
- Saat ini Sigma hanya support: Claude Code, Codex CLI, Reasonix, Antigravity
- Tidak support Cursor berarti menutup sebagian besar target pengguna potensial

**Saran implementasi:**

- [ ] Tambahkan `.cursor/rules/` sebagai target deploy di `sigma setup install`
- [ ] Buat bridge file untuk Cursor (mirip `CLAUDE.md` tapi untuk Cursor)
- [ ] Update README di bagian "AI Tool Targets" untuk mencantumkan Cursor

---

### 4. Director Override Mechanism

**Ada di Delta:** `delta override` — mekanisme resmi untuk bypass gate dengan alasan yang tercatat secara terstruktur.  
**Di Sigma:** Tidak ada.

**Kenapa penting:**

- Tanpa override, pengguna yang stuck di gate karena alasan legitimate tidak punya jalan keluar yang bersih
- Satu-satunya pilihan saat ini: edit `progress.json` manual — yang justru dilarang
- Ini akan terjadi di dunia nyata: gate condition tidak selalu bisa dipenuhi secara sempurna

**Saran implementasi (versi ringan untuk Sigma):**

```bash
sigma override --reason "Director decision: skipping plan lock due to scope change"
```

- Override harus mencatat: timestamp, alasan, artifact yang di-bypass, siapa yang authorize

- Override dicatat di `Sigma/memory/decisions.jsonl` sebagai audit trail

- Tidak perlu sekompleks Delta — cukup satu command dengan mandatory `--reason` flag

- [ ] Desain `sigma override` command sederhana

- [ ] Pastikan setiap override tercatat di decisions log

- [ ] Dokumentasikan kapan override boleh dan tidak boleh digunakan

---

## 🟡 Missing yang Perlu Dipertimbangkan

### 5. MCP Config Templates Lengkap

**Ada di Delta:** `.mcp.json` (root), `.vscode/mcp.json`, `.cursor/mcp.json`, `.codex/mcp.json` — semua di-generate saat `delta project start`.  
**Di Sigma:** Hanya bisa di-generate lewat `sigma setup memory` — tidak otomatis saat `sigma project start`.

**Kenapa penting:**

- Pengguna yang pakai VS Code atau Cursor tidak punya referensi konfigurasi MCP dari awal
- Perlu langkah ekstra (`sigma setup memory`) yang mudah terlewat

**Saran:**

- [ ] Pertimbangkan untuk include `.mcp.json` template saat `sigma project start`
- [ ] Atau minimal tambahkan prompt/reminder setelah `sigma project start` selesai

---

### 6. Output `session bootstrap` yang Lebih Eksplisit

**Ada di Delta:** Bootstrap jelas menampilkan: lifecycle state, artifact versions aktif, gate blockers, dan recommended next action.  
**Di Sigma:** Konsep sama tapi tidak sejelas Delta dalam output aktualnya.

**Kenapa penting:**

- Pengguna tidak tahu persis apa yang terjadi saat bootstrap
- Output yang tidak jelas mengurangi kepercayaan pengguna pada CLI

**Saran output ideal `sigma session bootstrap`:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SIGMA SESSION BOOTSTRAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Project     : MyProject
  Phase       : DEV-EXEC

  Artifacts:
  ✓ DIR-INTENT  v0.1  LOCKED
  ✓ FMN-PLAN    v0.1  LOCKED
  ● DEV-EXEC    v0.1  BUILDING

  Gate Status : Open (DEV-EXEC in progress)
  Next Action : Complete implementation, then run `sigma exec advance testing`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- [ ] Audit output aktual `sigma session bootstrap` saat ini
- [ ] Perbaiki format agar informatif dan actionable

---

### 7. Block / Unblock — Versi Sederhana

**Ada di Delta:** `delta block` / `delta unblock` — cascade quarantine untuk menandai artifact bermasalah.  
**Di Sigma:** Tidak ada.

**Catatan:** Cascade quarantine Delta memang terlalu kompleks untuk Sigma — keputusan untuk tidak membawanya **sudah tepat**. Tapi versi sederhananya masih masuk akal.

**Skenario yang belum bisa ditangani Sigma:**

- Pengguna menemukan FMN-PLAN yang sudah LOCKED ternyata ada kesalahan fatal
- Pilihan saat ini: supersede (butuh buat versi baru) atau reset (terlalu destruktif)
- Tidak ada cara untuk *menandai artifact sebagai bermasalah sementara* tanpa mengubah lifecycle state

**Saran versi ringan:**

```bash
sigma plan flag --reason "Found critical error in test contract, pending revision"
sigma plan unflag
```

- Flag tidak mengubah lifecycle state — artifact tetap LOCKED

- Flag hanya menambahkan penanda dan catatan di decisions log

- Director tetap yang authorize unflag

- [ ] Pertimbangkan `sigma <artifact> flag` sebagai alternatif ringan dari block/unblock

---

## 🟢 Yang Sengaja Dihilangkan dari Delta — Keputusan Tepat

Ini fitur Delta yang **tidak perlu dibawa ke Sigma** dan keputusan untuk tidak membawanya sudah benar:

| Fitur Delta                                   | Alasan Tidak Dibawa ke Sigma                                |
| --------------------------------------------- | ----------------------------------------------------------- |
| Skills system + triple-gate                   | Terlalu kompleks, pengguna belum siap berpikir di level itu |
| 6 role (GMN, ANT, CDC, GPT, PPX)              | Terlalu banyak context switching untuk solo/small team      |
| Cascade quarantine penuh                      | Over-engineering untuk skala Sigma                          |
| Struktur folder bernomor (`01_Strategy`, dll) | Terlalu rigid, Sigma lebih fleksibel                        |
| JavaScript + Python stack                     | Sigma sudah tepat pilih TypeScript saja — lebih konsisten   |

---

## 📋 Checklist Ringkas

```
MISSING FROM DELTA — ACTION ITEMS
===================================

🔴 Krusial (sebelum rilis npm)
[ ] Buat .npmignore
[ ] Tambahkan test suite (port dari Delta)
[ ] Tambahkan Cursor support di setup install
[ ] Desain dan implementasi sigma override

🟡 Pertimbangkan (setelah rilis awal)
[ ] MCP config auto-generate saat project start
[ ] Perbaiki output sigma session bootstrap
[ ] Pertimbangkan sigma plan/exec flag sebagai versi ringan block
```

---

## 💬 Catatan

Delta gagal sebagai produk karena terlalu kompleks — tapi berhasil sebagai **proses berpikir**. Semua insight di atas hanya bisa didapat karena Delta sudah melalui iterasi yang lebih panjang (53 commits vs 15 commits Sigma).

Sigma bukan sekadar versi ringan Delta. Sigma adalah **versi yang lebih bijak** — tahu apa yang perlu ada dan apa yang tidak.

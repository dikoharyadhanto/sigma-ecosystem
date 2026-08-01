# INTENT — Sigma Autonomy: From Governance Kernel to Autonomous Agent System

> **Status**: Informal artifact-styled document. Bentuk mengikuti `Sigma/templates/DIR-INTENT-TEMPLATE.md` sebagai acuan struktur saja — **bukan** dokumen governance Sigma. Repo ini sengaja tidak diregistrasi sebagai proyek Sigma, jadi tidak ada `progress-v<N>.json`, tidak ada gate/lock CLI, tidak ada AUD/FMN/DEV formal, tidak ada `sigma intent lock`. Bagian template yang murni mekanisme CLI (Lock State, Final Validation Checklist, AUD Advisory Verdict) dihilangkan atau disederhanakan.
>
> **Sumber**: `Discussion/SIGMA-AUTONOMY-BLUEPRINT-20260728.md` (seluruh dokumen).
>
> **Relasi dengan dokumen turunan**: Ini adalah SATU intent untuk seluruh visi otonomi. Setiap fase (§6.1) akan mendapat dokumen **Plan** tersendiri nanti (work order + test contract per fase, gaya FMN-PLAN) — bukan intent terpisah per fase. Dokumen ini tidak perlu ditulis ulang setiap fase berganti; hanya Plan barunya yang dibuat.

---

## 1. Intent Core

### 1.1 Objective

Mengubah Sigma dari CLI governance yang dioperasikan manual (satu sesi AI memainkan semua peran bergantian) menjadi sistem multi-agent otonom, di mana tindakan manual Director tinggal dua: (1) menulis intent bersama ARC, dan (2) memutuskan approve/reject di antrean persetujuan.

### 1.2 Problem Being Solved

Hari ini Director harus hadir di setiap sesi untuk mengaktifkan ARC→FMN→DEV→AUD bergantian dan mengotorisasi lock secara langsung dalam percakapan. Ini membatasi throughput ke kehadiran Director, dan tidak ada mekanisme untuk mempercayai hasil kerja agent tanpa Director hadir mengawasi secara sosial (mis. "tests pass" yang dilaporkan sendiri oleh agent, bukan diverifikasi mesin).

### 1.3 Target User / Beneficiary

Director (dikoharyadhanto), sebagai operator utama sigma-ecosystem — dan proyek-proyek lain yang diatur Sigma, yang akan ikut menikmati pipeline otonom begitu primitifnya jadi bagian CLI.

### 1.4 Desired Outcome

Sebuah pipeline berjalan tanpa manusia di tengah dari `intent LOCKED` sampai chain siap ditutup: FMN agent menyusun ROADMAP+PLAN, DEV agent mengimplementasi di worktree terisolasi, kernel menjalankan test contract dan merekam bukti, AUD agent mereview secara adversarial — semuanya bermuara ke satu antrean approval yang Director tinjau sesuai jadwalnya sendiri, bukan harus hadir real-time.

### 1.5 Primary Value Delivered

Containment yang bersandar pada **state**, bukan prompt — gate/lock di `progress-v<N>.json` menolak transisi ilegal secara struktural. Ini yang membuat Sigma, dibanding agent framework lain yang cuma mengandalkan prompt (dan karenanya rentan drift di sesi panjang), punya dasar kredibel untuk otonomi.

---

## 2. Comprehensive Research

**Status**: NOT_NEEDED — ini keputusan arsitektur dan rekayasa berbasis aset yang sudah ada di codebase (lihat §7 Asset Inventory), bukan klaim teori atau data dunia nyata yang perlu divalidasi sumber eksternal. Riset terarah (bukan riset umum) tetap diperlukan sebelum Fase 3 khusus untuk Open Decision #1 (§9) — dicatat di sana, bukan di sini.

---

## 3. Success Definition

### 3.1 Concrete Outcome

Dari `intent lock` sampai chain siap ditutup, satu-satunya tindakan manual Director adalah menjawab interview ARC di awal dan memutuskan approve/reject di antrean — seluruh FMN/DEV/AUD berjalan tanpa Director hadir di sesi kerja mereka.

### 3.2 Success Threshold

Tercapai penuh hanya setelah Fase 4 (§6.1) selesai. Setiap fase di bawahnya punya ambang keberhasilannya sendiri (didefinisikan di Plan masing-masing fase), dan **setiap fase harus bernilai berdiri sendiri** meski fase berikutnya tidak pernah dibangun (lihat Prinsip 6, §5).

### 3.3 Measurement Method

Per-fase: "Done when" yang sudah dirumuskan di blueprint sumber (§5) diangkat jadi acceptance criteria Plan fase itu. Keseluruhan: diukur saat Fase 4 selesai — Director mengonfirmasi seluruh tindakannya dari intent-lock sampai closure-ready hanyalah approval, dengan setiap request membawa bukti kernel + AUD note.

### 3.4 Minimum Viable Evidence

- [ ] Minimal satu fase (idealnya Fase 0) selesai dibangun dan diverifikasi terhadap "done when"-nya.
- [ ] Hasil uji dicatat di Plan fase terkait.
- [ ] Keterbatasan yang diketahui didokumentasikan per fase.

---

## 4. Quality Bar

| Dimension | Minimum Standard | Must Not Happen | Evidence |
|:--|:--|:--|:--|
| Security | Agent tidak pernah memutasi state gate/lock langsung; hanya kernel yang boleh (Prinsip 1, §5) | Agent memperoleh kemampuan mengunci pekerjaannya sendiri tanpa approval record | Review desain approval queue vs override.ts pattern |
| UX Trust | Director tidak pernah disuguhi request approval tanpa bukti kernel-verified (begitu Fase 2 ada) | "False green" — approval terlihat aman padahal evidence-nya self-reported/basi | Evidence record + content-hash binding di request |
| UI / Product Packaging | Output CLI baru (`sigma request`, `sigma approvals`, dll.) konsisten gaya dengan command family yang sudah ada (`override`, `doctor`) | Command baru yang formatnya menyimpang dari konvensi CLI Sigma | Perbandingan output antar command |
| Performance / Cost | Dispatcher (Fase 3+) punya budget cap (turn, spend, wall-clock) dan retry limit sejak awal, bukan ditambahkan belakangan | Loop tak terbatas / biaya tak terkendali dari agent yang gagal berulang | Konfigurasi cap dicatat di Plan Fase 3 |

---

## 5. Strategic Trade-Offs

### 5.1 Primary Trade-Off

Kita memprioritaskan **containment yang diverifikasi mesin** di atas **kecepatan mencapai otonomi penuh** — otonomi ditambahkan bertahap per ring (Prinsip 5), bukan sekaligus.

### 5.2 Secondary Trade-Offs

- Kita rela mengorbankan **kecepatan Fase 1** (approval queue dulu, manual filing) demi **interface yang benar** yang nanti dipakai dispatcher tanpa dirombak ulang.
- Kita rela mengorbankan **otomasi interview intent** demi **kedaulatan Director tetap utuh** (Prinsip 4 — ARC tetap interaktif permanen, tidak pernah diotomasi).

### 5.3 Why These Trade-Offs Matter

Kalau containment tidak diverifikasi mesin lebih dulu, setiap fase berikutnya (terutama Fase 3 dispatcher) membangun otonomi di atas kepercayaan yang tidak berdasar — persis risiko "evidence gaming" dan "approval fatigue" yang didaftar di §8.

---

## 6. Scope Boundary

### 6.1 In Scope — Fase (masing-masing = satu Plan terpisah nanti)

| Fase | Nama | Inti | Nilai berdiri sendiri |
|:--|:--|:--|:--|
| 0 | Foundations hardening | `sigma doctor --docs` — validasi command string di rule docs vs command tree hidup | Ya — menutup kelas bug drift dokumentasi yang paling berulang |
| 1 | Approval as state | Approval queue (`sigma request`, `sigma approvals`, `sigma approve/reject`) | Ya — Director tidak perlu hadir real-time untuk otorisasi, meski manual filing |
| 2 | Evidence engine | `sigma exec verify` — bukti test dikumpulkan kernel, bukan self-reported | Ya — setiap approval yang diberikan jadi grounded, terlepas dari Fase 3 ada atau tidak |
| 3 | DEV autonomy pilot | Dispatcher v0 — DEV headless di worktree, budget cap, retry limit | Ya — dijalankan di proyek pilot berisiko rendah (bukan sigma-ecosystem sendiri, lihat §9) |
| 4 | Multi-role pipeline | Dispatcher untuk FMN + AUD, `sigma approvals` jadi single pane of glass | Ya — closure-ready chain dengan campur tangan Director hanya approval |

### 6.2 Out of Scope (untuk intent ini)

- **Fase 5 (Horizon)** — cycle-time metrics, micro-chain track, multi-project dispatcher, approval dari mobile. Sengaja tidak diberi acceptance criteria sampai Fase 4 punya jam terbang operasional nyata.
- Registrasi sigma-ecosystem sebagai proyek Sigma yang digovern CLI-nya sendiri — diputuskan eksplisit untuk **tidak** dilakukan (lihat diskusi terkait binary `sigma` yang di-npm-link langsung ke source repo ini).

### 6.3 Non-Goals

- Ini bukan proyek untuk mengotomasi interview ARC (Prinsip 4, permanen).
- Ini bukan proyek untuk membangun dispatcher multi-proyek dari awal (itu Fase 5).

### 6.4 Why This Boundary Matters

Kalau Fase 5 atau otomasi ARC ikut masuk scope sekarang, prioritas bergeser dari "primitif yang benar dan teruji" ke "fitur yang banyak" — bertentangan langsung dengan Prinsip 5 (rings, bukan sekaligus) dan Prinsip 6 (tiap fase berdiri sendiri).

---

## 7. Asset Inventory (Constraints — apa yang sudah ada, apa yang harus dibangun)

| Komponen Sigma yang sudah ada | Peran di sistem otonom |
|:--|:--|
| Role rule files (`Sigma/rules/*.md`) | System prompt agent, hampir siap pakai |
| Role memory (`role-memory/*.json`) | Instruksi persisten per-agent |
| `sigma send` / `sigma inbox` | Bus pesan antar-agent; unread gate = backpressure bawaan |
| Gate + lock di `progress-v<N>.json` | Titik suspend alami tempat pipeline berhenti sendiri |
| `sigma {domain} check` | Self-assessment agent: "siap mengajukan approval?" |
| MCP read-only tools | Orientasi agent tanpa akses shell |
| `operations.jsonl` | Jejak audit semua yang dikerjakan agent tanpa pengawasan |
| Role immutability rule | Selaras 1:1 dengan "satu proses agent = satu role" |
| `sigma git evidence` | Cikal bakal evidence engine |
| `sigma override --director-confirm` | Pola yang disalin untuk primitif approval |

**~70% sistem sudah ada.** Yang hilang: tiga primitif baru — approval queue (Fase 1), evidence engine (Fase 2), dispatcher (Fase 3+).

---

## 8. Risk & Failure Definition

### 8.1 Primary Failure Concern

**Kegagalan**: Director rubber-stamp request approval yang terlihat hijau tanpa scrutiny nyata ("approval fatigue"), atau agent otonom membuat kerusakan besar tanpa pengawasan sebelum terdeteksi.
**Kenapa penting**: Ini membalikkan seluruh tujuan blueprint — otonomi yang harusnya lebih aman dari sesi manual malah jadi lebih berbahaya karena kepercayaan tidak berdasar.
**Guardrail**: Tidak ada request yang boleh muncul tanpa bukti kernel-verified + AUD note (Fase 2 & 4 adalah mitigasinya, karenanya mendahului otonomi penuh); dispatcher selalu bisa dimatikan kapan saja tanpa kehilangan state (§8 tabel di blueprint sumber).

### 8.2 Risk Register

| Risk ID | Klasifikasi | Deskripsi | Mitigasi |
|:--|:--|:--|:--|
| RR-001 | Degrading | Approval fatigue | Evidence + AUD note wajib sebelum request muncul; volume request per chain dijaga rendah |
| RR-002 | Fatal (potensial) | Runaway loop / biaya tak terkendali dari DEV yang gagal berulang | Budget cap (turn/spend/wall-clock) + retry limit + eskalasi-bukan-loop |
| RR-003 | Degrading | Blast radius DEV otonom tak terkendali | Isolasi worktree/branch; dispatcher tidak pernah jalan di `main` |
| RR-004 | Degrading | Evidence gaming — agent mengedit test supaya lolos | Test contract hidup di FMN-PLAN yang LOCKED (tidak bisa diedit agent); evidence merekam hash kontrak yang dijalankan |
| RR-005 | Noise | Prompt injection lewat mailbox | Pesan cuma input advisory; transisi state hanya lewat kernel + approval record |
| RR-006 | Degrading | Race approve-after-edit | Content-hash binding di request record |
| RR-007 | Fatal (potensial) | Dispatcher jadi otoritas tersembunyi | Invariant: dispatcher dimatikan kapan saja → sistem degradasi mulus ke manual, diuji eksplisit |

---

## 9. Open Decisions (perlu keputusan Director sebelum Plan Fase 1 disusun)

1. **Agent runtime**: Claude Agent SDK (programatik) vs `claude -p` subprocess? — perlu riset terarah sebelum Fase 3 (lihat diskusi sebelumnya).
2. **Notification channel** untuk approval queue: terminal/desktop dulu, atau bridge messaging-app sejak awal?
3. **Approval granularity**: hanya command Director-class hari ini (lock, supersede), atau juga langkah pembuat-chain (`plan new` oleh FMN otonom)?
4. **Budget policy**: cap spend/turn per-chain — dikonfigurasi di `project.config.json` atau `~/.sigma/` global?
5. **Proyek pilot Fase 3**: proyek mana yang jadi tempat uji DEV otonom — **bukan sigma-ecosystem sendiri**, karena binary `sigma` global saat ini di-npm-link langsung ke source repo ini (self-bricking risk sudah dibahas terpisah).

---

*Dokumen ini bukan artefak terkunci. Bisa diedit langsung di tempat kapan saja tanpa command CLI apapun. Plan per fase akan jadi dokumen terpisah yang merujuk balik ke sini.*

# Proposal — Lifecycle Sesi Specialist dan Policy Memo Hermes

- **Tanggal:** 2026-09-15
- **Status:** Draft untuk pertimbangan Director; bukan artefak governance Sigma dan bukan otorisasi implementasi.
- **Tujuan:** Menetapkan cara Hermes mengorkestrasi sesi Claude Code/Codex sebagai specialist executor, menentukan batas sesi DEV, serta meminta memo/handoff tanpa mengambil alih mandat professional role atau governance Sigma.
- **Konteks:** Hermes adalah orchestrator dan gateway Director-facing. Sigma tetap satu-satunya sumber kebenaran state, artifact, gate, approval, dan evidence.

---

## 1. Keputusan arah

Integrasi memakai **delegasi CLI eksternal**, bukan menjadikan Claude/Codex sebagai main model Hermes.

```text
Director (Slack / CLI)
        │
        ▼
Hermes session
  ├─ model orchestrator: DeepSeek Flash (default)
  ├─ membaca state + gate Sigma
  ├─ memilih/menyiapkan role dan specialist sesuai policy Director
  ├─ membentuk task envelope minimum
  │
  ├─ DEV → `claude -p ... --model sonnet|opus`
  │         memakai subscription/login Claude Code Director
  │
  └─ AUD → `codex exec ...`
            memakai subscription/login Codex Director
        │
        ▼
Sigma control plane
  └─ satu-satunya sumber kebenaran state, approval, gate, artifact, evidence
```

Hermes, Claude Code, Codex, dan Sigma mempunyai state/session masing-masing. Tidak ada shared conversation otomatis atau telepati antar-agent. Hermes membawa konteks minimum secara eksplisit melalui task envelope.

---

## 2. Batas otoritas dan sesi

| Entitas | Memegang | Tidak memegang |
|---|---|---|
| **Hermes** | Percakapan Director, orchestration, gateway, routing, task envelope, monitoring operasional | State governance Sigma, keputusan berdaulat Director, mandat profesional role |
| **Claude Code / Codex** | Konteks specialist dari prompt + repo/worktree; implementasi/audit dalam mandat | Authority Sigma; state/approval/evidence resmi |
| **Sigma** | `progress-v<N>.json`, artifact, mailbox, gate, approval, evidence | Percakapan model / internal session provider |

Hermes tidak boleh mengendalikan, mengirim pesan ke, atau mengambil alih sesi CLI pribadi Director yang sedang aktif. Default yang direkomendasikan adalah membuat **proses specialist baru, terpisah, bounded, dan dapat diaudit**.

---

## 3. Task envelope wajib

Sebelum memanggil specialist, Hermes membentuk task envelope minimal berikut:

```text
Project binding:
- project_id
- root/worktree yang sudah diverifikasi
- active chain dan reference artifact

Role:
- ARC / FMN / DEV / AUD

Mandat:
- objective, scope, non-scope, acceptance/evidence contract

Batas capability:
- tool/capability yang diizinkan
- direktori/worktree yang boleh disentuh
- larangan akses secret/direktori luar scope
- larangan commit/push/publish dan perubahan Sigma state kecuali mandat eksplisit

Runtime limits:
- model + effort
- max turns / timeout / retry budget / cost budget

Output wajib:
- perubahan yang dibuat
- command/test yang dijalankan + hasil literal
- deviasi, failure, blocker, risiko tersisa
- reference handoff/memo bila belum selesai
```

Task envelope bukan pengganti plan/artifact Sigma. Ia adalah kontrak runtime yang menerjemahkan mandat yang sudah sah menjadi tugas specialist yang terbatas.

---

## 4. Sesi one-shot adalah default

```text
Satu locked plan / satu bounded task envelope
      → satu sesi specialist DEV
      → hasil + test/evidence + handoff
      → sesi selesai
```

Untuk Claude Code, jalur default adalah print mode non-interaktif:

```bash
claude -p "<task envelope>" \
  --model sonnet \
  --effort high \
  --max-turns 20 \
  --allowedTools "Read,Edit,Write,Bash"
```

Untuk Codex, jalur default adalah one-shot:

```bash
codex exec "<audit envelope>"
```

Keunggulan one-shot:

- batas mandat jelas;
- capability, turn, waktu, dan budget dapat dibatasi;
- output lebih mudah ditinjau/dicatat;
- tidak ada sesi specialist yang hidup tanpa batas;
- crash recovery lebih sederhana;
- selaras dengan satu mandat formal → satu hasil/handoff yang dapat diperiksa.

Sesi interactive/continuing merupakan **exception**, hanya untuk mandat DEV yang memang satu kesatuan tetapi membutuhkan iterasi panjang. Ia harus memiliki session ID, worktree, lease/deadline, budget, dan kondisi terminal yang tercatat dispatcher.

---

## 5. Siapa menentukan akhir sesi DEV

Hermes tidak boleh mengakhiri sesi berdasarkan perasaan, lama waktu saja, atau asumsi bahwa konteks telah penuh. Ia memakai policy eksplisit dan sinyal yang dapat diamati.

### 5.1 Batas mandat — pemicu utama

| Keadaan | Tindakan Hermes |
|---|---|
| Scope task selesai + test contract dijalankan | Ambil hasil/evidence; tutup sesi |
| Scope belum selesai tetapi blocker atau ambiguity material ditemukan | Hentikan pekerjaan; minta memo/handoff; eskalasi ke Director atau role tepat |
| DEV perlu mengubah scope, plan, public API, schema, atau menerima risiko | Hentikan; memo/handoff; jangan lanjut tanpa jalur Sigma sah |
| Semua pekerjaan dalam locked plan selesai | Tutup sesi; siapkan evidence tahap `DEV-EXEC`; jangan mencari pekerjaan tambahan |

### 5.2 Batas eksekusi — circuit breaker

| Sinyal | Contoh policy awal | Respons Hermes |
|---|---|---|
| Agentic turns | `max-turns` per envelope | Proses berhenti; klasifikasikan hasil parsial |
| Durasi | Timeout per task sesuai plan | Hentikan aman; simpan output/log; tidak retry tanpa batas |
| Retry | Maksimum retry transient yang didelegasikan | Memo + eskalasi setelah budget habis |
| Biaya/kuota | Budget per task/sesi | Berhenti sebelum melewati delegation envelope |
| Kegagalan test berulang | Dua diagnosis/perbaikan tanpa kemajuan yang dapat dibuktikan (contoh awal) | Memo berisi hipotesis/log/perubahan/blocker |
| Perubahan scope | Laporan DEV atau diff bertentangan dengan plan | Stop; kembali ke FMN/Director |
| Risiko security/data | Akses baru, migrasi, secret, tindakan destruktif | Stop dan eskalasi langsung |

Angka final tidak ditetapkan oleh dokumen ini. Ia harus diuji dalam pilot dan diputuskan Director sebagai bagian dari delegation envelope / test contract.

---

## 6. Context boundary dan memo

Untuk sesi continuing, memo dipicu pada **boundary kerja**, bukan hanya karena token habis.

```text
Jika tugas belum selesai tetapi salah satu terjadi:
- specialist menyatakan konteks perlu dikompak/diringkas;
- batch turn/iterasi yang ditetapkan telah tercapai;
- fokus teknis berubah signifikan;
- ada handoff ke role lain;
- gateway/host akan restart atau lease akan habis;
- retry budget habis;
- blocker material muncul;

maka DEV wajib membuat memo sebelum sesi ditutup atau dilanjutkan di sesi baru.
```

Hermes dapat memonitor sinyal proses dan metadata output—misalnya status selesai/error, jumlah turn, durasi, session ID, output test, timeout, atau permintaan input. Namun Hermes tidak boleh mengklaim mengetahui utilisasi context window specialist secara presisi kecuali CLI/provider secara eksplisit memberikannya.

Memo bukan klaim pekerjaan selesai. Memo adalah *operational brief* agar sesi berikutnya tidak bergantung pada ingatan agent lama.

---

## 7. Isi minimum memo DEV

Gunakan primitive Sigma yang telah ada:

```bash
sigma memo write --role DEV --ref PLAN-vN --topic "..." --message "..."
```

Isi minimum:

```text
- reference: PLAN-vN / EXEC-vN / GENERAL
- objective aktif
- perubahan yang sudah dibuat
- test/command yang sudah dijalankan + hasil literal
- failure atau blocker
- hipotesis/next step
- deviasi dari plan
- risiko tersisa
- file/worktree/branch yang relevan
```

Tidak boleh ada shadow note/memory Hermes yang menggantikan memo formal Sigma.

---

## 8. Pembagian keputusan memo

| Keputusan | Pemegang |
|---|---|
| Memo wajib karena threshold policy tercapai | Hermes — keputusan mekanis yang sudah didelegasikan |
| Isi teknis memo | DEV specialist |
| Apakah blocker mengubah intent/plan/risk | Director setelah decision packet Hermes |
| State lifecycle/artifact resmi | Sigma CLI/control plane |
| Apakah sesi DEV baru boleh dimulai | Hermes, hanya setelah binding, gate, dan mandate valid |

Hermes boleh meminta memo, memeriksa bahwa memo berhasil dibuat, serta membawa referensinya ke sesi berikutnya. Hermes tidak mengisi memo teknis atas nama DEV atau menyatakan blocker telah terselesaikan tanpa evidence.

---

## 9. Policy pemilihan Sonnet vs Opus

Hermes dapat menjadi **policy-driven model router**, tetapi bukan router bebas berbasis penilaian subjektif model. Director menetapkan matriks; Hermes membaca locked plan dan menjalankan matriksnya.

| Kelas | Indikator dari locked plan | Model DEV Claude | Otonomi Hermes |
|---|---|---|---|
| **D1 — rutin** | Perubahan lokal, satu modul, test jelas, rollback mudah, tanpa schema/API/security boundary | Sonnet | Pilih otomatis |
| **D2 — sedang** | Multi-file, dependency internal, refactor terbatas, test contract multi-lapis | Sonnet default | Pilih otomatis; eskalasi jika ditemukan deviasi material |
| **D3 — kompleks/material** | Public API/schema, auth/security, migrasi, concurrency, data-loss risk, cross-service, rollback sulit | Opus | Rekomendasikan dan minta keputusan Director, kecuali envelope mengizinkan |
| **D4 — tidak jelas / konflik** | Intent/plan ambigu, evidence tidak cukup, conflict requirement, risiko belum diterima | Jangan aktifkan DEV | Kembalikan ke ARC/FMN/Director |

Model dipilih **sebelum** sesi DEV dimulai. Jangan sering switch model di tengah sesi karena prompt cache provider ter-reset dan pesan berikutnya harus membaca ulang histori penuh. Bila D3/D4 ditemukan di tengah implementasi, sesi berhenti, memo/handoff dibuat, lalu Hermes memulai sesi baru setelah decision/gate yang relevan tersedia.

---

## 10. Invarian akhir

1. Tidak ada sesi DEV abadi.
2. Satu sesi specialist harus memiliki task reference, worktree, lease/deadline, budget, capability scope, dan kondisi terminal eksplisit.
3. Batas utama adalah mandat/evidence contract; waktu dan token hanyalah circuit breaker tambahan.
4. Hermes boleh menjalankan transisi operasional mekanis yang telah didelegasikan, termasuk meminta memo pada threshold policy.
5. Hermes tidak mengambil alih penilaian teknis DEV, keputusan governance Director, atau state formal Sigma.
6. Semua fakta proyek jangka panjang tetap di Sigma; Hermes membawa pointer/referensi, bukan shadow memory.

---

## 11. Keputusan yang masih diperlukan dari Director

1. Nilai awal `max-turns`, timeout, retry budget, dan cost budget untuk D1–D3.
2. Apakah "dua kegagalan test tanpa kemajuan" cukup sebagai trigger memo awal, atau perlu threshold berbeda per kelas plan.
3. Kapan interactive/continuing DEV session diperbolehkan sebagai exception.
4. Apakah D3 selalu butuh persetujuan Director untuk Opus, atau dapat didelegasikan dalam autonomy envelope tertentu.
5. Format evidence/handoff yang diperlukan sebelum Hermes boleh mengakhiri sesi sebagai hasil parsial.

---

## 12. Batas proposal

Dokumen ini menetapkan arah lifecycle sesi, bukan konfigurasi CLI final. Nama flag, kemampuan detail provider/CLI, serta batas resource perlu diverifikasi terhadap versi Claude Code, Codex, dan Hermes yang dipakai saat implementasi. Tidak ada bagian dokumen ini yang mengizinkan bypass sandbox, permanent auto-approval, commit/push/publish, atau mutasi governance tanpa policy serta persetujuan yang berlaku.

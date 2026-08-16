# PLAN-IMPL — Sigma Humanize Operation

**Sumber**: Lanjutan diskusi evaluasi `feat/notion-integration` pada sesi ini (2026-08-16) — akar masalah "artefak Sigma AI-readable, sulit dibaca manusia", dicontohkan langsung dari `/home/dikoharyadhanto/Documents/Works/Projects/CanopySense/Sigma/` (38 versi `DEV-EXEC`, 15–74KB per file).
**Tanggal**: 2026-08-16 · **Revisi 1**
**Status**: **DRAFT — belum ada satu baris pun yang dieksekusi.** Beberapa keputusan desain masih menunggu input eksternal (lihat §6).
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma — meskipun isinya *mengusulkan* perubahan pada mekanisme gate Sigma sendiri.
**Hubungan dengan plan lain**: `PLAN-IMPL-NOTION-REMOTE-GOVERNANCE-INTEGRATION-V2-20260816` **disetujui dan dikerjakan lebih dulu** (Revisi 2, 2026-08-16), direvisi khusus supaya primitif sync-nya (`syncArtifactToNotion`/`fetchArtifactFromNotion`, D-04/D-05/D-06) generik dan siap dipakai plan ini tanpa rework mesin. Plan ini **adalah prasyarat**: Fase 4 (gate enforcement) di sini menunggu v2 selesai. Lihat §5 (sudah terselesaikan, bukan lagi pertanyaan terbuka).
**Branch**: diusulkan branch baru terpisah, `feat/sigma-humanize-operation`, dari `main` — bukan dari `feat/notion-integration-v2`, supaya progres plan ini tidak terikat nasib plan Notion yang statusnya masih pending. `main` tidak disentuh, tidak ada merge tanpa izin eksplisit Director.

---

## 1. Masalah yang diselesaikan

Artefak Sigma (`DIR-INTENT`, `FMN-PLAN`, `DEV-EXEC`) sengaja ditulis rinci dan berstruktur formal (ID requirement, tabel risk register, checklist evidence, blok "Audit Status" per section) — itu benar untuk kebutuhan validasi CLI dan audit AI. Tapi itu membuatnya nyaris tidak terbaca bagi manusia yang cuma ingin tahu "proyek ini sedang di titik apa, keputusan besarnya apa". Bukti konkret: `CanopySense/Sigma/build/` punya 38 versi `DEV-EXEC` (15–74KB tiap file) dan puluhan `FMN-PLAN` — volume yang tidak realistis dibaca manusia dalam format aslinya.

Solusi yang disepakati: bukan mengubah format artefak asli (itu tetap AI-readable, tetap satu-satunya artefak yang immutable/berwenang untuk validasi gate), tapi menambahkan **operasi baru** yang menghasilkan versi human-readable terpisah dari versi RATIFIED/LOCKED, dan versi human ini yang didorong ke Notion sebagai satu-satunya isi yang manusia baca di sana.

---

## 2. Konsep Inti

### 2.1 Tiga command baru, pola sama seperti `sigma {domain} new`

| Command | Sumber (harus RATIFIED/LOCKED) | Output |
| :--- | :--- | :--- |
| `sigma intent humanize` | `Sigma/design/DIR-INTENT-v<N>.md` | `DIR-INTENT-HUMAN-v<N>.md` |
| `sigma plan humanize` | `Sigma/build/FMN-PLAN-v<N>.md` | `FMN-PLAN-HUMAN-v<N>.md` |
| `sigma exec humanize` | `Sigma/build/DEV-EXEC-v<N>.md` | `DEV-EXEC-HUMAN-v<N>.md` |

Mekanismenya seperti `sigma intent new`: CLI men-scaffold file baru dari template, lalu AI (role yang sama yang memegang artefak aslinya — ARC untuk intent, FMN untuk plan, DEV untuk exec) mengisinya. Bedanya sumber isian bukan kosong, tapi hasil ekstraksi dari dokumen asli yang sudah RATIFIED/LOCKED — jadi humanize **tidak bisa dijalankan terhadap DRAFT**, mencegah dokumen human dibuat dari intent/plan yang masih bisa berubah.

### 2.2 Tiga template baru — didesain eksternal

Template `DIR-INTENT-HUMAN`, `FMN-PLAN-HUMAN`, `DEV-EXEC-HUMAN` beserta aturan gaya penulisan yang diizinkan (batasan panjang, larangan istilah formal/ID, dsb.) **sedang didesain Director bersama ChatGPT mode AUD** (dipilih karena intuisi UX/perspektif manusia). Plan ini tidak mengasumsikan isi template — hanya menyiapkan mekanisme CLI yang akan memuatnya begitu template selesai. Lihat §6.

### 2.3 Gate — wajib, hanya saat lock, hanya kalau integrasi Notion aktif

Berbeda dari config bahasa (`document_language` dkk.) yang sifatnya longgar/preferensi, keputusan Director eksplisit: **kalau `notion_integration.enabled = true` untuk proyek ini, humanize + push ke Notion menjadi Lock Requirement resmi** — setara tingkatnya dengan requirement Gate 1/2/3 yang sudah ada, dicek oleh `sigma {domain} check` dan mem-block `lock`/`ratify` kalau belum terpenuhi. Kalau `notion_integration.enabled = false`, gate ini tidak berlaku sama sekali — bukan soft-warning, benar-benar tidak dicek.

Cakupan wajibnya **hanya di titik lock final** (versi yang akan menjadi RATIFIED/LOCKED), bukan tiap draft iterasi — draft boleh direvisi bebas tanpa humanize.

---

## 3. Konfigurasi `notion_integration.enabled`

### 3.1 Trigger & default

- Ditanyakan sebagai pilihan **wajib dijawab** saat `sigma project start` (bukan opsional/skippable).
- Default: **ON**.
- Fallback otomatis ke **OFF** kalau CLI tidak bisa mendeteksi API Notion tersedia (mis. tidak ada token/koneksi terverifikasi) pada saat itu — proyek tetap bisa dibuat, tidak diblokir oleh ketidaktersediaan Notion.
- Tersimpan di `Sigma/project.config.json` (field baru, mis. `notion_integration.enabled: boolean`), bukan makna sama dengan `notion.enabled` yang sudah ada di skema Notion sync (§ v2 plan) — perlu diselaraskan namanya supaya tidak tumpang tindih dua flag berbeda arti. (Diserahkan ke Fase 1 implementasi, lihat §4.)

### 3.2 Bisa diubah di tengah proyek — dengan pagar

Disetujui Director: **boleh diubah**, dengan syarat:

- Bukan lewat edit `Sigma/project.config.json` manual (file ini tetap CLI-managed, konsisten dengan aturan project).
- Lewat command eksplisit dengan Director Authorization Language, mis. `sigma notion enable --director-confirm` / `sigma notion disable --director-confirm --reason "..."` — pola yang sama dengan command approval-class/risk-acknowledgment lain di proyek ini.
- **Tidak retroaktif.** State berlaku dari titik toggle ke depan. Artefak yang sudah locked+humanized sebelum toggle tetap sah apa adanya; tidak ada tuntutan menulis ulang sejarah.
- Setiap toggle otomatis tercatat di `Sigma/logs/operations.jsonl` (mekanisme yang sudah berjalan otomatis untuk semua CLI invocation) — cukup sebagai jejak audit, tidak perlu mekanisme lock/cooldown tambahan.

### 3.3 Cakupan: proyek baru saja

Gate ini **tidak retroaktif untuk proyek yang sudah ada** (mis. CanopySense) — hanya berlaku untuk proyek yang dibuat setelah fitur ini rilis dan menjawab `notion_integration.enabled = true` saat `project start`. Ini pilihan Director untuk menjaga biaya migrasi tetap murah.

---

## 4. Fase Implementasi (usulan)

| Fase | Isi |
| :--- | :--- |
| **1 — Skema & config** | Field `notion_integration.enabled` di `project.config.json` (perlu diselaraskan dengan namespace `notion.*` dari plan v2 supaya tidak tumpang tindih); prompt wajib di `project start`; command `notion enable/disable --director-confirm` |
| **2 — Struktur artefak human** | Konvensi penamaan/lokasi file (`Sigma/human/` diusulkan sebagai folder terpisah — lihat §6), extension `chain.ts`/`progress-v<N>.json` untuk melacak state humanize per intent/plan/exec (mis. `intent.human: { version, state, generated_at, pushed_to_notion_at }`) |
| **3 — Command `humanize`** | `sigma intent/plan/exec humanize` — scaffold dari sumber RATIFIED/LOCKED, guard menolak jalan kalau sumber masih DRAFT |
| **4 — Gate enforcement** | `sigma {domain} check` diperluas: kalau `notion_integration.enabled`, requirement baru "Human version generated & pushed to Notion" masuk daftar Lock Requirements dan mem-block `lock`/`ratify` kalau belum terpenuhi |
| **5 — Template & style rule** | Integrasi 3 template dari hasil kolaborasi ChatGPT-AUD ke `Sigma/templates/`, plus file aturan gaya (diusulkan `Sigma/rules/HUMANIZE-STYLE.md`, dibundel sama seperti `ARC-RULE.md` dkk.) |
| **6 — Test & dokumentasi** | Guard DRAFT-source, gate block/unblock, non-retroaktif toggle, update `SIGMA_PROTOCOL.md`/registry |

Urutan sengaja menunda Fase 5 (template) sampai paling akhir — supaya Fase 1–4 (mekanisme CLI, gate, config) bisa mulai dikerjakan sekarang tanpa menunggu hasil kolaborasi ChatGPT-AUD selesai.

---

## 5. Dependensi ke plan Notion v2 — TERSELESAIKAN

**Keputusan Director (2026-08-16)**: plan Notion v2 direvisi (Revisi 2) mengikuti kebutuhan Humanize, dan **dikerjakan lebih dulu**. Fase 4 (gate enforcement) di plan ini menunggu v2 selesai — bukan sebaliknya. Begitu v2 selesai, Fase 4 tinggal memanggil primitif `syncArtifactToNotion`/`fetchArtifactFromNotion` yang sudah generik (tidak spesifik ke tipe artefak), tanpa perlu mengubah mesin sync.

Konsekuensi urutan kerja: **v2 duluan, baru Humanize** — bukan paralel.

---

## 6. Pertanyaan Terbuka / Menunggu Input

1. **Template & style rule** (§2.2) — menunggu hasil kolaborasi Director dengan ChatGPT mode AUD. Plan ini tidak bisa masuk Fase 5 sebelum itu selesai.
2. **Siapa yang menjalankan humanize** — usulan saya: role yang sama pemilik artefak asli (ARC → intent, FMN → plan, DEV → exec), dipandu file gaya bersama (`HUMANIZE-STYLE.md`). Belum dikonfirmasi Director.
3. **Lokasi penyimpanan file human** — usulan saya: folder terpisah `Sigma/human/`, supaya gampang dibedakan dari artefak asli dan gampang jadi unit yang di-push ke Notion. Belum dikonfirmasi Director.
4. ~~Dependensi ke plan Notion v2~~ — **terselesaikan**, lihat §5. v2 dikerjakan lebih dulu.
5. **Nama field config** — `notion_integration.enabled` (gate humanize di plan ini) harus **berbeda nama** dari `notion.enabled` (plan v2, soal token/koneksi terkonfigurasi) supaya tidak tertukar. Usulan konkret: rename field gate di plan ini jadi `notion_humanize_gate.enabled` (sudah dipakai sebagai nama acuan di plan v2 §0.1/§5). Diserahkan ke Fase 1 implementasi plan ini untuk dikunci final.
6. **Risiko pergeseran makna** (dibahas sesi sebelumnya, terutama untuk DIR-INTENT) — belum ada mekanisme konkret selain "aturan gaya melarang penambahan/pengubahan makna". Mungkin perlu semacam checklist self-verification singkat di template human itu sendiri — didiskusikan bareng hasil kolaborasi ChatGPT-AUD.

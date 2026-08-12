# PLAN-IMPL — Deferred Protocol/Registry Drift (sigma-ecosystem) + Sigma System Sync & DIR-INTENT Migration (KLHK_JasaLingkunganHidup)

**Sumber**: Permintaan Director 2026-08-12, setelah Multi-Draft Lock Mechanism plan (`PLAN-IMPL-MULTIDRAFT-LOCK-MECHANISM-20260812.md`) selesai dieksekusi dan di-commit (`607c019`). Dua repository dikerjakan dalam satu dokumen ini atas permintaan eksplisit Director.
**Tanggal**: 2026-08-12
**Status**: **Blok A SELESAI DIEKSEKUSI (2026-08-12)** — lihat catatan di bawah §A.2. Blok B belum dieksekusi, menunggu Director commit + reinstall global dulu (permintaan eksplisit: pause di sini). Dua keputusan Director (D-01, D-02) tetap diperlukan sebelum Blok B Fase 3.

**Catatan eksekusi Blok A**: Selain 7 entry registry yang diidentifikasi di §A.2 saat penyusunan plan, sapuan tambahan (grep silang seluruh file untuk pola drift yang sama) menemukan 4 entry lain dengan klaim `STALE_INTENT` yang sama-sama fiktif: `plan_list`, `exec_list`, `project_status`, `session_bootstrap` — total **11 entry** diperbaiki, bukan 7. `total_operations` tetap 52 (tidak ada operasi ditambah/dihapus, murni koreksi deskripsi). `npm run build` + full test suite (316/316, 34 file) tetap hijau setelah perubahan — perubahan ini murni dokumentasi/registry, tidak menyentuh `src/`.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan artifact Sigma, tidak punya otoritas lock/gate Sigma — berlaku untuk KEDUA repo di bawah, meskipun KLHK sendiri adalah proyek Sigma-registered.

---

## 0. Ruang lingkup dan lokasi eksekusi

| Blok | Repo | Root |
| :--- | :--- | :--- |
| A | sigma-ecosystem (repo ini) | `/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem` |
| B | KLHK_JasaLingkunganHidup | `/home/dikoharyadhanto/Documents/Works/Projects/KLHK_JasaLingkunganHidup` |

KLHK Sigma-registered: `document_language`/`interaction_language`/`output_document_language` = Indonesia, `formal_identifier_language` = en (`Sigma/project.config.json`). Plan ini sendiri bukan dokumen Sigma sehingga tidak tunduk pengaturan itu, tapi setiap eksekusi CLI di Blok B tetap beroperasi dalam project itu.

**Urutan wajib**: Blok A harus selesai dan `npm run build` sebelum Blok B Fase 2 (`sigma project sync`), karena sync menarik `SIGMA_PROTOCOL.md`/`SIGMA-OPERATION-REGISTRY.json` langsung dari install global sigma-ecosystem — kalau Blok A belum live, KLHK akan mewarisi drift yang sama yang sedang diperbaiki.

---

## Blok A — sigma-ecosystem: dua item "penundaan" yang dikonfirmasi Director

Dua dari enam item di §15 `PLAN-IMPL-MULTIDRAFT-LOCK-MECHANISM-20260812.md` bersifat penundaan murni (bukan batasan desain permanen seperti empat item lainnya di section yang sama) — Director mengonfirmasi keduanya termasuk dalam scope plan ini.

### A.1 `SIGMA_PROTOCOL.md` §5.2/§5.3 — tabel definisi artefak basi

Diverifikasi langsung terhadap template nyata (`Sigma/templates/FMN-PLAN-TEMPLATE.md`, `Sigma/templates/DEV-EXEC-TEMPLATE.md`), bukan diasumsikan dari isi protokol lama.

**§5.2 FMN-PLAN — klaim vs kenyataan:**

| Klaim §5.2 saat ini | Kenyataan |
| :--- | :--- |
| "6 sections, all written before lock, all immutable after lock" | **10 section** (Source Alignment, Pre-requirement, Work Order/Task Plan, Acceptance Criteria, Implementation Constraints, Protocol Overrides & Expansions, Pre-Build Test Contract, DEV Handoff Instructions, AUD Findings, Director's Summary) |
| — | Section 1–8 immutable setelah lock; **Section 9 (AUD Findings) eksplisit boleh ditambah setelah lock** ("This section may be appended after the plan is locked" — bukan immutable) |

**§5.3 DEV-EXEC — klaim vs kenyataan:**

| Klaim §5.3 saat ini | Kenyataan |
| :--- | :--- |
| "Authored by DEV (Sections 1–12), FMN (Section 13), AUD (Section 14), Director (Sections 15–16)" | **18 section.** DEV pre-build: 1–6 (bukan 1–12). FMN pre-build review: Section 7 (bukan 13). DEV post-build: 8–15. FMN post-build review: Section 16. Section 17 (Director Observation Report) **ditulis DEV**, bukan Director — hanya mentranskripsi laporan lisan Director. Section 18 ditulis DEV **atau** FMN. |
| "AUD (Section 14)" | **AUD tidak memiliki section apa pun di DEV-EXEC.** Catatan kepemilikan template sendiri ("Section Ownership" di header) tidak pernah menyebut AUD sama sekali. |
| "Out-of-scope Director requests in Section 17" | Section 17 memang berisi laporan observasi Director, tapi **ditulis dan ditranskripsi oleh DEV** — bukan "Director" sebagai penulis. |

Item ini sudah basi sejak sebelum sesi ini (dicatat di header `Discussion/2026-08-12_1413_Plan-exec-lock-mechanism-multidraft.md` sebagai "wrongly claims full post-lock immutability... claims an AUD (Section 14) that doesn't exist"), dan drift-nya **bertambah lebar** oleh Fase 7 sesi sebelumnya (Pre-requirement + Technical Research menambah 2 section baru, mendorong semua nomor bergeser).

**Perbaikan**: tulis ulang §5.2 dan §5.3 mengikuti gaya §5.1 (DIR-INTENT) yang sudah akurat — tabel section beserta pemilik dan status immutability per section, bukan cuma jumlah section dalam satu kalimat. Sumber kebenaran: header "Section Ownership" di masing-masing template file, bukan asumsi.

### A.2 `SIGMA-OPERATION-REGISTRY.json` — 7 operation entry dengan field/mekanisme fiktif

Diverifikasi dengan grep silang terhadap `src/engine/chain.ts` (bentuk skema nyata) dan `src/commands/*.ts` (command nyata). Field `active_version`/`active_state` memang ada untuk `plan`/`exec` (keduanya `ArtifactTracker`) — bukan drift. Yang salah adalah domain **intent** dan **close**, yang di skema nyata adalah **objek tunggal** (`SingleIntentState`/`CloseState | null`, model Opsi C dari PLAN-EVAL-01), tidak pernah punya `active_version`/`active_state` sebagai field.

| `operation_id` | Drift ditemukan | Bukti |
| :--- | :--- | :--- |
| `intent_new` | Output menyebut `intent.active_version set; intent.active_state = 'DRAFT'` — field ini tidak ada di skema intent | `chain.ts` — `intent` adalah objek `{ version, state, ... }` tunggal per chain |
| `intent_status` | "STALE_INTENT propagation events" — mekanisme `stale_intent` sudah dihapus sejak PLAN-EVAL-01 | Tidak ada satu pun match untuk `stale_intent` di `src/commands/intent.ts` |
| `intent_list` | "superseded_by references" — field ini dideklarasikan di tipe tapi **tidak pernah di-set** di mana pun | `chain.ts:31` deklarasi + `chain.ts:177` komentar eksplisit "superseded_by intentionally omitted" |
| `close_new` | Flag `--ack-stale-intent` dan gate `stale_intent` sepenuhnya fiktif; output `close.active_version`/`close.active_state` tidak ada (close = objek tunggal) | `src/commands/close.ts` — satu-satunya gate adalah `hasCleanGate3Chain()` + `hasGate35Score()`, tidak ada flag `--ack-stale-intent` di command definition |
| `close_lock` | `close.active_state` tidak ada; "Auto-supersedes any prior LOCKED CLOSE (single-active policy)" **tidak diimplementasikan** (guard 1:1 ada di `registerCloseDraft`, tapi `lockActiveClose` tidak men-supersede apa pun); `decision_harvest` fiktif (sama seperti `plan_lock`/`exec_lock` yang sudah dibereskan sesi sebelumnya — D-12 plan sebelumnya hanya menyisir dua entry itu, `close_lock` terlewat) | `close.ts` `lockActiveClose` — hanya set state/locked_at/lifecycle_state, tidak ada logic supersede |
| `close_status` | `close.active_version` tidak ada | sama seperti di atas |
| `roadmap_new` | Menyebut "`sigma roadmap lock` promotes it to LOCKED" — **command ini tidak ada** | `src/commands/roadmap.ts` hanya punya `new`, `check`, `render`, `list`. ROADMAP auto-lock lewat `close lock`, bukan command terpisah |

**Perbaikan**: sunting ketujuh entry — hapus klaim field/flag/command fiktif, ganti dengan deskripsi yang cocok skema nyata (mengikuti pola perbaikan `plan_lock`/`exec_lock`/`exec_new` sesi sebelumnya). `total_operations` **tidak berubah** (tetap 52) — tidak ada operasi ditambah/dihapus, hanya deskripsi yang diperbaiki.

**Di luar scope A.2** (dicatat, bukan bagian plan ini): drift `active_state`/`active_version` yang SAH untuk `plan`/`exec` (bukan drift, itu skema aslinya), dan ~18 fixture test yang masih menulis literal `state: 'LOCKED'` untuk intent (kosmetik, dinormalisasi `readChain()` saat baca, sudah dicatat di memory sebelumnya sebagai tidak berdampak).

---

## Blok B — KLHK_JasaLingkunganHidup

### B.0 Temuan verifikasi (state proyek saat ini)

Diverifikasi langsung terhadap file di `KLHK_JasaLingkunganHidup/Sigma/`, bukan diasumsikan.

- **4 chain** (`progress-v1.json`..`progress-v4.json`), aktif: `v4`. Chain `v1` CLOSED; `v2`, `v3`, `v4` BUILD.
- **Semua 4 chain masih `schema_version: "1.0.0"`** dan `intent.state` literal `"LOCKED"` (terminologi pra-rename) — belum pernah menjalani migrasi RATIFIED yang sudah lama tersedia di sigma-ecosystem (bukan bagian Multi-Draft Lock plan; itu memang tidak menaikkan schema by design). Ternormalisasi ke `RATIFIED` saat dibaca (`readChain()`), tapi belum dipersist ke disk.
- Chain `v2` (EXEC `v1.7` DRAFT) dan `v4` (EXEC `v3.4` DRAFT) punya eksekusi yang masih terbuka — **bukan sesuatu yang dibereskan plan ini**, hanya dicatat sebagai konteks. Dengan definisi Gate 3 baru (sesi sebelumnya), kedua chain ini tidak bisa `close new` sampai EXEC itu di-lock atau plan-nya di-supersede — itu pekerjaan build biasa lewat peran DEV, bukan migrasi template.
- **Dokumen DIR-INTENT** (`Sigma/design/`):

  | File | Marker schema | Section yang hilang terhadap `requiredSections` saat ini |
  | :--- | :--- | :--- |
  | `DIR-INTENT-v1.md` | 2 | **COMPREHENSIVE_RESEARCH — hilang total** (satu-satunya gap struktural nyata di antara 4 dokumen) |
  | `DIR-INTENT-v2.md` | 2 | tidak ada — lengkap |
  | `DIR-INTENT-v3.md` | 3 | tidak ada — lengkap |
  | `DIR-INTENT-v4.md` | 3 | tidak ada — lengkap |

  Target: schema=4 (versi `Sigma/templates/DIR-INTENT-TEMPLATE.md` sigma-ecosystem saat ini, 14 section termasuk `AMENDMENT_HISTORY` opsional).

- **KLHK tidak punya folder `Sigma/templates/` sendiri.** `copyTemplateToArtifact()` selalu resolve ke `~/.sigma/templates/` (global) lebih dulu — sudah diverifikasi berisi template terkini (`DIR-INTENT-TEMPLATE.md schema=4`, `FMN-PLAN-TEMPLATE.md schema=2`). **Artinya dokumen BARU yang dibuat di KLHK otomatis memakai template terbaru tanpa aksi apa pun** — pekerjaan Blok B murni untuk 4 dokumen yang **sudah ada**, bukan konfigurasi.
- **Bundle KLHK jauh lebih lama** dari sigma-ecosystem saat ini: `SIGMA_PROTOCOL.md` header `"Version: v0.3 (Phase 2 — Governance Doctrine)"`, `SIGMA-OPERATION-REGISTRY.json` `total_operations: 53` (angka historis lain lagi — bukan 52 atau 54). Akan disegarkan lewat `sigma project sync --confirm` di Fase 2.
- `role-memory/*.json` isinya reminder generik boilerplate (`"authority": "Reminder only..."`), bukan kustomisasi khusus proyek — **aman ditimpa sync**, tidak ada yang hilang.
- **`sigma` global sudah terhubung langsung ke `dist/` sigma-ecosystem** (`npm link`) — perubahan Blok A otomatis "live" setelah `npm run build`, tidak perlu langkah install terpisah.
- **Working tree KLHK sedang kotor** (`git status`): perubahan belum di-commit di `Sigma/progress-v4.json`, `Sigma/build/ROADMAP-v4.md`, beberapa pesan baru di `Sigma/messages/`, dan berkas non-Sigma lain. Ini bukan sesuatu yang plan ini sentuh atau selesaikan — dicatat sebagai prasyarat risiko di §Risiko.

### B.1 Fase 1 — `sigma doctor --all-versions`

Migrasi mekanis murni, sudah teruji (`doctor-schema-migration.test.ts` di sigma-ecosystem), dijalankan sekali terhadap keempat chain:

```bash
cd /home/dikoharyadhanto/Documents/Works/Projects/KLHK_JasaLingkunganHidup
sigma doctor --all-versions
```

Efek: `intent.state` `"LOCKED"` → `"RATIFIED"` (+ `locked_at`→`ratified_at`) dipersist ke disk untuk keempat chain; `schema_version` naik ke `1.1.0` (`SCHEMA_VERSION` konstanta saat ini — **tidak berubah lagi oleh Multi-Draft Lock plan**, jadi 1.1.0 tetap angka final yang benar). `doctor` bukan operasi dry-run — ia langsung menulis perbaikan begitu dijalankan (konsisten dengan sifatnya sebagai reconciliation, bukan mutasi destruktif) dan melaporkan `repaired[]` di stdout.

Tidak butuh `--director-confirm` — `doctor` tidak pernah digerbang seperti itu di kode manapun.

### B.2 Fase 2 — `sigma project sync --confirm`

```bash
cd /home/dikoharyadhanto/Documents/Works/Projects/KLHK_JasaLingkunganHidup
sigma project sync            # dry-run dulu, tinjau daftar file yang akan ditimpa
sigma project sync --confirm  # setelah Director meninjau
```

Menimpa: `Sigma/SIGMA_CONSTITUTION.md`, `Sigma/SIGMA_PROTOCOL.md`, `Sigma/rules/*.md`, `Sigma/SIGMA-OPERATION-REGISTRY.json`, `Sigma/SIGMA-REGISTRY.json`, `Sigma/role-memory/*.json`, plus upsert `.mcp.json`/`.cursor/mcp.json`/config MCP lain. **Tidak menyentuh `Sigma/templates/`** (KLHK memang tidak punya salinan lokal — lihat B.0) dan **tidak menyentuh dokumen artefak manapun** (`design/`, `build/`, `close/`) — sync murni file governance/doktrin, bukan dokumen kerja.

Prasyarat: Blok A sudah `npm run build` di sigma-ecosystem (lihat §0) — kalau tidak, KLHK akan menarik `SIGMA_PROTOCOL.md`/registry yang **masih** mengandung drift A.1/A.2.

### B.3 Fase 3 — Migrasi 4 dokumen DIR-INTENT ke template terbaru

Per dokumen, dua tindakan independen: (a) bump marker schema (kosmetik), (b) isi konten yang benar-benar hilang (hanya relevan untuk v1).

| File | Tindakan (a) — bump marker | Tindakan (b) — konten |
| :--- | :--- | :--- |
| `DIR-INTENT-v1.md` | `schema=2` → `schema=4` | **Perlu keputusan D-01** — lihat di bawah |
| `DIR-INTENT-v2.md` | `schema=2` → `schema=4` | tidak ada — sudah lengkap |
| `DIR-INTENT-v3.md` | `schema=3` → `schema=4` | tidak ada — sudah lengkap |
| `DIR-INTENT-v4.md` | `schema=3` → `schema=4` | tidak ada — sudah lengkap |

**Section 14 (`AMENDMENT_HISTORY`) sengaja TIDAK ditambahkan ke keempat dokumen.** Ini section opsional (`optionalSections`) yang dirancang muncul lewat auto-inject **hanya** saat `sigma intent amendment` benar-benar dipanggil pada chain itu (`renderAmendmentHistory()` di `src/commands/intent.ts`, satu-satunya call site) — menambahkannya lebih dulu bertentangan dengan desain "jangan sentuh dokumen lama sampai memang dibutuhkan" yang sudah ditetapkan sesi sebelumnya. Keempat chain KLHK belum pernah diamandemen (schema 1.0.0 bahkan belum punya field `amendments[]` sama sekali) — tidak ada apa pun untuk di-backfill di sana.

#### D-01 — DIR-INTENT-v1.md hilang total COMPREHENSIVE_RESEARCH

Intent ini sudah RATIFIED (dulu "LOCKED") dan **CLOSED** sejak lama. Menambah section yang hilang bukan governance amendment biasa — chain v1 bahkan belum punya mekanisme `amendments[]` (schema 1.0.0) untuk mencatatnya sebagai amandemen resmi. Dua opsi:

- **Opsi A (rekomendasi)**: tambahkan section placeholder dengan catatan eksplisit bahwa ini backfill retroaktif saat migrasi template (mis. *"Section ditambahkan retroaktif saat migrasi template 2026-08-12; riset komprehensif tidak dilakukan secara formal pada saat penyusunan intent ini."*) — sehingga `sigma intent check --v v1` tidak lagi gagal validasi struktural, tanpa berpura-pura riset itu benar-benar pernah dilakukan.
- **Opsi B**: biarkan v1 apa adanya sebagai catatan historis. Dokumen CLOSED tidak lagi divalidasi otomatis oleh command manapun kecuali dijalankan manual (`intent check --v v1`) — gap ini inert secara fungsional selama tidak ada yang menjalankan command itu.

Saya tidak mengeksekusi salah satu tanpa keputusan Director eksplisit — ini menyentuh dokumen yang secara semantik sudah final.

#### D-02 — Apakah bump marker schema di keempat file benar-benar diinginkan?

Ini murni kosmetik — `docCheck.ts` tidak pernah membandingkan angka schema terhadap nilai minimum, jadi tidak melakukan apa pun **tidak menimbulkan risiko fungsional apa pun**. Pertanyaannya murni soal akurasi metadata dokumen vs. sikap project menghindari churn tanpa manfaat fungsional. Rekomendasi saya: **lakukan** — ini satu baris per file, murah, dan langsung menyingkirkan kebingungan pembaca berikutnya yang membandingkan angka schema dengan template terkini. Beda kelas dengan menambah konten besar (D-01) yang punya konsekuensi substantif.

### B.4 Verifikasi

- `sigma intent list` (di KLHK) → keempat chain menunjukkan `RATIFIED`, bukan `LOCKED`.
- `sigma intent check --v v1` / `--v v2` / `--v v3` / `--v v4` → v2–v4 harus `ok: true` bersih; v1 bergantung keputusan D-01 (Opsi A → bersih; Opsi B → tetap melaporkan `COMPREHENSIVE_RESEARCH` hilang, sesuai ekspektasi).
- `sigma project status` → tidak ada `INVALID Runtime Warning` baru muncul akibat migrasi.
- `git diff` di KLHK setelah Fase 2 (sync) — pastikan hanya file governance yang disebutkan di B.2 yang berubah, tidak ada dokumen kerja (`design/`, `build/`, `close/`) yang tersentuh.

---

## Urutan eksekusi wajib

1. **Blok A** (sigma-ecosystem) — perbaiki `SIGMA_PROTOCOL.md` §5.2/§5.3 + 7 entry registry, `npm run build`, review, commit.
2. **Blok B Fase 1** — `sigma doctor --all-versions` di KLHK.
3. **Blok B Fase 2** — `sigma project sync --confirm` di KLHK (butuh #1 sudah live).
4. **Blok B Fase 3** — migrasi 4 dokumen DIR-INTENT, setelah D-01/D-02 diputuskan.
5. **Blok B Fase 4** — verifikasi.

Blok A tidak bergantung pada Blok B dan bisa dikerjakan sepenuhnya independen kalau Director ingin memisahnya nanti — digabung di sini murni karena diminta eksplisit dalam satu putaran kerja.

---

## Risiko

1. **Working tree KLHK kotor saat ini** (§B.0) — `sigma doctor`/`sigma project sync` akan menulis di atas state yang sudah punya perubahan belum ter-commit. Saya tidak men-stash atau meng-commit apa pun di KLHK atas inisiatif sendiri; Director perlu memutuskan apakah WIP itu di-commit dulu sebelum Fase 1–2 dijalankan, supaya diff hasil migrasi mudah dibedakan dari WIP yang sudah ada.
2. **`sigma project sync --confirm` menimpa tanpa backup otomatis** — git di KLHK adalah jaring pengamannya (project sudah pakai `.git`), bukan mekanisme backup terpisah, konsisten dengan sikap project terhadap ad-hoc backup.
3. **D-01 Opsi A menyentuh dokumen RATIFIED+CLOSED** — perubahan pada dokumen yang secara semantik final. Backfill dengan catatan eksplisit meminimalkan risiko ("dinyatakan retroaktif", bukan menyamarkan seolah riset asli), tapi tetap perlu persetujuan eksplisit sebelum dieksekusi.
4. **Blok A menyentuh dokumentasi yang mungkin dibaca ARC/FMN/DEV/AUD secara aktif** di sigma-ecosystem maupun proyek lain yang sudah sync sebelumnya — perubahan §5.2/§5.3 murni memperbaiki keakuratan deskripsi (bukan mengubah perilaku CLI), jadi dampaknya rendah, tapi tetap sebaiknya di-review sebelum commit karena menyentuh dokumen doktrin yang dibaca lintas peran.

---

## Keputusan

| ID | Pertanyaan | Rekomendasi |
| :--- | :--- | :--- |
| D-01 | DIR-INTENT-v1.md yang hilang COMPREHENSIVE_RESEARCH: backfill dengan catatan retroaktif (Opsi A) atau biarkan sebagai catatan historis (Opsi B)? | **Opsi A** — closes gap struktural nyata tanpa berpura-pura riset itu terjadi |
| D-02 | Bump marker schema di keempat DIR-INTENT (kosmetik, tanpa risiko fungsional)? | **Ya** |

---

## Eksplisit di luar scope

- Migrasi FMN-PLAN/DEV-EXEC/ROADMAP/DIR-CLOSE KLHK ke template terbaru — Director eksplisit minta **hanya intent**.
- Menuntaskan DEV-EXEC `v1.7` (chain v2) dan `v3.4` (chain v4) yang masih DRAFT — pekerjaan build biasa lewat peran DEV, bukan migrasi template.
- Commit/stash WIP KLHK yang sudah ada — keputusan Director, bukan tindakan otomatis plan ini (lihat Risiko #1).
- Empat item lain di §15 `PLAN-IMPL-MULTIDRAFT-LOCK-MECHANISM-20260812.md` yang **bukan** penundaan (resolusi dependensi transitif Pre-requirement, gate/verifikasi AI untuk Technical Research, mekanisme resume DRAFT EXEC, penghapusan penuh field `active_version`/`active_state` dari skema) — itu batasan desain permanen atau pekerjaan terpisah, dikonfirmasi Director **tidak** termasuk plan ini.
- Drift `active_state`/`active_version` yang memang sah untuk domain `plan`/`exec` di registry — bukan drift, itu skema aslinya (lihat A.2).

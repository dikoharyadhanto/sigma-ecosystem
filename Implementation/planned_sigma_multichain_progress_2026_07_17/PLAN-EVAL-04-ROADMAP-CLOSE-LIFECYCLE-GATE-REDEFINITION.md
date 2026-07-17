# PLAN-EVAL-04 — Roadmap/Close Lifecycle & Gate 1.5 Redefinition

**Sumber**: [DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md](../planned_sigma_evaluation_2026_07_17/DISCUSSION-MULTI-FILE-PROGRESS-CHAIN-ARCHITECTURE.md) (Konsolidasi Lanjutan bagian 8; Isu Terbuka Baru lanjutan #8)
**Tanggal**: 2026-07-17 — **HAMPIR SELURUH SCOPE DITEMUKAN SUDAH SELESAI oleh PLAN-EVAL-01, dicatat ulang 2026-07-17** (lihat "Koreksi Besar" di bawah — baca ini duluan sebelum bagian lain di dokumen ini).
**Status**: DRAFT — scope asli sudah 90% selesai secara tidak sengaja (bukan diklaim, dikonfirmasi lewat pembacaan kode nyata). Sisa scope genuine cuma satu item: Isu Terbuka #8.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## KOREKSI BESAR (2026-07-17) — baca ini dulu

Draf awal dokumen ini (di bawah, dipertahankan apa adanya sebagai riwayat)
menulis seluruh scope-nya sebagai pekerjaan yang **akan** dilakukan
plan-eval ini. Saat PLAN-EVAL-01 diimplementasikan (Fase 3, 2026-07-17),
ditemukan fakta yang mengubah gambaran itu total: **`sigma close lock`
SUDAH memanggil `lockActiveRoadmap()` sebagai efek samping HARI INI, sebelum
migrasi apa pun dimulai** (dicek langsung di `src/commands/close.ts` versi
lama sebelum disentuh). PLAN-EVAL-01 sendiri sempat salah paham soal ini di
draf awalnya juga (mengira ini perilaku baru untuk PLAN-EVAL-04) — begitu
dikoreksi, jadi jelas: seluruh mekanisme cascade auto-lock roadmap itu
**perilaku existing yang wajib dipertahankan PLAN-EVAL-01** (prinsip "migrasi
storage, bukan migrasi perilaku"), bukan desain baru milik plan-eval ini.

**Status per item scope asli, dicek terhadap kode nyata setelah PLAN-EVAL-01 Fase 3**:

| Item scope asli | Status | Bukti |
| --- | --- | --- |
| Roadmap & Close tetap 3 state | **SELESAI** (di PLAN-EVAL-01) | `RoadmapState`/`CloseState` di `src/engine/chain.ts` sudah `'DRAFT' \| 'LOCKED' \| 'SUPERSEDED'` |
| Hapus model `ACTIVE`/`INACTIVE` roadmap | **SELESAI** (di PLAN-EVAL-01) | Struktural — dipaksa begitu roadmap jadi objek tunggal per chain (§3.5), bukan pilihan independen |
| Roadmap auto-`LOCKED` sebagai efek samping `close lock` | **SELESAI** (sudah ada sebelum PLAN-EVAL-01, dipertahankan) | `src/commands/close.ts` — `lockActiveRoadmap(chain)` dipanggil kondisional sebelum `lockActiveClose(chain)`, persis pola lama |
| Close tetap punya command `lock` eksplisit | **SELESAI** (tidak pernah berubah) | Tidak disentuh sejak awal |
| `SUPERSEDED` Roadmap/Close selalu cascade otomatis | **SELESAI** (di PLAN-EVAL-01) | `supersedeIntentVersion()` di `chain.ts` men-cascade roadmap+close sekaligus |
| Redefinisi Gate 1.5 ("roadmap ada dan belum SUPERSEDED") | **SELESAI** (di PLAN-EVAL-01, dipaksa) | `src/commands/plan.ts` — `getRoadmapPathIfEligible()`: `chain.roadmap !== null && chain.roadmap.state !== 'SUPERSEDED'` |
| Tinjau ulang gate/hubungan lain lintas-chain (Isu Terbuka #8) | **BELUM** — sengaja dideferred | Tidak disentuh PLAN-EVAL-01 sama sekali |

**Kesimpulan**: dari 6 item scope asli, 5 sudah selesai — bukan karena
plan-eval ini dikerjakan lebih dulu, tapi karena kelimanya ternyata
**konsekuensi terpaksa** dari migrasi storage PLAN-EVAL-01 sendiri (§3.5:
"bagian struktural... wajib ditangani di PLAN-EVAL-01"), bukan keputusan
desain independen yang bisa ditunda. **Scope plan-eval ini menyusut jadi
cuma Isu Terbuka #8** — lihat "Scope (setelah koreksi)" di bawah.

---

## Scope (setelah koreksi)

Satu-satunya pekerjaan genuine yang tersisa:

- **Isu Terbuka #8** — tinjau ulang **hubungan/gate lain** (di luar Gate
  1.5, yang sudah selesai) yang mungkin diam-diam masih mengasumsikan
  hubungan lintas Intent major version dari model lama. DISCUSSION doc
  sengaja tidak melakukan audit menyeluruh di muka — setiap plan-eval
  turunan (termasuk yang ini) wajib meninjau ulang gate/hubungan yang
  relevan dengan scope-nya sendiri **saat dikerjakan**, bukan menunggu
  audit besar sebelumnya.
- Kandidat awal untuk ditinjau (belum diverifikasi, cuma dugaan berdasarkan
  nama — perlu dicek satu per satu terhadap kode `chain.ts`/command files
  hasil PLAN-EVAL-01 saat plan-eval ini benar-benar dikerjakan):
  - Apakah ada asumsi tersisa di `doctor --reconstruct`/`reconstruct.ts`
    (masih di jalur lama, PLAN-EVAL-05) yang butuh penyesuaian begitu
    PLAN-EVAL-05 mulai memigrasikannya ke `ChainState`?
  - Apakah `getNextValidOperations()` (chain.ts, PLAN-EVAL-01) sudah benar
    untuk semua kombinasi state chain, atau ada kombinasi yang lolos dari
    analisis Fase 1?
  - Perilaku `doctor` terhadap file chain yatim (Isu Terbuka PLAN-EVAL-05
    yang masih terbuka) — apakah ini juga menyentuh asumsi lintas-chain
    yang relevan untuk plan-eval ini, atau murni scope PLAN-EVAL-05?

## Dependency

- **PLAN-EVAL-01** (wajib, sudah selesai) — model objek tunggal per chain
  dan redefinisi Gate 1.5 sudah ada, jadi baseline peninjauan Isu Terbuka #8
  sekarang adalah kode PLAN-EVAL-01 yang sudah jadi, bukan lagi model lama.

## Di luar scope

- Semua 5 item yang sudah SELESAI di tabel atas — jangan dikerjakan ulang.
- Perubahan storage/file layout — sudah selesai di PLAN-EVAL-01.
- Migrasi data project existing (JLH) — PLAN-EVAL-03.
- Migrasi `doctor --reconstruct` — PLAN-EVAL-05.

## Risiko

- Risiko utama sekarang jauh lebih kecil dari draf awal (5 dari 6 item
  sudah tidak perlu dikerjakan/diverifikasi ulang risikonya). Risiko yang
  tersisa: Isu Terbuka #8 berisiko "ditemukan lagi" gate/asumsi lintas-chain
  yang bermasalah saat investigasi — anggarkan waktu untuk investigasi,
  bukan cuma coding, tapi skalanya jauh lebih kecil dari perkiraan semula.

---

## Riwayat — draf asli sebelum koreksi (dipertahankan sebagai catatan, JANGAN dijadikan acuan implementasi)

### Inti (asli)

Di dunia 1:1 per-chain, model `ACTIVE`/`INACTIVE` Roadmap (arbitrase
kompetisi antar-roadmap) tidak relevan lagi — tidak ada lagi yang perlu
diarbitrase karena satu chain hanya punya satu Roadmap.

### Scope (asli, sudah selesai — lihat tabel koreksi di atas)

- Roadmap & Close tetap 3 state (`DRAFT`/`LOCKED`/`SUPERSEDED`) — bukan
  disederhanakan jadi 2.
- Hapus command `sigma roadmap lock` (tidak pernah ada) dan model
  `ACTIVE`/`INACTIVE` — Roadmap selalu `DRAFT` sepanjang chain berjalan
  (dashboard hidup, terus di-render ulang), baru otomatis jadi `LOCKED`
  sebagai efek samping saat `sigma close lock` berhasil.
- Close tetap punya command `lock` eksplisit — tidak berubah.
- `SUPERSEDED` untuk Roadmap maupun Close selalu otomatis (cascade dari
  `intent supersede --director-confirm`), tidak pernah manual. Chain yang
  ditinggalkan sebelum close: Roadmap lompat `DRAFT → SUPERSEDED` langsung.
- Redefinisi Gate 1.5: dari "ROADMAP harus `ACTIVE`" jadi "Roadmap untuk
  chain ini sudah dibuat (ada) dan belum `SUPERSEDED`" — begitu
  `sigma roadmap new` sukses sekali, Gate 1.5 terbuka permanen sampai chain
  berakhir.
- Tinjau ulang gate/hubungan lain yang mungkin diam-diam mengasumsikan
  hubungan lintas Intent major version (Isu Terbuka #8 — **satu-satunya
  item yang masih genuine scope**, lihat "Scope (setelah koreksi)" di atas).

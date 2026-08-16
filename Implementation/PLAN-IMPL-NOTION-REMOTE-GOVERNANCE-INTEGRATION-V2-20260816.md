# PLAN-IMPL — Notion Remote Governance Integration (v2 — Rancang Ulang)

**Sumber**: Evaluasi Professional Mode terhadap branch `feat/notion-integration` (commit `5cdc44c`), dilanjutkan diskusi desain dengan Director pada sesi ini (2026-08-16).
**Tanggal**: 2026-08-16 · **Revisi 2**
**Status**: **DISETUJUI — dikerjakan lebih dulu.** Scope direvisi mengikuti kebutuhan `PLAN-IMPL-SIGMA-HUMANIZE-OPERATION-20260816` (lihat §0.1), tapi eksekusi plan ini **tidak menunggu** Humanize selesai — Humanize yang menunggu fondasi ini.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma. Repo `sigma-ecosystem` ini sendiri tidak Sigma-registered (tidak ada `Sigma/project.config.json` di root repo), jadi fitur ini tidak akan pernah dipakai untuk memurnikan `Sigma/` milik repo ini sendiri — target fitur adalah proyek konsumen `sigma-cli`.
**Branch**: `feat/notion-integration-v2`, dibuat dari `main` (bukan dari `feat/notion-integration`). `feat/notion-integration` lama **dibiarkan utuh, tidak dihapus** — jadi bukti/referensi pola kesalahan yang harus dihindari di sini. `main` tidak disentuh dan tidak akan menerima merge sampai Director mengizinkan eksplisit.

---

## 0.1 Revisi 2 — direvisi mengikuti kebutuhan Sigma Humanize Operation (2026-08-16)

Director memutuskan: Notion bukan lagi tempat baca artefak AI-readable apa adanya — Notion adalah **ruang baca manusia**, dan yang layak dibaca manusia adalah dokumen hasil `sigma intent/plan/exec humanize` (lihat `PLAN-IMPL-SIGMA-HUMANIZE-OPERATION-20260816`), bukan `DIR-INTENT`/`FMN-PLAN`/`DEV-EXEC` mentah. Plan v2 ini **dikerjakan lebih dulu** sebagai fondasi transport-nya, dan direvisi supaya tidak membangun kebiasaan yang nanti harus dibongkar:

| Bagian | Revisi 1 (sebelumnya) | Revisi 2 |
| :--- | :--- | :--- |
| Motif #2 (§1) | "Artefak dipindahkan ke Notion" — implisit artefak AI-readable mentah | Yang dipindah adalah **konten yang Humanize hasilkan nanti**; v2 tidak mengasumsikan isi spesifik, cuma menyediakan jalur push/pull yang benar |
| `sigma notion push` default (D-07) | Push dashboard + artefak locked mentah (DIR-INTENT/FMN-PLAN) + state JSON | Push dashboard + state JSON saja secara default. Push artefak mentah **ditunda** — jadi tanggung jawab Humanize nanti, bukan default v2 |
| Primitif `syncArtifactToNotion`/`fetchArtifactFromNotion` | Dipanggil langsung dari alur `sigma notion push` untuk artefak locked | Tetap dibangun dan diperbaiki penuh (D-04, D-05, D-06) tapi jadi **primitif generik** — dipanggil `sigma notion push` untuk dashboard/state sekarang, dan akan dipanggil command Humanize nanti untuk dokumen human. Tidak ada rework mesin yang dibutuhkan saat Humanize datang |
| Nama field config | `notion.enabled` (satu-satunya) | Tetap `notion.enabled` untuk "Notion terkonfigurasi & terkoneksi" (dipakai plan ini). Humanize akan pakai nama **berbeda** untuk gate wajibnya (mis. `notion_humanize_gate.enabled`) supaya dua flag yang mirip nama tapi beda arti tidak tertukar — lihat §5 Humanize plan poin 5, sekarang terselesaikan di sisi v2 dengan tidak menyentuh `notion.enabled` sama sekali |

Konsekuensi: `sigma notion pull <type> <version>` tetap ada sebagai command generik (menerima `<type>` apa saja), tapi sampai Humanize rilis, satu-satunya konten yang benar-benar terkirim ke Notion lewat jalur default hanyalah dashboard dan state JSON — bukan dokumen artefak. Ini konsisten dengan prinsip "Notion cuma berisi apa yang layak dibaca manusia" sejak hari pertama v2 jalan, bukan ditambal belakangan.

---

## 0. Kenapa rancang ulang, bukan lanjut dari branch lama

Evaluasi terhadap `feat/notion-integration` menemukan implementasi yang superficially lengkap (build lolos, 322 test lolos, E2E manual sukses) tapi menyembunyikan cacat yang baru terlihat kalau direproduksi:

1. **`findProjectRoot()` diubah untuk seluruh sistem**, bukan cuma modul Notion. [`src/utils/fs.ts`](../src/utils/fs.ts) menambahkan `.sigma-identity.json` sebagai anchor setara `Sigma/activate_status.json` — padahal fungsi ini dipakai 18 file command. Direproduksi langsung: setelah `--clean-local` menghapus total `Sigma/`, `sigma project status` dan `sigma doctor` melaporkan "no chain yet" (bukan "state hilang"), dan `sigma intent new` **membuat chain v1 baru secara diam-diam** di proyek yang riwayatnya sebenarnya masih ada di Notion. Tidak ada peringatan, tidak ada deteksi konflik.
2. **`--auto-sync` adalah UI dekoratif** — field `auto_sync` tidak pernah dibaca di luar `notion.ts`/`projectConfig.ts`/`notionService.ts`. Tidak ada satu pun pemanggilan dari `intent.ts`, `plan.ts`, `exec.ts`, `close.ts`. Opsi ini menjanjikan sesuatu yang tidak pernah terjadi.
3. **`syncArtifactToNotion` menghapus block lama sebelum konten baru terkonfirmasi sukses ter-upload** — kombinasi dengan `--clean-local` bisa membuat data hilang di kedua sisi (lokal sudah terhapus, remote gagal terisi).
4. **`blocks.slice(0, 100)`** memotong diam-diam tanpa peringatan; batas 100 block/request dari Notio Blocks API tidak di-paginate baik saat push maupun fetch.
5. **Pencarian halaman lewat `/v1/search`** scope-nya seluruh workspace, tidak di-paginate, dan cocok berdasarkan title-matching manual — rawan salah temu atau duplikat di workspace besar.
6. **Token Notion plaintext** ditulis ke `.sigma-identity.json` di root proyek, dan tidak ada mekanisme yang meng-gitignore file itu (hanya `Sigma/` yang ditangani `ensureGitignoreNotion`).

Detail lengkap ada di transkrip evaluasi sesi ini; poin 1–6 di atas semuanya sudah direproduksi atau diverifikasi langsung ke source, bukan dugaan.

---

## 1. Motif inti yang harus dipenuhi (disepakati Director)

1. **Git tidak boleh kotor oleh artefak Sigma** yang sifatnya kaku (banyak file `.md`/`.json` per proyek).
2. **Konten dipindahkan ke platform lain untuk dibaca manusia** (Notion — platform ini kebetulan, bukan syarat arsitektural; tidak perlu abstraksi multi-platform untuk v2). **Direvisi di §0.1**: yang dipindah bukan artefak AI-readable mentah, tapi hasil `sigma {domain} humanize` — v2 cuma menyiapkan jalur transportnya, isinya menyusul.
3. **Tetap butuh restore penuh saat ganti device** — ini kebutuhan nyata, bukan hipotetis, jadi jalur pull harus benar-benar reliable.

**Dibatalkan secara eksplisit**: ide "Sigma tidak hidup di lokal sama sekali, Notion jadi runtime utama". Notion API bukan datastore transaksional (tidak ada atomic write, tidak ada locking, block API terbatas 100/request, semua operasi butuh network) — mengganti local-first jadi Notion-first akan mengorbankan atomicity dan offline-safety yang jadi alasan Sigma didesain berbasis file sejak awal. **Local tetap satu-satunya source of truth yang hidup**; Notion adalah cermin (push) dan mekanisme restore (pull), bukan pengganti runtime.

**Keputusan turunan**: proses ke Notion **manual/eksplisit** (`sigma notion push` / `sigma notion pull`), bukan otomatis dari dalam `intent ratify`/`plan lock`/dll. Operasi governance inti tidak boleh punya dependency network. AI operator (di bawah CLI Operator Model) bisa diarahkan menjalankan `sigma notion push` sebagai langkah eksplisit setelah event penting — itu keputusan operasional, bukan efek samping tersembunyi dari command lain.

---

## 2. Keputusan Desain

### D-01 — Kredensial dipisah total dari repo project

Token Notion **tidak lagi disimpan di dalam project** (bukan di `.sigma-identity.json`, bukan di `Sigma/project.config.json`). Dipindah ke direktori global per-mesin yang sudah jadi konvensi di codebase ini: `GLOBAL_SIGMA_DIR` (`~/.sigma/`, lihat [`src/config.ts:14`](../src/config.ts#L14)).

- File baru: `~/.sigma/notion.credentials.json`, keyed per `project_id`:
  ```json
  { "<project_id>": { "token": "secret_..." } }
  ```
- `parent_page_id`, `database_id`, `clean_local` — bukan secret, tetap di `Sigma/project.config.json` (sudah otomatis ter-gitignore lewat `Sigma/`).
- Env var override (`NOTION_TOKEN`) tetap didukung dengan prioritas tertinggi, untuk kebutuhan CI/skrip.
- Ini menutup celah kebocoran token secara struktural (token tidak pernah ada di dalam direktori yang bisa ter-`git add`), bukan cuma mengandalkan disiplin `.gitignore`.
- Konsekuensi: setup ulang token wajib per-device (ini benar dan diharapkan — kredensial memang per-mesin, beda dari governance state yang perlu direstore).

### D-02 — `findProjectRoot()` dikembalikan ke perilaku semula; command Notion dapat resolver sendiri

- [`src/utils/fs.ts`](../src/utils/fs.ts) `findProjectRoot()` **kembali hanya** anchor ke `Sigma/activate_status.json`, persis seperti di `main` sebelum branch lama menyentuhnya. 17 command lain (`close`, `config`, `doctor`, `exec`, `git`, `inbox`, `intent`, `memory`, `override`, `plan`, `project`, `reference`, `report`, `roadmap`, `send`, `setup`) tidak boleh punya perubahan perilaku sama sekali dari fitur ini.
- Command yang secara inheren perlu jalan di proyek yang `Sigma/`-nya sudah dipurge (`sigma notion pull-state`, `sigma notion progress`, `sigma notion status` dalam mode remote) pakai resolver terpisah, mis. `findProjectRootForRemote()` di `notionService.ts`, yang boleh anchor ke `.sigma-identity.json` DAN/ATAU marker D-03. Resolver ini **tidak diekspor ke command lain**.
- Efek: fitur Notion terisolasi penuh dari infrastruktur bersama. Regresi seperti temuan #1 di §0 secara struktural tidak mungkin terulang, karena tidak ada lagi titik sentuh di kode bersama.

### D-03 — Marker eksplisit "state dipindahkan ke Notion" + pesan error yang mengarahkan

- File baru di root proyek (sibling `Sigma/`, sama seperti `.sigma-identity.json`): `.sigma-remote-state.json`
  ```json
  {
    "moved_to_notion": true,
    "chain_version": "v1",
    "pushed_at": "2026-08-16T10:00:00.000Z",
    "dashboard_url": "https://notion.so/..."
  }
  ```
- Ditulis oleh `purgeSigmaDir` **hanya setelah** push ke Notion terkonfirmasi sukses (lihat D-04). Dihapus otomatis oleh `sigma notion pull-state` setelah restore sukses (state sudah kembali hidup lokal).
- `findProjectRoot()` (fungsi bersama, tidak berubah perilaku suksesnya per D-02) — hanya pesan error saat gagal resolve yang diperkaya: kalau `Sigma/activate_status.json` tidak ada tapi `.sigma-remote-state.json` ada, pesan errornya jadi eksplisit: *"Sigma state proyek ini dipindahkan ke Notion pada `<pushed_at>` (chain `<chain_version>`). Jalankan `sigma notion pull-state` untuk memulihkan sebelum lanjut."* — bukan lagi generic "Run: sigma project start". Ini satu-satunya perubahan di file bersama, dan sifatnya cuma memperkaya pesan pada jalur gagal, tidak mengubah jalur sukses sama sekali.
- `sigma doctor` dan `sigma project status`, kalau dijalankan lewat resolver bersama dan gagal karena kondisi di atas, otomatis mewarisi pesan yang sama (mereka memanggil `findProjectRoot()` yang sudah diperkaya).

### D-04 — Urutan sync dibalik: tulis dulu, verifikasi, baru hapus lama

`syncArtifactToNotion` (nama baru: `syncArtifactToNotion`, tetap) diubah urutannya:

1. Kalau halaman sudah ada: **append** block baru dulu (bukan hapus dulu). Simpan daftar ID block lama SEBELUM append.
2. Verifikasi response append sukses (HTTP ok, tidak ada exception).
3. **Baru setelah itu** hapus block-block lama yang sudah dicatat di langkah 1.
4. Kalau langkah 2 gagal: proses berhenti, block lama tetap utuh, return error — halaman Notion tidak pernah dalam keadaan kosong/setengah-jadi.
5. `purgeSigmaDir` di sisi caller **hanya dipanggil kalau seluruh rangkaian push (dashboard + artefak + state JSON) sukses** — bukan best-effort per-artefak seperti sekarang.

### D-05 — Pagination penuh, push maupun pull

- Push: kalau blocks > 100, kirim dalam beberapa request `PATCH children` berurutan (chunk 100), bukan `slice(0, 100)`.
- Fetch (`fetchArtifactFromNotion`): loop `GET /blocks/{id}/children` mengikuti `has_more`/`next_cursor` sampai habis, bukan satu request saja.
- Test wajib: dokumen > 100 block harus round-trip utuh (lihat §4).

### D-06 — Resolusi halaman lewat parent page, bukan workspace-wide search

`config.parent_page_id` sudah jadi opsi setup; di v2 ini **diwajibkan** untuk operasi sync. Pencarian halaman existing diganti dari `/v1/search` (scope seluruh workspace, tidak reliable) menjadi `GET /v1/blocks/{parent_page_id}/children` lalu filter child page dengan title cocok. Ini menghilangkan risiko salah-temu/duplikat di workspace besar dan tidak butuh permission "search seluruh workspace" pada integration token — lebih sempit, lebih aman.

### D-07 — Command manual-only, `auto_sync` dihapus

- `NotionConfig` kehilangan field `auto_sync`. Flag `--auto-sync`/`--disable-auto-sync` dihapus dari `sigma notion setup`, bukan disembunyikan.
- Command final:
  | Command | Fungsi |
  | :--- | :--- |
  | `sigma notion setup --token <t> --parent-id <id> [--db-id <id>] [--clean-local] [--gitignore-sigma]` | Konfigurasi; token ditulis ke `~/.sigma/notion.credentials.json`, sisanya ke `Sigma/project.config.json` |
  | `sigma notion status` | Cek koneksi + config aktif |
  | `sigma notion push` | **Default: push dashboard + state JSON saja** (lihat §0.1 — artefak mentah tidak lagi ikut secara default). Purge lokal cuma jalan kalau `--clean-local`/config aktif DAN seluruh push sukses (D-04 poin 5) |
  | `sigma notion pull-state [chain]` | Restore state JSON dari Notion; hapus `.sigma-remote-state.json` setelah sukses |
  | `sigma notion pull <type> <version>` | Command generik, tarik satu halaman by type+version (preview, read-only). Sampai Humanize rilis, tidak ada konten artefak yang benar-benar terkirim untuk ditarik — command tetap dibangun karena primitifnya (`fetchArtifactFromNotion`) dipakai bersama |
  | `sigma notion progress [chain]` | Baca progress dari Notion tanpa `Sigma/` lokal (pakai resolver D-02) |

  Catatan: `sigma notion sync` (nama lama) di-rename jadi `sigma notion push` supaya simetris dengan `pull`/`pull-state` dan tidak menyiratkan "sinkron dua arah otomatis".

  **Primitif engine** (`syncArtifactToNotion`, `fetchArtifactFromNotion` dengan perbaikan D-04/D-05/D-06) tetap diekspor dari `notionService.ts` sebagai fungsi generik menerima `(projectRoot, artifactType, version, contentMarkdown)` — tidak spesifik ke tipe artefak apa pun. Ini yang nanti dipanggil langsung oleh command Humanize (`sigma intent/plan/exec humanize`) untuk push dokumen human, tanpa perlu mengubah mesin sync sama sekali.

### D-08 — Bahasa konsisten

Semua string CLI-facing (pesan error, dashboard template) di `notionService.ts`/`notion.ts` ditulis Bahasa Inggris, konsisten dengan command lain di codebase ini (v1 kemarin campur Indonesia-Inggris).

---

## 3. Fase Implementasi

| Fase | Isi |
| :--- | :--- |
| **1 — Kredensial & config** | `~/.sigma/notion.credentials.json` (D-01), `NotionConfig` tanpa `auto_sync`, resolusi token global-first |
| **2 — Engine sync** | Urutan append-then-delete (D-04), pagination push/fetch (D-05), resolusi via parent page (D-06) |
| **3 — Purge & marker** | `.sigma-remote-state.json` (D-03), `purgeSigmaDir` syarat all-push-success, pesan error `findProjectRoot` diperkaya, resolver terpisah untuk command remote (D-02) |
| **4 — CLI commands** | `setup`/`status`/`push`/`pull`/`pull-state`/`progress`, tanpa flag auto-sync (D-07), string Inggris (D-08) |
| **5 — Test & dokumentasi** | Lihat §4. Update README/CLI summary bila ada |

Urutan ini sengaja: Fase 3 (purge/marker) butuh Fase 2 (push yang reliable) sudah selesai duluan, supaya syarat "purge cuma setelah push sukses" punya push yang memang bisa dipercaya suksesnya.

---

## 4. Test yang wajib ada (celah v1 yang harus ditutup)

v1 kemarin: 322 test lolos tapi nol yang menyentuh jalur berisiko. Wajib ditambahkan di v2:

1. **Delete-order test**: mock Notion API supaya append gagal di tengah — pastikan block lama TIDAK terhapus.
2. **Pagination test**: dokumen > 100 block (push) dan halaman dengan `has_more: true` (fetch) — pastikan round-trip utuh, bukan terpotong.
3. **Purge-gate test**: purge tidak boleh terjadi kalau salah satu dari push dashboard/artefak/state gagal.
4. **Marker + error message test**: setelah purge, `findProjectRoot()` di direktori itu harus melempar pesan yang menyebut `sigma notion pull-state`, bukan pesan generic.
5. **Regresi non-Notion**: test eksplisit bahwa `findProjectRoot()` **mengabaikan** `.sigma-identity.json` sendirian (tanpa `Sigma/activate_status.json`) — guard supaya bug v1 tidak masuk lagi tanpa sengaja di masa depan.
6. **Credential isolation test**: token yang ditulis lewat `sigma notion setup` tidak pernah muncul di file mana pun di bawah root proyek (scan seluruh `Sigma/` + root project files).

---

## 5. Yang eksplisit di luar cakupan v2

- Live/bi-directional sync otomatis.
- Notion sebagai runtime/state utama (dibatalkan, lihat §1).
- Dukungan multi-platform selain Notion.
- Purge/gitignore untuk repo `sigma-ecosystem` ini sendiri (target fitur adalah proyek konsumen, lihat catatan header).
- Conflict resolution otomatis kalau ada dua device yang sama-sama masih punya `Sigma/` lokal aktif dan keduanya push — v2 cuma menjamin satu arah restore yang aman (device baru narik dari Notion), bukan merge dua state yang sama-sama hidup.
- **Push artefak AI-readable mentah (`DIR-INTENT`/`FMN-PLAN`/`DEV-EXEC`) sebagai perilaku default** — ditunda, jadi tanggung jawab `sigma {domain} humanize` (lihat §0.1). Primitif engine-nya sudah siap dipakai begitu Humanize rilis.
- Field config gate wajib Humanize (`notion_humanize_gate.enabled` atau nama serupa) — didefinisikan di plan Humanize, bukan di sini.

---

## 6. Status & hubungan dengan Sigma Humanize Operation

Seluruh keputusan desain (D-01 s/d D-08, plus revisi §0.1) sudah dibahas dan disepakati Director. **Plan ini dikerjakan lebih dulu**, tidak menunggu template/gate Humanize selesai — begitu Fase 1–5 (§3) selesai, `sigma notion push`/`pull-state`/`progress` sudah berfungsi penuh untuk dashboard dan device-restore, dan primitif sync-nya siap dipakai `PLAN-IMPL-SIGMA-HUMANIZE-OPERATION-20260816` begitu template & gate-nya diputuskan. Tidak ada dependensi terbalik — Humanize yang bergantung ke sini, bukan sebaliknya.

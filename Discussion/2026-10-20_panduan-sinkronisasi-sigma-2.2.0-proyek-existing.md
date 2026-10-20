# Panduan Sinkronisasi Sigma 2.2.0 ke Proyek yang Sudah Ada

**Tanggal:** 2026-10-20
**Berlaku untuk:** Sigma 2.2.0 (fitur gitignore default, guardrail identity, mode snapshot INTENT, portabilitas)
**Pembaca:** Director (pelaksana), dan AI yang membantu di dalam proyek atas perintah Director
**Status fakta:** semua keadaan proyek di §1 dibaca langsung dari mesin ini pada 2026-10-20 (read-only). Langkah di §3–§5 dilatih pada **salinan** KLHK di folder scratch dengan HOME sementara; proyek asli tidak disentuh. Hal yang tidak dilatih ditandai **[belum dilatih]**.

---

## 0. Prasyarat yang sudah terpenuhi

- `sigma --version` = `2.2.0` (biner global adalah symlink ke repo master).
- Aset host `~/.sigma` sudah diperbarui (`sigma setup update`): `sigma doctor --check-assets` menunjukkan 0 selisih master↔host.
- Ketiga proyek masih berstempel **2.1.0** (`status: project_outdated`). Selama belum disinkronkan, setiap perintah Sigma di proyek itu mencetak satu baris peringatan di stderr. Itu normal, bukan error.

Yang **belum** terjadi dan menjadi isi panduan ini: sinkronisasi aset proyek (rules, protocol, registry, template, bridge) dan keputusan gitignore per proyek.

---

## 1. Keadaan tiga proyek (fakta, 2026-10-20)

|                                 | swm_standalone_v2                                 | KLHK_JasaLingkunganHidup                                                                  | CanopySense                                                                                                               |
|:------------------------------- |:------------------------------------------------- |:----------------------------------------------------------------------------------------- |:------------------------------------------------------------------------------------------------------------------------- |
| Remote Git                      | **tidak ada**                                     | GitHub (`origin/main`)                                                                    | GitHub (`origin/main`, `origin/feat/sembawa-stl-gcc-pilot`)                                                               |
| Branch aktif                    | `main`                                            | `main`                                                                                    | `feat/sembawa-stl-gcc-pilot`                                                                                              |
| Working tree                    | 2 untracked (`CHANGE-RECORD.md`, `opencode.json`) | bersih                                                                                    | **`M .sigma-identity.json`** + 3 untracked (`CHANGE-RECORD.md`, `notes/demo-server-power-management.md`, `opencode.json`) |
| File `Sigma/` terlacak Git      | 0 (`Sigma/` sudah di-ignore manual)               | **327**                                                                                   | 0 (`Sigma/` sudah di-ignore manual)                                                                                       |
| File Sigma lain terlacak        | tidak ada                                         | `.sigma-identity.json`, `CHANGE-RECORD.md`, `DEEPSEEK.md`, `REASONIX.md`, `opencode.json` | `.sigma-identity.json`                                                                                                    |
| `.sigma-identity.json`          | **di-ignore manual** (baris 4 `.gitignore`)       | terlacak                                                                                  | terlacak                                                                                                                  |
| Chain aktif                     | `v1`                                              | `v7` (7 chain, semua RATIFIED; tanpa `git_baseline`; v4 dan v5 punya 2 amandemen pra-F05) | `v5` (5 chain)                                                                                                            |
| Selisih aset (`--check-assets`) | 33                                                | 12                                                                                        | 33                                                                                                                        |
| Stempel terakhir                | 2.1.0 (2026-10-14)                                | 2.1.0 (2026-10-15)                                                                        | 2.1.0 (2026-10-14)                                                                                                        |

Dua pengamatan yang menentukan keputusan:

1. **KLHK adalah satu-satunya kasus berisiko tinggi untuk gitignore.** 327 file Sigma terlacak dan ada remote GitHub. Menyalakan gitignore di sana berarti satu commit yang menghapus ±334 file dari pelacakan. Lihat §4.
2. **swm dan CanopySense sudah mengabaikan `Sigma/` secara manual.** Bagi mereka gitignore resmi hanya merapikan; risiko cabang pull tidak ada (tidak ada file Sigma di Git). Namun blok baru **menambahkan aturan `!/.sigma-identity.json`**: di swm, yang selama ini mengabaikan identity, file itu akan muncul sebagai untracked dan perlu keputusan (§3 langkah 9).

Selisih di swm dan CanopySense (33) lebih banyak daripada KLHK (12). **Penyebabnya dan daftar butirnya belum saya periksa** (kedua proyek itu lebih tua dan sama-sama berstempel 2.1.0 dengan hash aset yang sama); baca dry run di §3 langkah 4 sebelum menyetujui token apa pun.

---

## 2. Urutan yang direkomendasikan

| Urutan | Proyek                | Alasan                                                                                                                         |
|:------ |:--------------------- |:------------------------------------------------------------------------------------------------------------------------------ |
| 1      | **swm_standalone_v2** | Lokal tanpa remote, tidak ada file Sigma di Git: risiko terendah, jadi bagus untuk membiasakan alur.                           |
| 2      | **CanopySense**       | Branch fitur dengan remote; perubahan identity yang belum di-commit akan hilang sendiri oleh sync (§3 langkah 2).              |
| 3      | **KLHK**              | Terakhir dan hanya setelah memutuskan keputusan gitignore-nya (§4). Sinkronisasi aset boleh dilakukan; gitignore bisa ditunda. |

**Efek samping global yang harus diketahui sebelum mulai:** `sigma project sync --confirm` menulis ulang entri `sigma` di `~/.codex/config.toml` dan `~/.gemini/config/mcp_config.json` agar menunjuk **proyek yang baru disinkronkan** (Codex dan Antigravity terdeteksi di mesin ini). Proyek yang disinkronkan **terakhir** menang. Jadi sinkronkan terakhir proyek yang paling aktif Anda kerjakan lewat Codex/Antigravity, atau jalankan `sigma setup update` sesudahnya untuk mengembalikan ke mode discovery. (Dalam latihan, bagian ini dilewati karena HOME sementara tidak memiliki Codex: **[belum dilatih]**.)

---

## 3. Prosedur per proyek (sinkronisasi aset)

Jalankan di dalam folder proyek. Semua langkah bertanda "read-only" aman diulang.

**1. Orientasi (read-only).**

```bash
cd <proyek>
sigma project status
sigma intent list
sigma doctor --check-assets        # JANGAN jalankan `sigma doctor` polos: itu dapat menulis
git status --short
git branch --show-current
```

Catat: chain aktif, jumlah selisih, `Version: ... status: project_outdated`.

**2. Bersihkan pekerjaan lain dari working tree.** Sinkronisasi mengubah beberapa file yang terlacak (§3 langkah 5). Agar hasilnya bisa di-review dan di-revert sendiri, commit atau simpan dulu perubahan yang bukan bagian sinkronisasi.

- CanopySense: `M .sigma-identity.json` sudah saya periksa: isinya **hanya blok `sigma_applied` 2.1.0** (stempel sinkronisasi F09 yang belum di-commit). Tidak perlu di-commit: sinkronisasi 2.2.0 memindahkan stempel ke `Sigma/activate_status.json` dan menghapus blok itu dari identity, sehingga `.sigma-identity.json` kembali identik dengan versi ter-commit (perkiraan dari latihan KLHK; **[belum dilatih di proyek aslinya]**). Biarkan saja; cek `git status` setelah sync. Tiga file untracked lain (`CHANGE-RECORD.md`, `notes/...`, `opencode.json`) tidak terpengaruh.
- swm dan KLHK: tidak ada yang perlu dibersihkan (untracked boleh dibiarkan).

**3. Tutup sesi AI yang aktif di proyek itu.** Aturan role dan skill akan diganti; sesi lama akan memakai teks lama (§6).

**4. Dry run (tidak mengubah aset, tetapi *menulis satu baris ke `Sigma/logs/operations.jsonl`*).**

```bash
sigma project sync
```

Keluaran: satu baris per selisih, dengan status `DIFF` (ada token `accept=...`) atau `MISSING`. Yang **harus Anda periksa**:

- Setiap `DIFF` pada berkas yang mungkin pernah Anda edit sendiri (rules, template). Bila Anda ingin mempertahankan edit lokal, **jangan** terima tokennya.
- Dari pengamatan KLHK, sync akan memperbarui: `SIGMA_PROTOCOL.md`, `rules/ARC-RULE.md`, `SIGMA-OPERATION-REGISTRY.json`, `role-memory/arc-memory.json`, dan berkas bridge. Di swm/CanopySense akan ada lebih banyak (template, rules lain).
- Bridge (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `DEEPSEEK.md`, `REASONIX.md`) masing-masing punya token sendiri. Template bridge terbaru memuat baris "Default implementation workflow: Plan → Build" yang Anda tambahkan; menerima token berarti baris itu masuk ke bridge proyek.

**5. Terapkan.** Tanpa `--accept`, hanya berkas yang tidak berbenturan yang diterapkan. Untuk menerima semua `DIFF` yang sudah Anda tinjau, satu `--accept` per token.

```bash
# Cara cepat bila SEMUA DIFF sudah Anda setujui (gunakan bash, bukan zsh — lihat catatan di §6):
bash -c 'args=(); for t in $(sigma project sync 2>&1 | grep -o "accept=[0-9a-f]*" | sed "s/accept=//"); do args+=(--accept "$t"); done; sigma project sync --confirm "${args[@]}"'
```

Atau satu per satu: `sigma project sync --confirm --accept <token1> --accept <token2> ...`.

Yang berubah di disk (diamati pada latihan KLHK):

- berkas aset yang disetujui diganti; versi lama dicadangkan di `~/.local/share/sigma/sync-backups/<cap-waktu>/`;
- `.mcp.json` dan `opencode.json(c)` di-upsert (entri `sigma`);
- **stempel versi pindah**: `Sigma/activate_status.json` kini memuat `sigma_applied` (2.2.0), dan `.sigma-identity.json` **kehilangan** blok `sigma_applied` lama (satu-satunya perubahan identity; `logs_created_at` lama tetap ada sampai `register`/`start`);
- `Sigma/logs/operations.jsonl` bertambah;
- config global Codex/Antigravity (§2).

**6. Verifikasi (read-only).**

```bash
sigma doctor --check-assets
```

Harapan: `differences: 0` dan `Version: ... project 2.2.0 ...; status: current`, kecuali berkas yang sengaja Anda pertahankan.

**7. Periksa Git.** `git status --short`, lalu `git diff --stat`. File yang berubah di KLHK pada latihan: `.sigma-identity.json`, `DEEPSEEK.md`, `opencode.json`, `Sigma/SIGMA-OPERATION-REGISTRY.json`, `Sigma/SIGMA_PROTOCOL.md`, `Sigma/activate_status.json`, `Sigma/logs/operations.jsonl`, `Sigma/role-memory/arc-memory.json`, `Sigma/rules/ARC-RULE.md`.

**8. Commit sinkronisasi sebagai commit tersendiri** (Sigma tidak pernah commit). Contoh pesan: `chore(sigma): sync project assets to Sigma 2.2.0`. Di swm/CanopySense yang `Sigma/`-nya sudah di-ignore, hanya file di luar `Sigma/` yang terlihat di Git.

**9. Keputusan gitignore** → §4. Untuk swm dan CanopySense, dua hal khusus:

- Perintah `sigma config set gitignore on` menulis blok resmi ke `.gitignore` dan, karena blok memuat `!/.sigma-identity.json`, **identity berhenti di-ignore**. Di swm file itu akan muncul sebagai `??`. Keputusan Anda: ikut di-commit (memberi guardrail lintas-mesin bila suatu hari ada remote), atau dibiarkan.
- Aturan lama di `.gitignore` (mis. `.sigma-identity.json` di baris 4 swm) berada **sebelum** blok. Git memakai aturan terakhir yang cocok, jadi negasi di blok menang. Aturan yang Anda tambah **setelah** blok akan mengalahkan blok; jangan menyisipkan aturan di bawahnya.

**10. Mulai ulang sesi AI**, lalu muat ulang rules dan memory role (§6).

---

## 4. Keputusan gitignore per proyek

`sigma config set gitignore on|off` mengatur apakah semua jejak Sigma (kecuali `.sigma-identity.json`) di-ignore. Nilai bawaan tampil sebagai `ON ... [default]`, tetapi **tidak diterapkan** pada proyek lama sampai Anda menjalankan `on` sendiri (`sigma config show` menandainya "block not yet in .gitignore").

### 4.1 Apa yang terjadi saat `on` (dilatih pada salinan KLHK)

- Blok `# >>> sigma-managed >>>` ditulis/diperbarui di `.gitignore`.
- 334 file dilepas dari index (`git rm --cached`), **file di disk tidak berubah** (dibuktikan: isi `Sigma/` utuh). Perubahan ini baru *staged*; Anda yang commit.
- Pemberitahuan yang muncul: peringatan "Other machines" (di bawah) dan, bila ada chain RATIFIED yang masih punya `git_baseline` sementara INTENT-nya tidak lagi dilacak, daftar chain itu. KLHK tidak punya chain seperti itu.
- Output menampilkan `Sigma Gitignore Mode: ON -> ON` pada proyek yang belum pernah memilih; itu hanya karena nilai bawaan sudah ON.

### 4.2 Bahaya yang harus Anda timbang: klon lain

Setelah commit pembersihan di-push, **`git pull` di klon mana pun menghapus file Sigma terlacak dari disk klon itu** (Git menghapus file yang dihapus oleh commit). Klon tersebut lalu terblokir (`[SIGMA BLOCKED — MISSING LOCAL SIGMA FILES]`). Ini sudah dibuktikan dengan Git sungguhan, dan Sigma tidak bisa tahu apakah klon lain ada.

Sebelum `on` pada proyek yang punya remote:

1. Pastikan apakah repo ini dikloning di mesin/folder lain (laptop lain, server, folder kerja kedua).
2. Di setiap klon itu, **salin dulu** `Sigma/` dan file Sigma lain ke tempat aman sebelum `git pull` berikutnya.
3. Bila proyek memang dikerjakan dari beberapa mesin dan Sigma harus ikut berpindah, pilih `off`, bukan `on` (§4.4).

### 4.3 Rekomendasi per proyek (rekomendasi saya, keputusan di tangan Director)

| Proyek      | Rekomendasi                                                                     | Alasan                                                                                                                                       |
|:----------- |:------------------------------------------------------------------------------- |:-------------------------------------------------------------------------------------------------------------------------------------------- |
| swm         | `on` setelah sinkronisasi                                                       | Tanpa remote dan tanpa file Sigma terlacak: tidak ada efek ke Git selain `.gitignore` dan identity yang terlihat.                            |
| CanopySense | `on` setelah sinkronisasi                                                       | `Sigma/` sudah di-ignore; yang berubah hanya rapi-rapi dan identity. Pastikan tidak ada klon lain yang mengandalkan identity yang di-ignore. |
| KLHK        | **Sinkronkan aset dulu; tunda `on` sampai Anda memastikan tidak ada klon lain** | 327 file terlacak dan remote GitHub: di sinilah bahaya §4.2 nyata. Bila KLHK hanya ada di satu mesin, `on` aman dan prosedurnya §4.5.        |

Satu pertimbangan lain, dari diskusi lama (`Discussion/2026-08-12_1658_Sigma-gitignore-defaults.md`): `progress-v<N>.json` **tidak dapat direkonstruksi tanpa kehilangan** (skor ARC lama, cap waktu asli, pasangan multi-draft). Selama `Sigma/` terlacak, Git adalah jaring pengaman satu-satunya untuk file itu. Setelah `on`, riwayat Git *sampai saat itu* tetap ada, tetapi perubahan berikutnya tidak lagi terekam. Anda yang memutuskan apakah itu bisa diterima untuk proyek bernilai tinggi seperti KLHK (7 chain), dan dengan cara apa mencadangkan `Sigma/`. Panduan ini tidak menambah mekanisme cadangan.

### 4.4 `off`

`sigma config set gitignore off` menghapus blok dari `.gitignore` dan tidak menyentuh file apa pun. Dipakai bila Sigma harus berpindah antar-mesin lewat Git: commit dan push semua file Sigma di mesin asal, lalu `git pull` di mesin lain. Catatan: setelah `off`, file yang sebelumnya dilepas dari index tidak otomatis kembali; jalankan `git add -A` untuk melacaknya lagi.

### 4.5 Prosedur `on` (setelah sinkronisasi di-commit)

```bash
sigma config set gitignore on        # baca seluruh keluaran, termasuk peringatan
git status --short                   # harapkan banyak "D " (staged) dan ".gitignore" berubah
git diff --cached --stat | tail -3
git add .gitignore .sigma-identity.json
git commit -m "chore(sigma): stop tracking Sigma files (gitignore on)"
```

Jangan push sebelum §4.2 selesai. Setelah `on`:

- `sigma project status` dan `sigma config show` harus tetap bekerja di mesin ini;
- bila ada chain yang tercantum di pemberitahuan: `sigma intent baseline adopt --v <chain> --director-confirm` (tanpa `--commit`) memindahkannya ke mode snapshot (**[dilatih]** pada KLHK v7: baseline `Sigma/revisions/INTENT-v7/base.md` tercatat dan `baseline check` lulus);
- proyek tanpa baseline (seperti KLHK) memerlukan `baseline adopt` yang sama sebelum amandemen berikutnya; amandemen pra-F05 tidak berubah.

---

## 5. Mesin atau klon kedua

**Tetapkan mesin asal lebih dulu (disarankan sebelum `on`).** Di mesin yang menjadi sumber kebenaran Sigma proyek itu, jalankan satu kali:

```bash
sigma config set origin-machine office-laptop    # label bebas; tanpa argumen = hostname mesin ini
```

Nama tersimpan di `.sigma-identity.json` (terlacak Git, ikut ter-push; repo KLHK dan CanopySense berstatus privat per 2026-10-20). Setelah itu pesan blokir di klon mana pun menyebut mesin asal dan nama mesin yang sedang dipakai. Sifatnya informasi: keputusan blokir tetap hanya ditentukan oleh ada-tidaknya `Sigma/`. Hostname di mesin ini saat ini `fedora` (tanpa static hostname), jadi label buatan sendiri lebih membedakan. `project start` untuk proyek baru mencatatnya otomatis; proyek lama belum punya catatan sampai perintah ini dijalankan (`sigma config show` menampilkan `Origin Machine`). Menjalankannya lagi dengan nama lain memindahkan asal.

Jika klon berada di mesin yang sama dengan asal (folder kedua di PC yang sama), pesan memakai varian "mesin ini adalah mesin asal, tetapi file Sigma tidak ada di folder ini" dan menunjukkan dua jalan: pulihkan dari cadangan/riwayat Git, atau pindahkan dari folder aslinya (`gitignore off`, commit, push, `git pull`).

- **Klon baru setelah `on`** hanya berisi `.sigma-identity.json`. Semua perintah Sigma (kecuali `sigma setup`) dan server MCP menolak jalan dengan `[SIGMA BLOCKED — MISSING LOCAL SIGMA FILES]` (dibuktikan pada klon KLHK). Itu disengaja agar tidak terbentuk state Sigma kedua yang menyimpang.
- **Untuk bekerja di mesin itu:** di mesin asal `sigma config set gitignore off`, commit semua file Sigma, push; di mesin kedua `git pull`. Setelah pull, `.mcp.json` yang menunjuk path mesin asal diperbaiki otomatis oleh perintah Sigma pertama yang mengubah state (perintah read-only tidak menulis).
- Mesin kedua perlu `sigma setup install` (atau `update`) sendiri; aset host tidak ikut Git.

---

## 6. Setelah sinkronisasi: muat ulang yang dipakai AI

1. Mulai ulang sesi AI di proyek itu. Skill hasil `sigma setup update` hanya termuat saat sesi baru.
2. Baca ulang aturan role: `Sigma/rules/<ROLE>-RULE.md`. Pada 2.2.0 `ARC-RULE.md` dan `SIGMA_PROTOCOL.md` §7.4 menjelaskan mode Git dan mode snapshot untuk amandemen INTENT.
3. Muat memory role: `sigma memory --<role>` (read-only).
4. Jangan percaya pernyataan protokol dari sebelum sinkronisasi.

---

## 7. Mengembalikan keadaan (rollback)

| Tahap                                     | Cara                                                                                                                                                                                                                                                        |
|:----------------------------------------- |:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setelah `sync --confirm`, belum di-commit | `git restore` untuk file terlacak yang berubah. Untuk berkas aset: salinan lama ada di `~/.local/share/sigma/sync-backups/<cap-waktu>/`.                                                                                                                    |
| Setelah commit sinkronisasi               | `git revert <commit>`.                                                                                                                                                                                                                                      |
| Setelah `on`, belum di-commit             | `git restore --staged .` mengembalikan index; lalu `sigma config set gitignore off` menghapus blok. Disk tidak pernah berubah.                                                                                                                              |
| Setelah commit `on`                       | `sigma config set gitignore off`, `git add -A`, commit. File di disk utuh sehingga pelacakan kembali sepenuhnya. Bila klon lain sempat pull, file mereka sudah terhapus dari disk: pulihkan dari riwayat Git (`git checkout <commit-sebelum-on> -- Sigma`). |
| Host (`~/.sigma`)                         | Cadangan sebelum `setup update` hari ini: `~/.sigma/backups/2026-10-20T14-48-28-928Z`.                                                                                                                                                                      |

---

## 8. Catatan dan keganjilan (supaya tidak mengejutkan)

- **zsh dan `--accept`:** merangkai token dalam satu variabel string di zsh menghasilkan `error: unknown option '--accept <token> ...'` karena tidak ada pemisahan kata. Pakai array (contoh `bash -c` di §3 langkah 5) atau tulis token satu per satu.
- Dry run `sigma project sync` pun menambah baris ke `Sigma/logs/operations.jsonl`. Pada proyek yang melacak file itu (KLHK), `git status` langsung tidak bersih.
- Klon dengan sparse checkout (seperti latihan saya) menampilkan `MISSING bridge/CLAUDE.md` dan kawan-kawannya karena file di-ignore dan tidak ikut klon; pada proyek asli file itu ada.
- Baris detail pada `intent baseline check` mencetak deskripsi syarat apa adanya, jadi `[OK]` bisa diikuti kalimat bernada gagal (`[OK  ] file_matches_baseline: The INTENT file does not match ...`). Itu gaya lama, bukan kegagalan; yang menentukan adalah `[OK]`/`[FAIL]` dan kode keluar.
- `sigma-control` tidak ada di PATH. Server kontrol memang tidak didaftarkan otomatis; jangan disamakan dengan masalah sinkronisasi (lihat rekomendasi terpisah).

---

## 9. Lembar centang ringkas (per proyek)

- [ ] Sesi AI proyek ditutup; pekerjaan lain di-commit/stash (§3.2–3.3)
- [ ] `sigma doctor --check-assets`: catat selisih; dry run dibaca butir demi butir (§3.4)
- [ ] `sync --confirm` dengan token yang disetujui (§3.5)
- [ ] `--check-assets`: `status: current` (§3.6)
- [ ] Commit sinkronisasi terpisah (§3.8)
- [ ] Keputusan gitignore tercatat per proyek; untuk KLHK, klon lain dipastikan (§4)
- [ ] Mesin asal ditetapkan per proyek: `sigma config set origin-machine <label>` (§5)
- [ ] Bila `on`: baca peringatan; commit pembersihan; tangani chain yang tercantum; jangan push sebelum klon lain aman
- [ ] Sesi AI dimulai ulang; rules dan memory dimuat ulang (§6)
- [ ] Urutan terakhir menyentuh config global Codex/Antigravity sesuai yang Anda inginkan (§2)

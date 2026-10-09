# F06 - sigma notes: katalog catatan bebas Markdown

Tanggal: 9 Oktober 2026
Status: RENCANA dan EKSEKUSI. Per 9 Oktober 2026 seluruh keputusan terbuka (O-1 sampai O-18) tertutup: rekomendasi disetujui Director, kecuali satu penyimpangan yang ditetapkan Director sendiri (notes tidak merujuk artefak, K-10). Tujuan notes ditetapkan Director (bagian 1.1, K-9). DIEKSEKUSI 9 Oktober 2026 (W0-W5, bagian 11): 76 berkas / 1.178 tes lulus; kode, tes, dan dokumen di-commit Director dalam 6b493ee dan di-push; `dist/` dibangun sesudahnya (11.5), menunggu commit. Pada tahap ini tidak ada kode, rules, template, registry, build, atau Git yang diubah; hanya berkas ini dan baris F06 di F00.
Sifat dokumen: catatan kerja rencana implementasi. Bukan artefak governance Sigma dan bukan otorisasi mengubah kode atau state.
Basis kode: branch `main`, HEAD `d996c5d`, worktree bersih saat dokumen ini dibuat. Seluruh rujukan kode di bagian 3 diperiksa read-only pada HEAD tersebut.

Label isi: **TERKUNCI** (keputusan Director), **TERVERIFIKASI** (diperiksa pada kode atau dokumen), **REKOMENDASI** (asisten, belum keputusan), **TERBUKA** (menunggu keputusan).

## 1. Tujuan dan batas

Tujuan: Director dan AI dapat memilih dan melacak catatan bebas di `Sigma/notes/` lewat satu katalog, ketika jumlah file berkembang. Acuan pengalaman: `Sigma/notes/` pada proyek KLHK (85 file langsung, 73 `.md` dan 12 non-`.md`, dua subfolder).

Termasuk: perintah `sigma notes new`, `list`, `update` (termasuk `--rebuild-registry`, K-7); registry catatan terdaftar; katalog `note-list.md`; perilaku auto rejection dan auto move; penyesuaian skill write-memo/read-memo dan dokumentasi.

Tidak termasuk: pencarian isi catatan (full-text), tag, tautan dari note ke artefak (tidak dilakukan secara desain, K-10); migrasi atau pembersihan `Sigma/notes/` pada proyek nyata (KLHK tidak disentuh); perubahan Constitution, Protocol, `SCHEMA_VERSION`, versi paket; sinkronisasi ke `~/.sigma` atau proyek (F09). Perubahan Protocol dicatat sebagai butir (bagian 8), tidak dikerjakan.

### 1.1 Tujuan notes (ditetapkan Director, 9 Oktober 2026; K-9)

Notes adalah dokumen Markdown berformat bebas yang dibuat melalui `sigma notes new` agar terdaftar rapi dan dapat ditelusuri di `note-list.md`.

Sumber notes:

1. Otoritas eksplisit Director.
2. Inisiatif AI untuk kebutuhan membuat catatan penting.
3. Keluaran berformat Markdown dari pekerjaan EXEC atau PLAN, berupa laporan atau hasil analisis.
4. Catatan diskusi non-formal berformat Markdown, dipakai sebagai bahan menyusun konsep, umumnya rujukan untuk menyusun PLAN baru, INTENT baru, atau EXEC.

Sifat yang diharapkan: bukan jenis dokumen yang mudah usang (kriteria isi: analisis dan alasan, bukan status saat ini); bukan pengingat (itu memo); bukan pesan yang mudah usang (itu pesan); bukan pengganti EXEC melainkan pelengkap EXEC. Kesimpulan dan klaim penting tetap harus tertulis di artefak governance sendiri.

Prinsip independensi (K-10): notes adalah dokumen independen, bebas terminologi Sigma, dan tidak merujuk atau terikat pada artefak mana pun. Artefak Sigma boleh merujuk notes, tidak sebaliknya. Operasi Sigma hanya dipakai untuk menjalankan pencatatan, seperti pada `reference-list.md`. Isi notes boleh berubah setelah dikutip artefak; EXEC lama yang mengutip isi yang kemudian berubah bukan masalah (risiko ini sudah diketahui dan diterima Director).

Batas kepemilikan: non-Markdown bukan tujuan notes (T-17). Sumber riset tetap lewat `reference-list.md` dan `reference/data/`.

## 2. Keputusan Director yang sudah terkunci

| Sumber | Keputusan | Label |
|---|---|---|
| D-22 dan §12 dokumen 28 September | Catatan bebas tanpa chain, tanpa template wajib. Nama file `NOTE-<YYMMDDHHMM>-<slug>.md` (jam lokal, tanpa prefix role). Slug: huruf kecil, selain huruf/angka menjadi `-`, tanda hubung ganda dirapatkan, maksimal sekitar 60 karakter. Isi awal berisi judul asli dan tanggal dibuat. Judul yang menghasilkan slug kosong ditolak. Tabrakan nama diberi akhiran `-2`, `-3`. Kelas perintah operasional: tanpa persetujuan Director, tidak masuk chain atau `progress-v<N>.json`, tidak terpengaruh lock | TERKUNCI |
| Klarifikasi Sigma notes (diskusi, Oktober) | Hanya catatan yang dibuat lewat `sigma notes new` yang terdaftar. Markdown lain, apa pun tanggal, nama, atau heading-nya, adalah tidak terdaftar. Posisi di `note-list/` bukan bukti registrasi. Mengedit isi catatan terdaftar tidak mengubah asal registrasinya | TERKUNCI |
| T-17 (6 Oktober) | Struktur: `Sigma/notes/unregistered-notes/`, `Sigma/notes/note-list/`, `Sigma/notes/note-list.md`. `LEGACY` hanya untuk mailbox. Auto rejection: setiap file non-Markdown di folder notes ditolak pada setiap `update`. Auto move: setiap Markdown yang tidak dibuat lewat `new` dipindahkan ke `unregistered-notes/` pada setiap `update`. Keduanya perilaku `update`, bukan sistem terpisah | TERKUNCI |
| Klarifikasi | `note-list.md` adalah katalog sistem, dikecualikan dari klasifikasi catatan. `unregistered-notes/` dikecualikan dari katalog aktif dan tidak dipindahkan ulang secara bertingkat. `update` tidak mengimpor atau mendaftarkan file manual. Pembatasan Markdown tidak menghapus, memindahkan, atau mengonversi file non-Markdown | TERKUNCI |
| Klarifikasi | Identitas dilacak terpisah dari hash isi. Lokasi katalog `Sigma/notes/note-list.md`; registry bila JSON disimpan di luar `Sigma/notes/` agar tidak melanggar pembatasan Markdown | TERKUNCI |

**Keputusan Director 9 Oktober 2026 (menggantikan rancangan katalog sebelumnya: kolom Keterangan, `--summary`, pembacaan balik tabel):**

| ID | Keputusan | Label |
|---|---|---|
| K-1 | `note-list.md` berisi tiga kolom saja: ID, Nama file, Title. Diisi seluruhnya otomatis; tidak ada pengisian manual. Prinsip kerja seperti `reference-list.md`, bedanya tidak ada kolom manual | TERKUNCI |
| K-2 | `sigma notes new --title "<judul>"`, `--title` wajib. Setiap `new` memperbarui `note-list.md` secara otomatis. (Mengubah O-5 sebelumnya "hanya `update`".) | TERKUNCI |
| K-3 | Nama perintah `sigma notes` (bukan `note`); perintah `note` tidak pernah dirilis sehingga tidak ada alias | TERKUNCI (rekomendasi disetujui) |
| K-4 | ID berurut pendek `N01`, `N02`, ... (mengikuti pola `LA01` di reference-list); nomor tidak dipakai ulang walau berkas hilang | TERKUNCI (rekomendasi disetujui) |
| K-5 | Sumber kebenaran adalah registry JSON; `note-list.md` hanya hasil render dan ditimpa penuh pada setiap penulisan. Suntingan manual pada `note-list.md` tidak mendaftarkan atau menghapus catatan | TERKUNCI (rekomendasi disetujui) |
| K-6 | Baris registry yang berkasnya hilang tetap di registry, tidak tampil di `note-list.md`, dilaporkan sebagai peringatan oleh `update` dan `list`; tampil kembali bila berkas muncul lagi di path yang sama. Judul dengan baris baru ditolak saat `new`; karakter `\|` di-escape di katalog, registry menyimpan judul asli | TERKUNCI (rekomendasi disetujui) |
| K-7 | `sigma notes update --rebuild-registry` dibuat sekarang (versi sempit, 4.7), bukan ditunda: Director menilai ditunda berarti terlupakan | TERKUNCI (pilihan Director); rincian 4.7 = O-15 |
| K-8 | Catatan yang menjadi rujukan sebuah memo wajib dibuat dengan `sigma notes new`. Pembuatan `.md` langsung di `Sigma/notes/` dengan nama bebas, seperti instruksi lama skill `write-memo`, dilarang secara eksplisit: berkas seperti itu tidak terdaftar, tidak masuk `note-list.md`, dan dipindahkan `update` ke `unregistered-notes/` sehingga rujukan memo rusak. Teks instruksi dipertegas pada skill `write-memo` (lima target), `read-memo`, dan `MEMO-TEMPLATE.md` (bagian 4.8) | TERKUNCI (arahan Director, 9 Oktober 2026) |
| K-9 | Tujuan, empat sumber, dan sifat notes seperti bagian 1.1. Konfirmasi lanjutan: T-N5 (non-Markdown bukan bagian notes), pembacaan "tidak usang" sebagai kriteria isi, kesimpulan penting wajib tertulis di artefak sendiri, tanpa mekanisme hash untuk notes | TERKUNCI (Director, 9 Oktober 2026) |
| K-10 | Notes tidak boleh merujuk atau terikat pada artefak mana pun; opsi `--ref <artefak>` **tidak** dibuat. Artefak Sigma boleh merujuk notes (dengan ID dan path). Mengubah isi note setelah dikutip artefak dapat diterima. Menggantikan butir c rekomendasi asisten | TERKUNCI (Director, 9 Oktober 2026) |
| K-11 | Keluaran kerja DEV (misalnya laporan Markdown) punya dua jalur yang sama sah: sebagai note lewat `sigma notes new`, atau sebagai berkas di folder khusus di dalam `dev/`. Syaratnya hanya EXEC memberi tahu lokasi referensinya (Key Output Locations, DEV-RULE L455 sudah mewajibkan). Tidak ada aturan kaku yang memilih jalur. Satu klausa pengecualian ditambahkan ke DEV-RULE Workspace Boundary butir 2 agar penulisan berkas yang dibuat `sigma notes new` tidak melanggar boundary (sikap: izin, bukan pembatasan) | TERKUNCI (Director, 9 Oktober 2026) |
| K-12 | Otoritas (menutup O-18, disetujui sesuai rekomendasi): AI boleh membuat note tanpa persetujuan di muka dalam tiga kasus (lampiran memo K-8; keluaran tugas PLAN/EXEC; catatan penting atas inisiatif sendiri dengan melaporkan ID dan path di respons yang sama) dan selalu boleh atas otoritas Director; `list` dan `update --dry-run` bebas untuk semua role; `update` nyata hanya atas instruksi Director; `--rebuild-registry` hanya dengan `--director-confirm` (K-7). Tidak ada skill baru (O-17: opsi A) dengan kriteria tinjau ulang di bagian 4.9 | TERKUNCI (rekomendasi disetujui) |

Terbuka dari T-17: bentuk penolakan (hentikan seluruh update, atau proses sebagian sambil melapor) -> O-3.

## 3. Peta dampak kode (TERVERIFIKASI pada HEAD d996c5d)

**Fakta dasar**

- Tidak ada perintah `note` atau `notes` di `src/cli.ts` (daftar `addCommand` L33-53) dan tidak ada berkas `src/commands/note*` maupun `test/note*`. Karena perintah lama tidak pernah dirilis, T-13 bagian kompatibilitas nama `sigma note` -> `sigma notes` tidak punya objek: tidak ada pengguna lama yang perlu dijaga.
- `package.json` versi `2.0.0`; `CHANGELOG.md` memuat `[Unreleased]`. Label "rilis 1.1.0" pada F00/D-22 sudah tidak sesuai dengan versi paket -> O-14.
- `SUBFOLDERS` (`src/config.ts:61`) sudah memuat `notes`; `project start` membuat folder tersebut (`src/commands/project.ts:295-297`). Subfolder `note-list` dan `unregistered-notes` belum dibuat siapa pun.
- `setup/targets/*/write-memo` (lima target: claude_code, codex, reasonix, antigravity, opencode) menyuruh AI membuat `.md` bebas di `Sigma/notes/` tanpa penamaan (baris 34-36), dan `read-memo` menyuruh membuka berkas `Sigma/notes/` yang ditunjuk memo. `MEMO-TEMPLATE.md:40` memuat instruksi serupa. `SIGMA_PROTOCOL.md:471` menyebut `Sigma/notes/` sebagai "Free-form notes". `sigma-test` memeriksa keberadaan `Sigma/notes/` (skill, baris 82/126 per target).

**Pola yang dapat ditiru** (bukan salinan: sifat ketiganya berbeda)

| Pola | Berkas | Dipakai untuk |
|---|---|---|
| Use-case transport-agnostik + perintah Commander tipis | `src/services/referenceUpdateService.ts`, `src/commands/reference.ts` | Struktur `notesService` + `notes.ts` |
| Penambahan baris tanpa mengubah baris lama, laporan file hilang tanpa menghapus | `referenceUpdateService.ts` L113-131 | Perlakuan baris registry dengan file hilang |
| Index JSON tunggal dengan field format | `Sigma/messages/index.json` (`MESSAGES_INDEX_FILE`, `mailbox_format: 2`) | Registry catatan |
| Kunci proyek + penulisan atomik | `src/engine/mailboxLock.ts` (`acquireProjectLock` dari `controlStore`), `atomicReplaceFileSync` di `src/utils/fs.ts:50` | Mutasi `new` dan `update` yang bisa bersamaan antar role |
| Path persisten memakai `toPosix` | `src/utils/fs.ts:78` | Path di registry |
| Log operasi | `appendOperationLogEntry` dipanggil dari `src/cli.ts:89` | Otomatis lewat mekanisme CLI yang ada; diverifikasi saat implementasi |

**Titik sentuh yang direncanakan**

| Berkas | Perubahan |
|---|---|
| `src/commands/notes.ts` (baru) | Subperintah `new`, `list`, `update` |
| `src/services/notesService.ts` (baru) | Slug, penamaan, registry, katalog, pemindaian, pemindahan |
| `src/cli.ts` | Daftarkan `notesCommand()` |
| `src/config.ts` | Konstanta `NOTES_DIR`, `NOTES_REGISTERED_DIR`, `NOTES_UNREGISTERED_DIR`, `NOTES_CATALOG_FILE`, `NOTES_REGISTRY_FILE` |
| `src/commands/project.ts` | `project start` membuat dua subfolder baru dan registry kosong (O-10) |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | Entri `notes_new`, `notes_list`, `notes_update` lewat `npm run refresh-registries` (pembaruan terbatas, bukan refresh luas; disiplin yang sama dengan F04 O-13) |
| `Sigma/SIGMA-REGISTRY.json` | Dokumen baru: registry catatan dan katalog (`tolerate_missing`) |
| `src/mcp/policy.ts` | Tidak diubah pada F06 bila MCP ditunda (O-9); operation id yang tidak ada di tabel berarti forbidden |
| Lima target `write-memo`, lima `read-memo`, lima `sigma-test`, `MEMO-TEMPLATE.md` | Bagian instruksi pembuatan catatan ditulis ulang sesuai K-8 (teks usulan di 4.8); `read-memo` mencari juga di `unregistered-notes/`; `sigma-test` memeriksa struktur notes baru |
| Bridge `setup/targets/bridge/` (CLAUDE, GEMINI, AGENTS, DEEPSEEK) | Tabel CLI-Managed Files dan aturan pembuatan catatan (O-16) |
| `Sigma/rules/DEV-RULE.md` | Satu klausa pada Workspace Boundary butir 2 (K-11): berkas yang dibuat `sigma notes new` termasuk pengecualian. Jaga akhir baris berkas (sebagian CRLF, catatan handoff). Hanya master; salinan di `~/.sigma` dan proyek menunggu F09 |
| `README.md`, `CHANGELOG.md` | Baris perintah dan catatan rilis |
| `test/notes.test.ts` (baru) | Lihat bagian 7 |

`dist/` dibangun sesuai disiplin F00 bagian 6 (titik build disetujui Director lebih dulu). Tidak ada perubahan pada kode MCP server, sehingga build tidak mengubah perilaku `sigma-mcp` secara fungsional, tetapi symlink global tetap menjalankan `dist/` terbaru.

## 4. Spesifikasi perilaku (REKOMENDASI kecuali ditandai)

### 4.1 Perintah

| Perintah | Perilaku |
|---|---|
| `sigma notes new --title "<judul>"` | Membuat berkas di `note-list/`, mendaftarkannya, memperbarui `note-list.md` (K-2), mencetak ID dan path. `--title` wajib. Tidak memerlukan chain aktif atau role aktif |
| `sigma notes list [--search <kata>]` | Membaca registry, terbaru di atas: ID, judul, tanggal dibuat, path. `--search` menyaring judul, tidak peka huruf besar-kecil. Hanya baca |
| `sigma notes update [--dry-run]` | Validasi seluruh cakupan, memindahkan Markdown tidak terdaftar, menyegarkan `note-list.md` dari registry |

### 4.2 `new`

1. Ambil kunci proyek. Muat registry (rusak -> tolak, lihat 4.5).
2. Validasi judul: tidak boleh kosong atau berisi baris baru (K-6); slug dari judul (O-2 untuk karakter non-ASCII). Slug kosong -> tolak sebelum menulis apa pun.
3. Nama `NOTE-<YYMMDDHHMM>-<slug>.md`. Bila sudah ada di `note-list/` atau di registry, akhiran `-2`, `-3`; tidak pernah menimpa.
4. Tulis isi awal `# <judul asli>` dan `Dibuat: YYYY-MM-DD HH:MM` ke berkas sementara lalu `renameSync` ke tujuan (mode `wx` untuk mencegah menimpa).
5. Tambah baris registry (`id` = `N` + nomor berikutnya, dua digit minimal, tidak pernah dipakai ulang (K-4); `file` = nama berkas; `title`; `path` posix relatif ke `Sigma/`; `created_at` ISO; `created_by_role` bila role aktif diketahui). Tulis registry atomik.
6. Render ulang `note-list.md` penuh dari registry (K-1, K-5), ditulis atomik. Jika berkas katalog tidak ada, dibuat (self-heal, seperti `reference update`).
7. Urutan tulis: berkas catatan, registry, katalog. Bila registry gagal ditulis setelah berkas dibuat, berkas yatim itu dikategorikan tidak terdaftar oleh `update` berikutnya, bukan hilang; pesan error memuat path berkas. Bila hanya katalog yang gagal, registry sudah benar dan `update` memulihkan katalog; `new` melaporkan peringatan dan exit nonzero.

### 4.3 `list`

Hanya membaca registry; tidak menulis. Menambahkan satu baris peringatan bila pemindaian ringan menemukan Markdown atau non-Markdown yang menunggu `update` (pemindaian read-only, tidak mengubah apa pun). Baris registry dengan berkas hilang ditandai `(hilang)` pada keluaran `list` (K-6); baris itu tidak tampil di `note-list.md`.

### 4.4 `update`

Dua fase, satu hasil:

1. **Validasi cakupan** (sebelum menulis apa pun). Pindai `Sigma/notes/` rekursif, termasuk `note-list/` dan `unregistered-notes/`. Setiap berkas yang ekstensinya bukan `.md` (tidak peka huruf besar-kecil) adalah pelanggaran. Ada pelanggaran -> cetak semua path, exit nonzero, tidak ada pemindahan, registry dan katalog tidak ditulis (O-3, O-4).
2. **Rencana pemindahan.** Setiap `.md` di cakupan yang bukan berkas terdaftar di path registry, bukan `note-list.md`, dan bukan sudah di bawah `unregistered-notes/`, masuk rencana. Tujuan: `unregistered-notes/<path relatif dari notes/, tanpa segmen awal note-list/>` (O-6). Benturan nama di tujuan -> akhiran `-2`, `-3` pada nama berkas; tidak pernah menimpa. Isi dan waktu modifikasi dipertahankan (`rename`, bukan salin-hapus). Folder sumber yang menjadi kosong dibiarkan.
3. **Preflight.** Hitung seluruh tujuan dan benturan sebelum memindahkan apa pun. `--dry-run` berhenti di sini dan mencetak rencana.
4. **Eksekusi.** Pindahkan satu per satu. Kegagalan di tengah -> lapor, exit nonzero; menjalankan ulang aman karena berkas yang sudah pindah berada di `unregistered-notes/` dan diabaikan (idempoten).
5. **Sinkronisasi registry -> katalog.** Baris registry yang berkasnya hilang tetap di registry dan dilaporkan sebagai peringatan; tidak tampil di katalog (K-6). Katalog `note-list.md` dirender penuh dari registry (K-1, K-5), sehingga `update` juga memulihkan katalog yang tertinggal atau disunting manual.
6. **Laporan.** Daftar pemindahan `lama -> baru`, jumlah terdaftar, jumlah hilang, jumlah tidak terdaftar. Daftar pemetaan ini penting karena memo dan pesan lama dapat menunjuk path yang berpindah (R-3).

### 4.5 Kerusakan dan pemulihan registry

- Registry JSON tidak terbaca -> `new` dan `update` menolak dan tidak menimpa, dengan pesan jelas (prinsip non-destruktif yang sama dengan penulisan config MCP).
- Registry tidak ada tetapi `note-list.md` sudah memuat baris katalog (proyek yang pernah memakai registrasi) -> `update` menolak dan tidak menganggap seluruh catatan terdaftar sebagai tidak terdaftar. Pemulihan: pulihkan registry dari Git atau cadangan, atau jalankan `update --rebuild-registry` (4.7, K-7).
- Registry tidak ada dan katalog tidak ada atau kosong -> proyek yang belum pernah memakai notes: registry dibuat kosong (self-heal, seperti `reference update`).

### 4.6 Format data

Registry: `Sigma/notes-registry.json` (lokasi: O-1), `{ "notes_format": 1, "last_id", "notes": [ { "id", "file", "title", "path", "created_at", "created_by_role?", "recovered?" } ] }` (`last_id` = ID numerik tertinggi yang pernah dikeluarkan, agar ID tidak dipakai ulang). Registry adalah sumber kebenaran identitas (K-5). Hash isi tidak disimpan.

Katalog `Sigma/notes/note-list.md` (K-1): judul `# Note List`, satu kalimat bahwa berkas dihasilkan otomatis dan perubahan manual akan ditimpa, lalu tabel:

```markdown
| ID | Nama file | Title |
|---|---|---|
| N01 | [NOTE-2610091530-evaluasi-alur-sigma.md](note-list/NOTE-2610091530-evaluasi-alur-sigma.md) | Evaluasi alur Sigma |
```

Nama file adalah tautan relatif dari `Sigma/notes/`. Urutan baris menurut ID naik. `|` pada judul ditulis `\|` (K-6).

### 4.7 Pemulihan registry: `update --rebuild-registry` (K-7)

Disetujui Director 9 Oktober 2026 dalam versi sempit. Rincian di bawah adalah REKOMENDASI penulis atas versi sempit itu dan belum diputuskan satu per satu (O-15).

- **Kapan boleh.** Hanya bila registry tidak ada atau tidak dapat dibaca. Bila registry sehat, opsi ditolak (tidak ada penimpaan registry yang sehat). Registry tidak terbaca disimpan dulu sebagai `Sigma/notes-registry.json.corrupt-<waktu>`; tidak pernah dihapus.
- **Konfirmasi.** Tanpa `--director-confirm` perintah hanya pratinjau (daftar baris yang akan dipulihkan dan yang ditolak, tanpa menulis). Dengan `--director-confirm` registry ditulis. `--dry-run` tetap berlaku. Hanya CLI; tidak ada primitif MCP (O-9).
- **Bukti yang diterima.** Satu baris katalog dipulihkan hanya bila semuanya terpenuhi: ID berformat `N<angka>` dan unik; nama berkas berpola `NOTE-<10 digit>-<slug>.md`; berkas itu ada di `Sigma/notes/note-list/`. Baris lain ditolak dan dilaporkan beserta alasannya.
- **Isi yang dipulihkan.** `id`, `file`, `title` (escape `\|` dikembalikan) dari katalog; `path` dari lokasi nyata; `created_at` diturunkan dari 10 digit nama berkas (jam lokal, presisi menit) dan diberi penanda `recovered: true`; `created_by_role` tidak dipulihkan.
- **Nomor ID berikutnya** = nilai terbesar di antara semua ID pada katalog (termasuk baris yang ditolak) ditambah satu, agar ID yang pernah dipakai tidak dipakai ulang.
- **Berkas yang tidak ada di katalog** tidak didaftarkan. Perintah ini hanya memulihkan registry dan merender ulang katalog; tidak memindahkan berkas. `update` biasa sesudahnya yang memindahkannya sebagai tidak terdaftar.
- **Risiko yang diterima.** Katalog yang disunting manual sebelum rebuild dapat mendaftarkan berkas yang ada di `note-list/` tetapi tidak pernah dibuat lewat `new`, bila namanya berpola benar. Pratinjau dan `--director-confirm` adalah pengaman; tidak ada pengaman teknis tambahan.

### 4.8 Pembuatan catatan rujukan memo (K-8)

Teks pengganti untuk bagian "Keeping Memos Brief" pada `write-memo` (lima target) dan padanannya di `MEMO-TEMPLATE.md`. Isi usulan, dalam bahasa Inggris seperti skill; kata-kata final ditetapkan saat implementasi dan diperiksa pada U-14:

1. Check whether something already covers it: a DEV-EXEC, another Sigma artifact, or an existing registered note (`sigma notes list --search <keyword>`). If so, point to that from "Reorientation - Read" instead of writing anything new.
2. If nothing covers it, create the note **only** with `sigma notes new --title "<title>"`, then write the detail into the file it prints. **Never create a `.md` file directly under `Sigma/notes/`**: a file not created by `sigma notes new` is not registered, does not appear in `note-list.md`, and is moved to `unregistered-notes/` by `sigma notes update`, which breaks the memo's pointer.
3. Point to the note from "Reorientation - Read" by its ID (for example `N07`) and the path that `sigma notes new` printed. Creating a note this way does not require Director approval.

Penyesuaian terkait:

- `read-memo`: bila berkas yang ditunjuk memo tidak ditemukan di path tertulis, cari nama yang sama di `Sigma/notes/unregistered-notes/` sebelum menyimpulkan berkas hilang.
- Bridge (O-16): aturan yang sama ditulis singkat di bagian CLI-Managed Files.
- Memo lama dengan rujukan ke `Sigma/notes/<berkas>` tidak diubah otomatis (R-3).
- Peran yang ditulis `write-memo`: pembatasan peran (AUD pasif, boundary DEV F13) tidak diubah oleh F06. Skill lama sudah mengizinkan pembuatan berkas di `Sigma/notes/` oleh semua peran; `sigma notes new` hanya memindahkan penulisan itu ke perintah terkelola. Kecocokannya dengan guard F13 diverifikasi saat implementasi (R-5).

### 4.9 Isi bridge dan peninjauan skill (O-16, O-17, K-12)

Aturan singkat untuk bagian "CLI-Managed Files - Do Not Edit Directly" pada bridge CLAUDE, GEMINI, AGENTS, dan DEEPSEEK (REASONIX ditetapkan saat implementasi). Tabel diberi dua baris: `Sigma/notes-registry.json` dan `Sigma/notes/note-list.md` (dibuat oleh `sigma notes new`/`update`, jangan disunting langsung). Lalu aturan, dalam bahasa Inggris seperti bridge:

- Create a note only with `sigma notes new --title "<title>"`; never create a `.md` file directly under `Sigma/notes/` (it would not be registered and `sigma notes update` would move it to `unregistered-notes/`).
- A role may create a note without prior approval for: a memo attachment, an output of its own PLAN/EXEC task, or an important note on its own initiative, in which case it reports the note ID and path in the same response. The Director's explicit instruction always suffices.
- A note is free-form, independent, and non-authoritative. It never replaces an artifact: conclusions and claims that matter belong in the artifact itself. An artifact may cite a note by ID and path; a note does not cite or depend on an artifact.
- `sigma notes update --dry-run` is free for any role; running `sigma notes update` for real is done only on the Director's instruction.

Peninjauan skill (O-17): tidak ada skill `write-notes`/`read-notes`. Tinjau ulang bila Director sering memanggil pembuatan note dan hasilnya tidak konsisten.

## 5. Kompatibilitas dan migrasi

- Proyek baru: `project start` membuat `note-list/`, `unregistered-notes/`, registry kosong, dan katalog awal (O-10).
- Proyek lama: tidak ada migrasi otomatis. Folder dan registry dibuat saat `new` atau `update` pertama (self-heal). `project sync` tidak menyentuh isi `Sigma/notes/`.
- **Efek `update` pertama pada proyek yang sudah berisi banyak catatan (KLHK).** Seluruh Markdown (73 berkas pada data diskusi) pindah ke `unregistered-notes/` dan `update` menolak berjalan selama ada non-Markdown (12 berkas: PDF, DOCX, PPTX, XLSX, TXT, HTML, JPG, PNG, JS). Director harus memindahkan atau menghapus berkas non-Markdown itu secara manual sebelum `update` dapat berjalan. Ini konsekuensi langsung T-17, bukan temuan baru. `--dry-run` disediakan agar dampaknya terlihat sebelum pemindahan (O-4). Tidak ada tindakan terhadap KLHK pada F06.
- Memo dan pesan lama yang menunjuk `Sigma/notes/<berkas>` akan menunjuk path yang sudah berpindah setelah `update` pertama (R-3, O-11).
- Tidak ada perubahan `SCHEMA_VERSION`, tidak ada perubahan format chain atau mailbox.

## 6. Keputusan terbuka

Format: pertanyaan, rekomendasi dengan alasan, kolom jawaban Director.

| ID | Pertanyaan | Rekomendasi dan alasan | Jawaban Director |
|---|---|---|---|
| O-1 | Di mana registry JSON disimpan dan apa namanya? (T-12; keberadaan registry JSON sebagai sumber kebenaran sudah terkunci di K-5, lokasi belum) | `Sigma/notes-registry.json` di akar `Sigma/`. Di luar `Sigma/notes/` sesuai pembatasan Markdown; sejajar dengan `SIGMA-REGISTRY.json` dan `project.config.json`; satu berkas, mudah dilacak Git. Alternatif: di `Sigma/memory/` (folder itu untuk memori role, kurang cocok) |  Disetujui sesuai rekomendasi (Director, 9 Oktober 2026) |
| O-2 | Penanganan karakter non-ASCII pada judul untuk slug (huruf beraksen, aksara non-Latin) | Normalisasi NFKD, buang tanda diakritik, lalu aturan N-1. Judul seluruhnya non-Latin menghasilkan slug kosong dan ditolak dengan pesan yang menyebut alasannya. Menjaga nama file aman Windows tanpa menambah dependensi |  Disetujui sesuai rekomendasi (Director, 9 Oktober 2026) |
| O-3 | Bentuk penolakan `update` bila ada non-Markdown: hentikan seluruh update, atau proses sebagian sambil melapor? (terbuka dari T-17) | Hentikan seluruh update dan cetak semua path pelanggaran, tanpa pemindahan atau penulisan sebagian. Sesuai kata "menolak berjalan" pada arahan Director dan menghindari keadaan setengah jalan yang katalognya tidak mewakili isi folder |  Disetujui sesuai rekomendasi (Director, 9 Oktober 2026) |
| O-4 | Apakah `update` menyediakan `--dry-run`, dan apakah cakupan validasi non-Markdown mencakup `unregistered-notes/` dan seluruh subfolder? | Ya untuk keduanya. `--dry-run` mencetak rencana pemindahan dan pelanggaran tanpa menulis (dampak update pertama pada KLHK besar). Cakupan rekursif penuh sesuai "setiap file non-Markdown yang terdeteksi di folder notes" |  Disetujui sesuai rekomendasi (Director, 9 Oktober 2026) |
| O-5 | Siapa yang menulis `note-list.md`? | **DITUTUP oleh Director 9 Oktober: K-2.** `new` memperbarui katalog otomatis; `update` juga menyegarkannya. Rekomendasi asisten sebelumnya ("hanya `update`") tidak dipakai | Ditutup (K-2) |
| O-6 | Tujuan pemindahan Markdown dari subfolder tak dikenal (mis. `notes/arsip/x.md`): ratakan ke `unregistered-notes/`, atau pertahankan path relatif? | Pertahankan path relatif (`unregistered-notes/arsip/x.md`), kecuali segmen awal `note-list/` yang dibuang. Tidak ada benturan nama antar subfolder, struktur lama tetap terbaca, dan tetap sesuai larangan "tidak dipindahkan ulang bertingkat" karena isi `unregistered-notes/` tidak dipindah lagi |  Disetujui sesuai rekomendasi (Director, 9 Oktober 2026) |
| O-7 | Kolom katalog dan keterangan manual | **DITUTUP oleh Director 9 Oktober: K-1.** Tiga kolom (ID, Nama file, Title), otomatis penuh; tanpa Keterangan, tanpa `--summary`, tanpa pembacaan balik tabel | Ditutup (K-1) |
| O-8 | Perlakuan baris registry yang berkasnya hilang atau diganti nama (T-12) | **DITUTUP: K-6.** Baris tetap di registry, tidak tampil di katalog, dilaporkan sebagai peringatan; tidak pernah dihapus otomatis. Berkas yang diganti nama di `note-list/` berarti path registry hilang dan berkas baru tidak terdaftar sehingga dipindahkan; konsisten dengan "nama dan posisi bukan bukti registrasi". Tidak ada penanda identitas di dalam isi berkas pada versi pertama | Ditutup (K-6) |
| O-9 | Apakah F06 menambah tool MCP (query `sigma_list_notes` dan/atau control `sigma_notes_*`)? | Tidak. Hanya CLI. Alasan: arahan Director hanya menyebut `sigma notes`; MCP menambah tier policy, jumlah tool (README menyebut 29), tes parity, dan butir keamanan (`update` memindahkan berkas) yang belum diminta. Dicatat sebagai tindak lanjut bila dibutuhkan |  Disetujui sesuai rekomendasi (Director, 9 Oktober 2026) |
| O-10 | Apakah `project start` membuat struktur notes baru dan registry kosong? | Ya untuk proyek baru (`note-list/`, `unregistered-notes/`, registry kosong, katalog awal). Proyek lama dibuat saat pemakaian pertama. `project sync` tidak menyentuh `Sigma/notes/` |  Disetujui sesuai rekomendasi (Director, 9 Oktober 2026) |
| O-11 | Memo dan pesan lama yang menunjuk path catatan yang berpindah (R-3): peringatan apa? | Laporan `lama -> baru` dari `update` saja, ditambah perubahan skill: `write-memo` wajib memakai `sigma notes new` (K-8) dan menunjuk ID serta path yang dicetak; `read-memo` bila berkas tidak ditemukan mencari nama yang sama di `unregistered-notes/`. Tidak ada pemindaian memo/pesan oleh `update` pada F06 (menambah cakupan baca mailbox dan interaksi dengan kunci F03). Pemindaian dapat ditambahkan bila terbukti dibutuhkan |  Disetujui sesuai rekomendasi (Director, 9 Oktober 2026) |
| O-12 | Opsi `--rebuild-registry` untuk registry hilang pada proyek yang pernah memakai notes? | **DITUTUP oleh Director 9 Oktober: K-7.** Dibuat, versi sempit (bagian 4.7). Rekomendasi asisten sebelumnya ("tunda") tidak dipakai: Sigma tidak pernah commit sendiri sehingga Git belum tentu menyimpan registry, dan `update` terkunci bila registry hilang | Ditutup (K-7) |
| O-15 | Rincian 4.7 (turunan K-7): hanya jika registry hilang/rusak; pratinjau tanpa `--director-confirm`; bukti = ID valid unik + pola nama berkas + berkas ada di `note-list/`; `created_at` diturunkan dari nama berkas dan ditandai `recovered`; tidak memindahkan berkas; registry rusak disimpan sebagai `.corrupt-<waktu>` | Setuju seperti ditulis. Rincian ini rekomendasi saya atas pilihan Director, bukan keputusan Director |  Disetujui sesuai rekomendasi (Director, 9 Oktober 2026) |
| O-16 | Apakah informasi notes dimasukkan ke rules, bridge, dan Protocol? | **DITUTUP (rekomendasi disetujui, dengan koreksi atas K-11).** Bridge: ya (bagian 4.9). Rules role: tidak diubah, **kecuali DEV-RULE** satu klausa pengecualian (K-11); ARC/FMN/AUD-RULE tidak diubah. Protocol: baris `Sigma/notes/` (L471) dan bagian perintah diperbarui pada pekerjaan Protocol (terakhir). `REASONIX.md` belum punya bagian CLI-Managed Files; ditetapkan saat implementasi | Ditutup |
| O-17 | Skill baru (mis. `write-notes`)? | **DITUTUP: opsi A, tanpa skill baru** (bagian 4.9). Kriteria tinjau ulang: bila dalam pemakaian Director sering memanggil pembuatan note dan hasilnya tidak konsisten (isi, judul, penyebutan). Dicatat agar tidak terlupakan | Ditutup |
| O-18 | Siapa yang berinisiatif menjalankan perintah notes? | **DITUTUP: K-12** | Ditutup |
| O-13 | Berkas non-Markdown "sistem" (`.gitkeep`, `desktop.ini`, `Thumbs.db`, `.DS_Store`): dikecualikan dari auto rejection? | Kecualikan keempatnya saja. Tanpa pengecualian, Explorer Windows atau Git dapat memblokir `update` secara tidak terduga oleh berkas yang bukan catatan. Daftar tetap, tidak dapat dikonfigurasi, dilaporkan saat ditemukan. Ini penyempitan atas "setiap file non-Markdown", maka butuh persetujuan eksplisit |  Disetujui sesuai rekomendasi (Director, 9 Oktober 2026) |
| O-14 | Penomoran rilis dan versi: label "rilis 1.1.0" pada D-22 | Tanpa label versi pada dokumen ini. Catatan di `CHANGELOG [Unreleased]`; nomor rilis ditentukan Director saat rilis. Alasan: `package.json` sudah 2.0.0 sehingga 1.1.0 tidak dapat dipenuhi, dan versi paket tidak diubah pada fokus ini | |

## 7. Strategi uji dan kriteria selesai

Kontrak uji (rencana):

| ID | Cakupan |
|---|---|
| U-01 | Slug: huruf besar, spasi, simbol, hubung ganda, batas panjang, karakter Windows terlarang, diakritik (O-2), slug kosong ditolak; judul berisi baris baru ditolak (K-6) |
| U-02 | `new`: nama `NOTE-YYMMDDHHMM-slug.md`, isi awal, baris registry dengan ID `N01`, `N02`, ... (tidak dipakai ulang setelah berkas hilang, K-4), path posix, tidak menimpa; benturan nama `-2`/`-3`; `note-list.md` ikut diperbarui pada setiap `new` (K-2); kegagalan penulisan registry dan katalog (injeksi) meninggalkan keadaan yang dapat dipulihkan `update` |
| U-03 | `list`: urutan terbaru di atas, `--search` pada judul, penanda `(hilang)`, tidak menulis apa pun, bekerja tanpa chain |
| U-04 | `update` menolak non-Markdown: semua path dilaporkan, exit nonzero, tidak ada berkas yang berpindah dan tidak ada registry/katalog yang ditulis; rekursif termasuk `unregistered-notes/`; berkas `.gitkeep` dan sejenisnya dikecualikan (O-13) |
| U-05 | `update` memindahkan Markdown tidak terdaftar (root `notes/`, `note-list/`, subfolder) ke `unregistered-notes/` sesuai O-6; isi dan waktu modifikasi tidak berubah; benturan nama tanpa menimpa |
| U-06 | Berkas terdaftar tidak dipindahkan walau isinya disunting; `note-list.md` tidak diperlakukan sebagai catatan; `unregistered-notes/` tidak dipindah ulang |
| U-07 | Idempoten: `update` kedua tidak mengubah apa pun; pemulihan setelah kegagalan di tengah pemindahan (injeksi) |
| U-08 | `--dry-run` mencetak rencana tanpa menulis |
| U-09 | Registry rusak ditolak tanpa menimpa; registry hilang dengan katalog berisi ditolak; registry hilang tanpa katalog dibuat kosong |
| U-09b | `--rebuild-registry` (K-7): ditolak bila registry sehat; pratinjau tanpa `--director-confirm` tidak menulis; dengan konfirmasi memulihkan hanya baris yang memenuhi bukti (ID valid unik, pola nama, berkas ada); baris yang ditolak dilaporkan beserta alasan; `created_at` dari nama berkas dan `recovered: true`; ID berikutnya tidak memakai ulang ID terbesar katalog (termasuk baris ditolak); berkas di luar katalog tidak didaftarkan dan tidak dipindahkan pada run yang sama; registry rusak tersimpan sebagai `.corrupt-<waktu>`; `\|` pada judul dipulihkan; tidak ada primitif MCP |
| U-10 | Katalog: tiga kolom ID/Nama file/Title (K-1), dirender penuh dari registry, suntingan manual ditimpa dan tidak mengubah registrasi (K-5), baris berkas hilang tidak tampil tetapi tetap di registry dan tampil kembali bila berkas kembali (K-6), `\|` di-escape, tautan relatif benar, katalog hilang dibuat ulang |
| U-11 | Dua `new` bersamaan dari proses berbeda tidak kehilangan baris registry (kunci proyek) |
| U-12 | `project start` membuat struktur baru; `project sync` tidak menyentuh `Sigma/notes/` |
| U-13 | Registry operasi memuat tiga entri baru dan parity CLI tidak rusak; jumlah tool MCP tidak berubah (O-9) |
| U-14 | Skill `write-memo`/`read-memo`/`sigma-test` pada lima target konsisten; tidak ada rujukan ke perintah yang tidak ada |
| U-15 | Pemeriksaan batas scope: Constitution, Protocol, `SCHEMA_VERSION`, versi paket tidak berubah; tidak ada sinkronisasi atau migrasi nyata; KLHK tidak disentuh |
| U-16 | DEV-RULE: klausa pengecualian tepat satu, tidak membatasi jalur lain, tidak mengubah butir lain; teks bridge dan skill memo konsisten dengan K-8, K-10, K-11, K-12; tidak ada opsi `--ref` pada `new` |

Kriteria selesai: U-01 sampai U-15 lulus, `tsc --noEmit` bersih, suite penuh hijau (baseline sebelum F06: 75 berkas / 1.141 tes), `git diff --check` lulus, hasil dicatat sebagai bagian 11 dokumen ini, F00 diperbarui. Commit dan push menunggu instruksi terpisah. Uji tidak memakai proyek nyata; semua fixture di direktori sementara.

## 8. Risiko dan dependensi

| ID | Risiko / dependensi | Penanganan |
|---|---|---|
| R-1 | `update` pertama pada proyek berisi banyak catatan memindahkan puluhan berkas sekaligus dan ditolak oleh non-Markdown | `--dry-run`, laporan pemetaan, tidak ada penghapusan; keputusan Director atas berkas non-Markdown di luar scope tool |
| R-2 | Aturan "setiap non-Markdown" memblokir `update` oleh berkas sistem | O-13 |
| R-3 | Memo, pesan, dan INTENT yang menunjuk `Sigma/notes/<berkas>` menjadi usang setelah pemindahan; skill write-memo selama ini membuat berkas langsung di `Sigma/notes/` yang kini otomatis tidak terdaftar | Perubahan skill, laporan pemetaan, O-11. Residu: rujukan lama tidak diperbarui otomatis |
| R-4 | Dua role menjalankan `new`/`update` bersamaan merusak registry | Kunci proyek + penulisan atomik, U-11 |
| R-5 | Boundary DEV (F13): DEV-RULE Workspace Boundary butir 2 hanya mengecualikan berkas EXEC dan operasi Sigma yang menulis di dalam `Sigma/` (contoh `sigma memo`, `sigma send`); penyuntingan isi note setelah `new` berada di luar pengecualian itu (TERVERIFIKASI di DEV-RULE L303-314) | **Ditangani K-11:** satu klausa pengecualian pada DEV-RULE butir 2. Dua jalur laporan (notes atau folder di `dev/`) sama sah; EXEC memberi tahu lokasi. Guard F13 bersifat aturan, bukan hook mekanis; kecocokan akhir diverifikasi saat implementasi |
| R-6 | Katalog dapat berbeda dari registry bila penulisan katalog gagal setelah registry berhasil, atau disunting manual (K-5) | `new` melaporkan peringatan; `update` merender ulang katalog dari registry; `list` membaca registry |
| R-7 | Perubahan Protocol: `SIGMA_PROTOCOL.md:471` ("Free-form notes") dan bagian perintah (§16) belum menyebut `sigma notes` | Dicatat untuk pekerjaan Protocol (paling akhir); tidak diubah |
| R-8 | Skill dan template di master baru berlaku di proyek setelah F09 | Sesuai batas fokus; dicatat sama seperti F03/F04 |

Dependensi: tidak bergantung pada F01, F07, F08. Sinkronisasi hasil ke proyek menunggu F09.

## 9. Urutan langkah implementasi (O-1 sampai O-18 tertutup; urutan tentatif)

Usulan awal, tentatif:

1. W0: verifikasi ulang HEAD dan worktree, baseline `tsc` dan suite.
2. W1: konstanta `config.ts`, `notesService` (slug, registry, kunci, penulisan atomik) dengan uji U-01, U-02, U-11.
3. W2: `list` dan `update` (validasi, rencana, pemindahan, katalog) dengan U-03 sampai U-10.
4. W3: `notes.ts`, `cli.ts`, `project start`, registry operasi terbatas dan `SIGMA-REGISTRY.json` (U-12, U-13).
5. W4: skill lima target, `MEMO-TEMPLATE.md`, bridge, klausa DEV-RULE (K-11), `README.md`, `CHANGELOG.md` (U-14, U-16).
6. W5: build `dist/` setelah persetujuan, suite penuh, pemeriksaan batas scope (U-15), isi bagian 11, perbarui F00.

Commit dan push hanya atas instruksi Director.

## 11. Hasil eksekusi F06 (9 Oktober 2026)

Dieksekusi atas instruksi Director ("silahkan lakukan eksekusi") pada `main`, HEAD `d996c5d`. Belum di-commit. Build `dist/` tidak dijalankan pada tahap eksekusi awal karena memerlukan persetujuan Director (bagian 3 dan F00 bagian 6); dijalankan kemudian, lihat 11.5.

### 11.1 Yang diterapkan (W0-W4)

| Area | Hasil |
|---|---|
| Kode | `src/services/notesService.ts` (baru), `src/commands/notes.ts` (baru), `src/cli.ts` (daftar perintah), `src/config.ts` (konstanta `NOTES_*`), `src/commands/project.ts` (`initNotes` pada `project start`/`--reinit`) |
| Perintah | `sigma notes new --title [--role]`, `list [--search]`, `update [--dry-run] [--rebuild-registry] [--director-confirm]`. Mutasi memakai kunci proyek (`withMailboxLock`) dan penulisan atomik. Tidak ada `--ref` (K-10) dan tidak ada tool MCP (O-9) |
| Registry | `SIGMA-OPERATION-REGISTRY.json`: tiga entri (`notes_new`, `notes_list`, `notes_update`, domain `notes`), total 65 -> 68, penambahan murni; tanpa refresh luas. `SIGMA-REGISTRY.json`: dua dokumen (`notes_registry`, `notes_catalog`), 18 -> 20 |
| Skill dan template | `write-memo` (5 target), `read-memo` (5), `sigma-test` (5), `MEMO-TEMPLATE.md` sesuai K-8 dan bagian 4.8 |
| Bridge | CLAUDE, GEMINI, AGENTS: dua baris tabel CLI-Managed Files + blok aturan notes. DEEPSEEK: kalimat + blok aturan. REASONIX: tiga perintah ditambahkan ke whitelist aman, dua ke daftar yang memerlukan otorisasi, bagian "Notes" baru (REASONIX belum punya bagian CLI-Managed Files; diselesaikan sesuai O-16) |
| DEV-RULE | Satu klausa pada Workspace Boundary butir 2: pengecualian untuk berkas yang dibuat `sigma notes new` (K-11). Tidak ada perubahan lain |
| Dokumen | `README.md` (4 baris perintah), `CHANGELOG.md` (satu butir Added) |
| Tes | `test/notes.test.ts` (37 tes); tiga hitungan registry diperbarui 65 -> 68 pada `dev-workspace.test.ts`, `f14-removal.test.ts`, `mcp-binding.test.ts` |

### 11.2 Verifikasi

- `tsc --noEmit` bersih.
- Karena `dist/` tidak dibangun, tes CLI dijalankan terhadap build sementara di luar `dist/` (`tsc --outDir dist-f06`, `SIGMA_TEST_DIST=dist-f06`); folder itu sudah dihapus.
- Suite penuh: 76 berkas / 1.178 tes lulus (baseline sebelum F06: 75 / 1.141, ditambah 37 tes baru). Satu tes F04 (`U-06/U-11`) gagal sekali pada run penuh pertama dan lulus saat dijalankan sendiri (24/24) serta pada run penuh kedua; ini jenis flaky yang sama yang tercatat pada F16, tidak terkait F06.
- `git diff --check` bersih. Pemeriksaan batas scope (U-15): Constitution, Protocol, `SCHEMA_VERSION` (1.2.0), `package.json`, `dist/`, ARC/FMN/AUD-RULE tidak berubah; tidak ada sinkronisasi ke `~/.sigma` atau proyek; KLHK tidak disentuh.

### 11.3 Perbedaan dari rencana dan temuan

1. **Field `last_id` pada registry.** Bagian 4.6 tidak menyebutnya. Ditambahkan agar ID tidak dipakai ulang (K-4) dan agar rebuild dapat mempertahankan nomor tertinggi dari baris katalog yang ditolak (4.7). Format registry: `{ notes_format: 1, last_id, notes: [...] }`.
2. **Peringatan `list`** (Markdown tidak terdaftar, non-Markdown) ditulis ke stderr, bukan stdout, agar keluaran daftar tetap bersih.
3. **U-12 sebagian.** `project sync` diuji tidak mengubah registry yang ada; `project start --reinit` memakai jalur `initNotes` yang tidak menimpa registry yang ada, dicakup oleh logika (tidak ada tes `--reinit` tersendiri).
4. **U-11** diuji dengan dua proses `notes new` paralel: keduanya terdaftar dengan ID berbeda.
5. **`refresh-registries:dry`** (sebelum build) melaporkan `notes_new`/`notes_list`/`notes_update` sebagai "terdaftar tetapi tidak terdeteksi di CLI" karena skrip membaca `dist/` yang belum dibangun (butir `intent_baseline` lama mengalami hal yang sama). Diverifikasi ulang setelah build disetujui.
6. **Role memory DEV** (`dev-memory.json` L26) semula menulis pengecualian boundary tanpa menyebut note. Ditambahkan 10 Oktober 2026 atas permintaan Director setelah commit 6b493ee: `(exceptions: the EXEC file, Sigma operations that write inside Sigma/, and a note file created with sigma notes new)`; `memory_updated_at` menjadi 2026-10-10. Hanya master; salinan di `~/.sigma` dan proyek menunggu F09.
7. **Memo lama** dengan rujukan `Sigma/notes/<berkas>` tidak diubah (R-3).
8. **Protocol** (`SIGMA_PROTOCOL.md` L471 dan bagian perintah) belum menyebut `sigma notes` (R-7); menunggu pekerjaan Protocol.

### 11.4 Menunggu Director

1. ~~Persetujuan build `dist/`~~ Selesai, lihat 11.5.
2. Instruksi commit untuk `dist/` dan pembaruan dokumen F06/F00 (kode, tes, dan dokumen awal sudah di 6b493ee).
3. Smoke manual opsional: `sigma notes new` pada proyek uji, lalu satu sesi `/write-memo` yang membuat note.

### 11.5 Build `dist/` (9 Oktober 2026, setelah commit 6b493ee)

- Commit 6b493ee (kode, tes, dokumen) sudah di-push Director, tetapi belum memuat `dist/`; tes CLI terhadap `dist/` yang lama akan gagal. Atas instruksi "lanjutkan" Director, `npm run build` dijalankan. Hasil pada worktree: `dist/cli.js`, `dist/config.js`, `dist/config.d.ts` (+ map), `dist/commands/project.js` (+ map) berubah; `dist/commands/notes.*` dan `dist/services/notesService.*` baru. Tidak ada perubahan `dist/` lain.
- Suite penuh terhadap `dist/` sebenarnya: 76 berkas / 1.178 tes lulus, tanpa kegagalan.
- `refresh-registries:dry`: tiga operasi notes tidak lagi dilaporkan; yang tersisa hanya `intent_baseline` (butir lama, tidak terkait F06).
- Symlink global `sigma`/`sigma-mcp` kini menjalankan perintah `sigma notes`; tidak ada kode server MCP yang berubah.
- Belum di-commit: perubahan `dist/` ini dan pembaruan dokumen bagian 11.5. Menunggu instruksi commit Director.
- Tambahan 10 Oktober 2026: `Sigma/role-memory/dev-memory.json` (satu kalimat, lihat 11.3 butir 6) ikut belum di-commit. Suite penuh sesudahnya 76 berkas / 1.178 tes lulus. Tes F04 `U-06/U-11` (varian `target`/`audit`) gagal secara berselang pada 3 dari 7 run penuh hari ini, selalu lulus bila dijalankan sendiri (24/24, dua kali); dugaan penyebab (inferensi, belum dibuktikan): anggaran 250 ms `CONTROL_MUTATION_MAX_MS` terlampaui saat beban paralel. Tidak terkait F06.

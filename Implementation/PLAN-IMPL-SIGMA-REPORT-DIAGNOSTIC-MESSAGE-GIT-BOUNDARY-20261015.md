# PLAN IMPLEMENTASI — Sigma Report, Diagnostic, dan Message–Git Boundary

**Tanggal:** 2026-10-15
**Status:** Draf untuk review Director
**Jenis:** Work order dan test contract
**Batas kewenangan:** Dokumen ini tidak mengaktifkan role Sigma, tidak meregistrasikan repository sebagai proyek Sigma, dan tidak mengotorisasi commit atau push.

## 1. Tujuan

Memperbaiki tiga area yang saling berkaitan tetapi memiliki batas keputusan berbeda:

1. memperbarui skill `report` agar briefing tetap ringkas, akurat, tidak memakai referensi operasi usang, serta memuat bukti progress dari status Git dan commit terakhir;
2. memperluas `sigma-test` menjadi diagnostic berlapis yang memeriksa operasi read-only tanpa membuat pemeriksaan rutin terlalu berat;
3. menetapkan boundary bahwa pembuatan message Sigma tidak boleh melakukan Git commit atau push, sementara desain rinci message ditunda untuk pembahasan khusus.

## 2. Baseline terverifikasi

### 2.1 Report

- Skill global dan salinan sumber repository identik pada saat audit, dengan SHA-256 `d065ca51e5c1a7cb156bae5ba67d0976288785287f939ab783d699b72c9083b7`.
- Skill bersifat read-only, menetapkan format briefing dan batas kata, serta melarang mutasi dan operasi Git.
- Daftar larangan masih menyebut operasi usang/tidak tersedia, termasuk `sigma exec supersede`, `sigma project reset`, dan stale-intent acknowledgement.
- Frasa “during or after #report” terlalu luas secara semantik. Boundary yang dapat diuji adalah “selama invocation report”; larangan permanen setelah invocation tidak dapat ditegakkan oleh skill ini.
- Pemeriksaan Git belum diwajibkan sebagai sumber bukti progress. Tanpa `git status` dan commit terakhir, report dapat melewatkan pekerjaan lokal yang belum dicatat atau tidak mengetahui baseline perubahan yang sudah tercatat.

### 2.2 Sigma-test

- Diagnostic saat ini berfokus pada CLI, instalasi skill, dan struktur proyek.
- Registry memiliki 86 operasi aktif; menjalankan seluruh kombinasi operasi read-only pada setiap diagnostic interaktif berisiko lambat, bising, dan menghasilkan kegagalan palsu ketika prasyarat lifecycle tidak tersedia.
- Sebagian status MCP saat ini drift dari tool aktual; diagnostic tidak boleh mempercayai `mcp_status` tanpa parity check.
- Repository ini tidak aktif sebagai proyek Sigma. Kondisi tersebut harus dilaporkan sebagai informasi atau `N/A`, bukan diperbaiki otomatis.

### 2.3 Message dan Git

- Jalur `send` menulis message, index, attachment opsional, dan operation log; jenis `CONTRACT_CHANGE` juga dapat menyentuh ledger/progress.
- Jalur tersebut tidak menjalankan `git add`, `git commit`, atau `git push`.
- Adapter Git Sigma menyatakan Sigma tidak melakukan stage, commit, checkout, reset, fetch, atau push. Pengecualian yang ada adalah pembuatan local annotated tag untuk alur amendment/baseline tertentu.
- Karena itu, secara teknis AI dapat membuat message tanpa commit/push. Namun pembuatan message tetap merupakan mutasi filesystem/Sigma state, sehingga harus tunduk pada authority dan approval yang relevan.

## 3. Prinsip desain

### 3.1 Professional Mode tetap role utama

Penggunaan struktur work order dan test contract dari FMN hanya merupakan pewarisan metode. Rencana ini tidak:

- mengubah role utama menjadi FMN;
- menjalankan aktivasi role Sigma;
- menganggap repository ini sebagai proyek Sigma aktif.

### 3.2 Diagnostic bersifat observasional

Diagnostic tidak boleh memperbaiki, menginisialisasi, mendaftarkan, atau memigrasikan state secara otomatis. Rekomendasi perbaikan boleh diberikan sebagai output terpisah.

### 3.3 Kepemilikan Git

- AI boleh membuat atau memperbarui artefak yang secara eksplisit diotorisasi, termasuk message Sigma.
- Pembuatan message tidak boleh secara implisit menjalankan stage, commit, tag, atau push.
- Commit dan push tetap tindakan Director, baik dijalankan langsung maupun melalui instruksi Director yang eksplisit pada tahap terpisah.
- Status “message berhasil dibuat” tidak boleh dinyatakan sebagai “perubahan sudah dipublikasikan”.

## 4. Ruang lingkup implementasi

### WP-RPT-01 — Perbarui sumber skill report

1. Pertahankan sifat read-only, briefing singkat, dan pelabelan unknown.
2. Ganti daftar operasi terlarang yang usang dengan boundary berbasis kategori:
   - tidak membuat atau mengubah artefak;
   - tidak menjalankan operasi lifecycle/control;
   - tidak menjalankan Git mutation atau publication;
   - tidak mengaktifkan role/proyek.
3. Bila contoh command tetap dipakai, validasi terhadap CLI help/registry aktual.
4. Ubah larangan “during or after” menjadi larangan selama invocation dan terhadap side effect yang dipicu oleh invocation.
5. Tegaskan bahwa report tidak boleh mengubah `unknown` menjadi asumsi.
6. Pertahankan Professional Mode sebagai fallback netral ketika tidak ada role Sigma aktif.
7. Tambahkan pemeriksaan Git read-only:
   - `git status --short --branch` untuk branch, staged changes, unstaged changes, dan untracked files;
   - `git log -1 --format='%h|%cI|%an|%s'` atau ekuivalen plumbing yang stabil untuk hash pendek, waktu commit, author, dan subject commit terakhir;
   - bila repository memiliki upstream lokal, laporkan ahead/behind dari tracking ref yang tersedia tanpa menjalankan `git fetch`.
8. Interpretasikan bukti Git secara eksplisit:
   - commit terakhir adalah baseline pekerjaan yang sudah tercatat dalam Git;
   - staged, unstaged, dan untracked adalah progress lokal yang belum seluruhnya tercatat;
   - worktree bersih berarti tidak ada perubahan lokal terhadap commit saat ini, bukan bukti bahwa pekerjaan atau acceptance criteria sudah selesai;
   - status ahead/behind dapat kedaluwarsa karena report tidak memperbarui remote refs;
   - repository non-Git atau branch tanpa commit dilaporkan `N/A`, bukan error fatal.
9. Sajikan ringkasan Git dalam bagian status/progress report yang sudah ada tanpa melampaui batas ukuran briefing. Detail file hanya ditampilkan bila relevan terhadap keputusan berikutnya.

### WP-RPT-02 — Sinkronisasi instalasi report

1. Tentukan sumber kanonis skill dalam repository.
2. Tambahkan pemeriksaan checksum atau semantic diff antara sumber dan target instalasi.
3. Update target instalasi hanya melalui prosedur setup yang sudah disetujui; jangan menulis langsung ke konfigurasi global dalam test rutin.
4. Diagnostic hanya melaporkan drift dan command remediasi.

### WP-TST-01 — Model diagnostic berlapis

Gunakan empat lapisan agar coverage dan biaya eksekusi seimbang.

#### Lapisan A — Baseline wajib

Dijalankan pada setiap `sigma-test`:

- versi dan ketersediaan CLI;
- parsing top-level/subcommand help;
- bootstrap/discovery tanpa mutasi;
- keberadaan serta integritas skill global dan sumber lokal;
- status proyek aktif/tidak aktif;
- ketersediaan konfigurasi MCP query dan, bila dipasang manual, control;
- introspeksi daftar tool MCP;
- kebersihan efek samping diagnostic.

#### Lapisan B — Parity wajib

Dijalankan pada setiap `sigma-test`, tetapi hanya melakukan inspeksi metadata:

- seluruh operasi registry aktif memiliki klasifikasi read-only/mutating dan MCP status;
- registry, operation tier, manifest MCP, policy, dan tool aktual konsisten;
- tombstone tidak dihitung aktif;
- operasi baru yang belum diklasifikasikan menghasilkan failure yang actionable.

Lapisan ini memberi cakupan semua operasi tanpa mengeksekusi semuanya.

#### Lapisan C — Representative smoke

Jalankan sampel berisiko dan representatif pada fixture atau proyek aktif yang memenuhi prasyarat:

- state/orientation;
- status/list;
- document check;
- mailbox integrity/read-only listing;
- config read;
- log/audit read;
- Git inspection;
- satu tool query MCP dari setiap keluarga handler.

Bila prasyarat lifecycle tidak ada, hasil harus `N/A: prerequisite absent`, bukan `FAIL` dan bukan registrasi otomatis.

#### Lapisan D — Exhaustive read-only conformance

Jalankan seluruh operasi yang diklasifikasikan read-only dalam fixture/CI khusus, bukan pada setiap diagnostic interaktif:

- fixture mencakup proyek kosong, lifecycle parsial, lifecycle lengkap, mailbox kosong/berisi, dan repository Git/non-Git;
- verifikasi exit code, schema output, determinisme, serta tidak adanya mutasi;
- operasi dengan kombinasi parameter besar memakai kasus equivalence class dan boundary, bukan semua permutasi;
- hasil dipublikasikan sebagai laporan coverage yang menyebut operasi yang diuji, `N/A`, dan alasan skip.

### WP-TST-02 — Definisi read-only yang dapat diuji

Suatu operasi hanya lulus sebagai read-only bila tidak mengubah:

- file proyek atau global config;
- message/index/ledger/progress;
- operation log;
- Git index, worktree, refs, tags, commits, atau remote;
- proses server/configuration persistence;
- status aktivasi proyek atau role.

Jika command observasional saat ini selalu menulis operation log, command tersebut tidak boleh diklaim read-only sampai tersedia mode inspeksi tanpa log atau kontraknya diklasifikasikan ulang.

### WP-TST-03 — Output diagnostic

Setiap check menghasilkan:

- `PASS`, `FAIL`, `WARN`, atau `N/A`;
- identifier stabil;
- bukti ringkas;
- dampak;
- remediasi yang disarankan tetapi tidak dijalankan otomatis.

Exit code:

- `0`: tidak ada failure;
- non-zero: minimal satu invariant wajib gagal;
- warning dan `N/A` tidak membuat exit non-zero kecuali mode strict dipilih eksplisit.

### WP-MSG-01 — Boundary message dan Git

Implementasi pada iterasi ini hanya mengunci invariant berikut:

1. command/tool message tidak memanggil adapter stage/commit/push;
2. tidak ada hook otomatis yang melakukan commit/push setelah message dibuat;
3. output menyebut path/ID message dan perubahan state lokal yang terjadi;
4. output mengingatkan bahwa commit/push belum dilakukan dan tetap milik Director;
5. attachment mengikuti path containment dan ukuran/policy yang berlaku;
6. `CONTRACT_CHANGE` melaporkan tambahan mutasi ledger/progress secara eksplisit;
7. test Git menggunakan remote lokal/dummy dan membuktikan tidak ada ref lokal/remote yang berubah.

### WP-MSG-02 — Desain yang sengaja ditunda

Hal berikut tidak diputuskan oleh dokumen ini:

- apakah message akan memperoleh MCP query/control tools;
- bentuk prepare/commit atau approval untuk message;
- audience, sender role, recipient role, dan impersonation rules;
- lifecycle inbox/read/clear serta memo;
- attachment allowlist, retention, dan redaction;
- hubungan `CONTRACT_CHANGE` dengan ledger/progress;
- template message, acknowledgement, delivery receipt, dan failure recovery;
- apakah pembuatan local Git tag tetap diizinkan pada alur lain.

Keputusan tersebut memerlukan sesi desain message bersama Director sebelum implementasi MCP mailbox.

## 5. Area file yang diperkirakan berubah

- sumber `report/SKILL.md` dalam repository dan mekanisme instalasinya;
- sumber `sigma-test/SKILL.md` dan script diagnostic yang dirujuknya;
- test skill integrity/checksum;
- registry/tier/capability reader untuk parity diagnostic;
- test command `send` dan adapter Git boundary;
- dokumentasi operasional report, diagnostic, dan message.

Path final harus dikonfirmasi dari struktur repository pada awal implementasi. Daftar ini bukan izin untuk mengubah konfigurasi global pengguna secara langsung.

## 6. Kriteria penerimaan

| ID | Kriteria |
|---|---|
| AC-RPT-01 | Report tetap read-only dan menghasilkan briefing sesuai format serta batas ukuran yang ditetapkan. |
| AC-RPT-02 | Tidak ada contoh command report yang merujuk operasi usang/tidak tersedia. |
| AC-RPT-03 | Boundary waktu report hanya mencakup invocation dan side effect yang dipicunya. |
| AC-RPT-04 | Drift sumber–instalasi report terdeteksi tanpa perbaikan otomatis. |
| AC-RPT-05 | Report menampilkan branch/worktree status dan metadata commit terakhir sebagai bukti progress Git. |
| AC-RPT-06 | Report membedakan pekerjaan committed, staged, unstaged, dan untracked tanpa menyimpulkan penyelesaian hanya dari Git. |
| AC-RPT-07 | Pemeriksaan Git tidak menjalankan fetch atau mutasi; non-Git repository dan branch tanpa commit dilaporkan `N/A`. |
| AC-TST-01 | Baseline dan parity berjalan pada setiap diagnostic. |
| AC-TST-02 | Seluruh operasi registry aktif memperoleh klasifikasi dan status coverage diagnostic. |
| AC-TST-03 | Representative smoke tidak mengubah state; prasyarat yang hilang dilaporkan `N/A`. |
| AC-TST-04 | Exhaustive read-only conformance tersedia sebagai mode fixture/CI terpisah. |
| AC-TST-05 | Diagnostic pada repository ini tidak menciptakan aktivasi/registrasi Sigma. |
| AC-TST-06 | Output PASS/FAIL/WARN/N/A dan exit code bersifat deterministik. |
| AC-MSG-01 | Pembuatan message tidak menjalankan stage, commit, tag, atau push. |
| AC-MSG-02 | Output message membedakan state lokal yang dibuat dari publikasi Git yang belum dilakukan. |
| AC-MSG-03 | Commit dan push tetap memerlukan tindakan Director pada tahap terpisah. |
| AC-MSG-04 | Desain MCP/message yang belum diputuskan tetap deferred dan tidak diimplementasikan berdasarkan asumsi. |

## 7. Test contract

| Test | Menutup AC | Metode | Hasil yang diwajibkan |
|---|---|---|---|
| TC-RPT-01 Static skill audit | RPT-01, RPT-02, RPT-03, RPT-05, RPT-06, RPT-07 | Lint instruksi, cocokkan contoh operasi dengan registry/help, dan periksa kontrak interpretasi Git. | Tidak ada operasi usang; boundary invocation dan batas inferensi Git eksplisit. |
| TC-RPT-02 Read-only invocation | RPT-01, RPT-07 | Snapshot filesystem, config, log, worktree, index, refs, dan remote configuration sebelum/sesudah report. | Tidak ada mutasi dan tidak ada network/fetch. |
| TC-RPT-03 Source/install drift | RPT-04 | Uji identik, berbeda, dan target tidak ada. | Status akurat; tidak ada sinkronisasi otomatis. |
| TC-RPT-04 Git progress matrix | RPT-05, RPT-06, RPT-07 | Uji fixture clean, staged, unstaged, untracked, kombinasi perubahan, ahead/behind lokal, branch tanpa commit, dan direktori non-Git. | Kategori progress serta commit terakhir akurat; kondisi tanpa bukti dilaporkan `N/A`; tidak ada klaim completion tanpa bukti lifecycle/test. |
| TC-TST-01 Baseline on non-Sigma repo | TST-01, TST-03, TST-05 | Jalankan diagnostic di fixture/repository tanpa activate status. | Informasi atau N/A; tidak ada file aktivasi/registrasi baru. |
| TC-TST-02 Registry parity | TST-01, TST-02 | Bandingkan registry, tiers, MCP manifest/policy, dan actual tools. | Semua operasi diklasifikasikan; drift gagal dengan ID yang jelas. |
| TC-TST-03 Smoke matrix | TST-03, TST-06 | Fixture lifecycle lengkap dan parsial. | PASS pada prasyarat lengkap; N/A pada prasyarat absen; output stabil. |
| TC-TST-04 Exhaustive conformance | TST-02, TST-04 | Jalankan setiap operasi read-only pada fixture yang sesuai. | Coverage report lengkap; tidak ada state mutation. |
| TC-TST-05 Mutation sentinel | TST-03, TST-04, TST-05 | Hash/snapshot state dan Git sebelum/sesudah tiap command. | Perubahan apa pun menggagalkan test dan menunjukkan path/ref terkait. |
| TC-MSG-01 Git call isolation | MSG-01, MSG-03 | Spy/mock adapter Git saat membuat message biasa dan attachment. | Tidak ada stage/commit/tag/push. |
| TC-MSG-02 Local/remote refs | MSG-01, MSG-02 | Repository fixture dengan bare remote; bandingkan refs dan commit graph. | Message lokal tercipta; refs/remote tidak berubah. |
| TC-MSG-03 Contract-change side effects | MSG-02 | Buat fixture `CONTRACT_CHANGE`; periksa message, ledger, progress, dan output. | Seluruh mutasi non-Git dilaporkan; Git tetap tidak berubah. |
| TC-MSG-04 Deferred design guard | MSG-04 | Test/CI menolak tool mailbox MCP yang tidak memiliki decision record disetujui. | Tidak ada implementasi prematur. |
| TC-ALL-01 Regression | Semua | Jalankan suite penuh dan audit worktree. | Seluruh test lulus; hanya file yang disetujui berubah. |

## 8. Urutan eksekusi yang direkomendasikan

1. Validasi ulang path sumber dan target skill tanpa menulis konfigurasi global.
2. Perbarui kontrak `report` dan test read-only-nya.
3. Bangun classifier serta parity layer untuk `sigma-test`.
4. Tambahkan baseline dan representative smoke.
5. Tambahkan exhaustive read-only conformance di fixture/CI.
6. Tambahkan test boundary message–Git tanpa mengubah desain message.
7. Jalankan suite penuh dan audit side effect.
8. Ajukan hasil kepada Director; instalasi global, commit, dan push tetap tahap terpisah.

## 9. Risiko dan stop condition

| Risiko | Mitigasi/stop condition |
|---|---|
| Diagnostic mengubah state karena memakai command yang menulis log. | Hentikan klaim read-only; gunakan jalur inspeksi murni atau klasifikasikan ulang. |
| Menjalankan semua operasi pada setiap sesi membuat diagnostic terlalu lambat. | Pertahankan metadata parity di rutin harian dan exhaustive run di fixture/CI. |
| `N/A` menyembunyikan kegagalan nyata. | `N/A` hanya sah bila prerequisite teridentifikasi dan dicatat; invariant inti tetap FAIL. |
| Sinkronisasi skill menimpa perubahan global pengguna. | Diagnostic hanya melaporkan drift; update target membutuhkan tahap dan approval tersendiri. |
| Commit terakhir atau worktree bersih disalahartikan sebagai pekerjaan selesai. | Git diperlakukan sebagai bukti state kode; kesimpulan progress tetap direkonsiliasi dengan lifecycle, acceptance criteria, dan hasil test. |
| Ahead/behind tidak mencerminkan remote terbaru. | Labeli bahwa hasil berasal dari tracking ref lokal dan jangan menjalankan `git fetch` dalam report. |
| Message dianggap selesai dipublikasikan setelah file lokal dibuat. | Output wajib menyatakan commit/push belum dilakukan. |
| Pembahasan message belum menghasilkan kontrak final. | Jangan menambah tool MCP atau lifecycle baru; pertahankan status deferred. |
| Alur lain membuat local annotated tag. | Jangan menggeneralisasi larangan message ke seluruh Sigma tanpa keputusan terpisah. |

## 10. Di luar ruang lingkup

- Implementasi rinci message/MCP mailbox.
- Commit atau push atas perubahan implementasi.
- Perubahan kebijakan Git di luar jalur pembuatan message.
- Instalasi otomatis skill global.
- Aktivasi role FMN atau role Sigma lain.
- Registrasi repository ini sebagai proyek Sigma.

## 11. Keputusan Director yang diperlukan sebelum implementasi

1. Menyetujui model diagnostic empat lapisan.
2. Menyetujui definisi read-only yang juga melarang penulisan operation log.
3. Menyetujui boundary message–Git: message boleh dibuat setelah otorisasi, tetapi commit/push tetap dilakukan Director.
4. Menyetujui penundaan seluruh keputusan desain rinci message sampai sesi khusus.

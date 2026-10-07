# F04 - Lifecycle APPROVED/LOCKED, doctor, dan pengikatan revisi

Tanggal: 7 Oktober 2026
Status: DRAFT rencana; penyusunan disetujui Director, keputusan O-1 sampai O-14 dan eksekusi belum disetujui.
Baseline: main, HEAD `9f1bea6` (F03); working tree bersih dan main sama dengan origin/main saat pemeriksaan awal.
Sifat dokumen: catatan pengembangan master Sigma, bukan artefak governance proyek terdaftar. Otorisasi sesi ini: "disetujui memulai penyusunan rencana f04". Tidak ada source, build, state proyek, atau aset terpasang yang diubah pada tahap ini.

## 1. Tujuan dan batas fokus

PLAN disetujui sebagai kontrak kerja yang masih dapat direvisi secara terkendali. Persetujuan EXEC menandai pekerjaan tuntas dan mengunci PLAN serta EXEC pasangannya bersama. Runtime harus memeriksa acuan revisi dan bukti perubahan kontrak sebelum menerima persetujuan itu.

**REKOMENDASI:** satu rencana, dua tahap implementasi:
- **F04a:** penanda lifecycle, transisi APPROVED/LOCKED, command approve/tombstone, gate, kompatibilitas, dan migrasi doctor.
- **F04b:** revisi dan hash acuan, checkpoint perubahan, bukti pemberitahuan/persetujuan, pemeriksaan persetujuan pasangan, serta paritas CLI/MCP.
- F04a bukan titik rilis mandiri. F04 baru selesai setelah F04b dan pengujian integrasi lulus; model baru tanpa pemeriksaan revisi belum memenuhi D-10.

Cakupan yang diajukan: engine chain/reconstruct; layanan PLAN/EXEC dan integrasi minimal sertifikasi INTENT; CLI; control store dan tool persetujuan MCP; mailbox hanya untuk pesan kontrak; validator; proyeksi status/orientasi/ROADMAP; template PLAN/EXEC dan aturan/memory/skill master FMN/DEV yang langsung terdampak. Perubahan registry terbatas diajukan terpisah pada O-13.

Di luar fokus: alur amandemen berbasis Git, tag, dan pemindahan Amendment History (F05); rename artefak (F10); notes; perubahan versi paket atau SCHEMA_VERSION; Constitution; Protocol; sinkronisasi ke ~/.sigma, skill terpasang, atau proyek (F09); migrasi proyek nyata; commit/push. Protocol hanya dicatat sebagai tindak lanjut. Tidak menambah kembali tool MCP mailbox yang telah ditarik Director.

## 2. Keputusan Director yang sudah terkunci

Sumber diperiksa pada baseline:
- [Keputusan 28 September](../../Discussion/Evaluation-06102026/2026-09-28_sigma-v2-keputusan-desain-dan-inventaris.md), D-05 sampai D-10, D-12, D-16, D-17; bagian Model Status, Kerja Sama FMN–DEV, dan Kompatibilitas.
- [Diskusi evaluasi](../../Discussion/Evaluation-06102026/diskusi_rencana_perubahan_sigma_v2.md), Pemahaman utama (baris 165–175), Konsolidasi lifecycle (baris 578–590), serta register [F00](F00_indeks-dan-register.md), T-06 sampai T-09 dan T-25.

**TERKUNCI:**
1. PLAN DRAFT menjadi APPROVED melalui persetujuan Director. Persetujuan EXEC langsung membuat pasangan PLAN/EXEC bernomor sama LOCKED. EXEC APPROVED tidak menjadi antrean state persisten tersendiri.
2. PLAN hanya disunting FMN. Sesudah APPROVED, perubahan kontrak diperbolehkan pada FMN Pre-Build Review dan FMN Post-Build Review; di luar keduanya membutuhkan otorisasi eksplisit Director.
3. FMN memberitahukan setiap perubahan kontrak kepada DEV melalui sigma send. DEV boleh mengajukan CONTRACT_CHANGE_REQUEST beserta justifikasi, tetapi tidak menyunting PLAN.
4. Perubahan biasa dikumpulkan untuk persetujuan Director bersama EXEC. Pelonggaran AC/kontrak uji membutuhkan persetujuan Director sebelum DEV melanjutkan pekerjaan terdampak.
5. EXEC menyimpan revisi PLAN; PLAN menyimpan revisi INTENT. EXEC tidak dapat disetujui dengan acuan tertinggal, perubahan kontrak tanpa pemberitahuan, atau pelonggaran tanpa persetujuan.
6. Amandemen INTENT mewajibkan peninjauan pasangan yang masih APPROVED, tanpa mengubah pasangan LOCKED secara retroaktif.
7. Beberapa PLAN APPROVED dapat berjalan paralel; satu PLAN memiliki satu EXEC pasangan bernomor sama. Nomor tidak dipakai ulang.
8. Gate 2 model baru memerlukan PLAN APPROVED. Gate 3 memerlukan semua pasangan yang tidak SUPERSEDED tuntas LOCKED, tanpa DRAFT/APPROVED tersisa. Gate 1, 1.5, dan 3.5 tetap.
9. plan approve/exec approve menggantikan plan lock/exec lock; nama lama menjadi tombstone, bukan alias yang diam-diam menjalankan mutasi.
10. Persetujuan PLAN dan otorisasi mulai coding dapat diberikan sekaligus; persetujuan PLAN saja tidak otomatis berarti otorisasi mulai coding.
11. Chain lama tidak dinomori ulang. Pasangan PLAN LOCKED + EXEC LOCKED tetap LOCKED; PLAN LOCKED + EXEC DRAFT menjadi PLAN APPROVED + EXEC DRAFT ketika migrasi lifecycle diterapkan melalui doctor.

**Konflik/rincian sumber yang belum tertutup:** keputusan 28 September menyebut lifecycle v1 tetap berjalan dan migrasi opsional per chain. Diskusi kemudian menetapkan konversi otomatis pasangan yang pasti pada doctor, tetapi belum menentukan apakah doctor biasa harus memicu perpindahan model untuk seluruh chain. Rencana ini tidak mengartikan kata "otomatis" sebagai izin migrasi paksa: pemicu menjadi O-3, hasil konversi pasti di atas tidak dibuka ulang. PLAN tanpa EXEC, pasangan ambigu, dan bukti baseline lama menjadi O-4/O-9.

## 3. Peta dampak kode yang terverifikasi

Nomor baris berikut adalah pada HEAD 9f1bea6; verifikasi ulang saat implementasi, bukan kontrak nomor baris permanen.

| Lokasi | Perilaku sekarang | Dampak F04 |
|---|---|---|
| src/engine/chain.ts:42–64, 205–228, 253–273 | ArtifactVersion.state berupa string; tracker hanya memvalidasi DRAFT/LOCKED/SUPERSEDED. INTENT mempunyai certified_doc_sha256/effective_amendment, PLAN/EXEC hanya referensi versi | Penanda lifecycle, APPROVED hanya PLAN, revisi/hash acuan, metadata persetujuan dan provenance |
| chain.ts:661–835 | Gate 2 memerlukan PLAN LOCKED; Gate 3 menolak DRAFT dan mencari satu EXEC LOCKED per PLAN LOCKED | Evaluator per model, pemeriksaan pasangan dan seluruh pekerjaan terbuka |
| chain.ts:876–903 | getOperationalGate membuka gate yang INVALID; assertChainCanMutate melewati validasi semantik dalam recovery | Pemeriksaan identitas, acuan, dan persetujuan F04 harus tetap menolak kegagalan meski recovery/override aktif |
| chain.ts:956–1143 | Doctor memperbaiki pointer/gate, menandai referensi salah; dapat menghapus duplicate EXEC DRAFT bila ada LOCKED dengan versi sama. Doctor tidak menyertifikasi ulang INTENT | Preflight migrasi sebelum heuristik deduplikasi; jangan menghilangkan ambiguitas atau menciptakan bukti revisi |
| chain.ts:1420–1503, 1555–1641, 1687–1724 | Lock PLAN dan EXEC terpisah; resolver implisit hanya DRAFT; supersede cascade; next ops memakai lock | Approve PLAN, lock pasangan pada approve EXEC, resolver berdasarkan operasi, supersede APPROVED, hint sesuai model |
| src/services/planLockService.ts:58–85; execLockService.ts:65–92 | Validasi dokumen lalu mutasi satu tracker; daftar transaksi hanya chain JSON | Layanan approve bersama, daftar transaksi lengkap untuk pasangan/ROADMAP/ledger, verifikasi sumber |
| src/services/execDraftService.ts:60–116, 130–161 | Hanya PLAN LOCKED boleh dipilih; satu EXEC non-SUPERSEDED per PLAN | Pilih APPROVED pada model baru, snapshot acuan PLAN, liveness/review per target |
| src/services/planDraftService.ts:86–145; planPromoteService.ts | PLAN mereferensikan versi INTENT; pending baru memperoleh versi saat promote | Acuan revisi pada draft/promote, validasi lagi pada approve; pending belum tersertifikasi |
| intentRatifyService.ts:67–73; intentAmendmentService.ts:56–88 | Ratify/amendment menyertifikasi hash INTENT; amendment masih merender riwayat ke dokumen dan log | Hook revisi/peninjauan F04 saja; workflow Git dan format amandemen tetap F05 |
| src/commands/plan.ts:130–151, 202–325; exec.ts:43–91 | CLI lock memanggil layanan langsung; check struktural; status tidak menampilkan APPROVED. plan update hanya title/focus tracker | Approve/check/status/revise; metadata title/focus dibedakan dari perubahan kontrak |
| src/mcp/control/tools/{prepare,commit}{Plan,Exec}Lock.ts; control/index.ts:40–43, 94–97 | W2 prepare/commit + approval Director lokal; target satu hash dokumen | Tool approve baru, hash seluruh dependensi dan ringkasan delta, tiket lama tidak dialihkan |
| src/engine/controlStore.ts:451–588, 597–677, 734; mcp/control/shared.ts | Lock proyek, before-image journal, recovery, tiket/approval sekali pakai | Reuse transaksi/lease; perlu adapter CLI bersama, bukti revisi/persetujuan bertahan sesudah konsumsi |
| src/commands/control.ts:56–115, 137–157 | show/approve menampilkan effects; approval hanya dari trusted local CLI | Kartu review konkret dan hash paket; jangan menambah approval otomatis melalui MCP |
| src/mcp/contract.ts:60–115 | state_revision hanya identity, activate_status, chain JSON; tidak hash artefak/ledger/mailbox | Tambahkan pemeriksaan hash dependensi pada tiket; jangan mengira state_revision sudah melindungi isi dokumen |
| src/commands/doctor.ts:60–179, 264–378; src/mcp/tools/doctor.ts:22–39 | CLI doctor menulis; MCP hanya diagnosis in-memory/applied:false. --v CLI sekarang hanya reconstruct; --dry-run hanya migrasi mailbox | Jalur migrasi lifecycle terpisah, selector/validasi flag, diagnosis read-only |
| src/engine/reconstruct.ts:353–369, 474–559 | State PLAN/EXEC dipertahankan jika tracker valid dan set file sama. Blind reconstruct dapat menyimpulkan EXEC LOCKED dari satu file pasangan; INTENT tidak disalin wholesale | Jangan menyimpulkan persetujuan EXEC baru dari keberadaan file; pertahankan bukti INTENT/revisi yang valid |
| src/config.ts:109; commands/send.ts; engine/mailbox.ts/mailboxContext.ts | Jenis pesan belum memuat dua jenis kontrak; F03 sudah punya intent/context dan gate/retensi | Jenis/metadata pesan kontrak; validasi referensi revisi dan receipt yang tahan OUTDATED |
| src/utils/docCheck.ts:160–188, 717–744, 992–1088 | Contract Changes free-form; EXEC READY_FOR_LOCK; verdict advisory tidak menentukan izin; requirement/check dan ensure eligible terpisah | Pemeriksaan kesiapan persetujuan bersama; kompatibilitas verdict lama, bukan memberi FMN/AUD veto baru |
| src/utils/roadmap.ts:23–62 | Renderer menampilkan state PLAN apa adanya, tetapi layanan lock tidak merender ROADMAP | Render pada approve/revise/pair lock/migrate; ikut transaksi |
| CLI session/project/report; MCP planStatus/execStatus/artifacts/listPlans/listExecs/checkDocument/orientation/gates/policy | Status/guidance/hint masih berasumsi PLAN LOCKED, sebagian hanya DRAFT/LOCKED | Proyeksi bersama model/state/revisi/blocker; APPROVED tidak boleh menghilang dari status |
| Sigma/templates/{FMN-PLAN,DEV-EXEC}-TEMPLATE.md; rules/{FMN,DEV}-RULE.md; role-memory/{fmn,dev}-memory.json; delapan skill FMN/DEV pada empat target | Header, Contract Changes, handoff, readiness, activation, dan contoh command masih memakai lock | Koreksi master yang terkait lifecycle/checkpoint, mempertahankan Session Isolation dan Writing Style Rules |
| Sigma/rules/AUD-RULE.md | AUD tidak menyetujui runtime; daftar command lama dan referensi kontrak LOCKED masih ada | Catat paritas untuk F01/F09; tidak membuka ulang review AUD dalam F04 |

**TERVERIFIKASI:** penomoran dan lifecycle belum dipisahkan di state saat ini. Chain intent_aligned yang dibuat setelah F02 tetap menjalankan kode lock lama. Karena itu lifecycle tidak boleh ditebak dari versioning_scheme, major version, atau schema dokumen.

## 4. Spesifikasi perilaku yang direkomendasikan

Seluruh rincian implementasi di bagian ini adalah **REKOMENDASI**, bukan keputusan terkunci baru.

### 4.1 Model lifecycle dan command

Tambahkan lifecycle_model: legacy_lock | paired_approval pada chain; field tidak ada dibaca sebagai legacy_lock dengan warning. Chain baru setelah F04 memakai paired_approval, tanpa mengubah versioning_scheme. Nilai asing/rusak ditolak, tidak fallback diam-diam. Reader tidak memigrasikan state.

| Operasi | paired_approval | legacy_lock |
|---|---|---|
| plan approve --v | DRAFT → APPROVED; catat baseline rev 1, hash, sumber INTENT, persetujuan | DRAFT → LOCKED sesuai workflow lama, output menjelaskan model legacy |
| exec new --plan | Target APPROVED yang current dan tidak mempunyai EXEC terbuka | Target LOCKED sesuai workflow lama |
| exec approve --v | EXEC DRAFT + PLAN APPROVED bernomor sama → keduanya LOCKED dalam satu transaksi | EXEC DRAFT → LOCKED; PLAN tetap LOCKED |
| plan lock / exec lock | Tombstone, exit nonzero, tanpa mutasi | Tombstone yang menunjuk approve dengan penjelasan hasil legacy |
| plan supersede | DRAFT/APPROVED/LOCKED → SUPERSEDED dan cascade pasangan; isi/bukti selesai tetap disimpan | Semantik lama tetap |
| plan update --title/--focus | Metadata tampilan saja; bukan jalur sertifikasi revisi atau perubahan AC | Metadata tampilan saja |

PLAN/EXEC dapat tetap menggunakan nama berprefix dan schema dokumen saat ini. Rename bukan efek F04. Timestamp approved_at terpisah dari locked_at; keduanya tetap pada PLAN yang kemudian LOCKED. EXEC cukup approved_at + locked_at, tanpa state APPROVED yang sempat terlihat di disk.

legacy_lock yang belum dimigrasikan tidak diwajibkan memiliki metadata revisi baru untuk melanjutkan alur lama. Output membedakan keterbatasan buktinya; model baru tidak menerima keadaan yang sama sebagai baseline tersertifikasi. Approval yang diperlukan untuk operasi tetap Director, bukan role yang menyiapkan artefak.

Resolver implisit per operasi: initial approve mencari DRAFT; review baseline/revisi wajib target eksplisit; check mencakup DRAFT dan APPROVED dan menolak target implisit ambigu. status menampilkan seluruh kategori tanpa memilih target. active_version tetap pointer tampilan, bukan penentu kebenaran semua pasangan.

### 4.2 Gate dan kesiapan per pasangan

- Gate 2 ringkasan terbuka jika ada kontrak yang eligible menurut modelnya. Target exec new tetap harus memenuhi semua prasyarat sendiri; satu pasangan sehat tidak membenarkan pasangan lain yang stale.
- Gate 3 paired_approval: INTENT RATIFIED, sedikitnya satu pasangan selesai, tidak ada PLAN/EXEC DRAFT atau PLAN APPROVED yang belum dituntaskan, tiap PLAN LOCKED punya tepat satu EXEC LOCKED dengan versi sama/ref benar. SUPERSEDED tidak ikut pekerjaan terbuka.
- Pada pasangan baru, siap disetujui berarti dokumen eligible, INTENT tersertifikasi/current, PLAN current/tersertifikasi, semua revisi biasa tercantum di kartu review, semua notice valid, EXEC telah mengakui revisi terbaru, dan semua otorisasi awal yang diwajibkan tersedia.
- status/check/orientasi menampilkan blocker spesifik dan memisahkan validitas dokumen dari eligibility persetujuan. check tidak menyetujui atau merevisi.
- INVALID recovery dan sigma override tidak menggantikan bukti hash, identitas pasangan, notice, atau persetujuan pelonggaran. Override lifecycle yang sudah ada tetap tercatat; persetujuan pasangan mempunyai guard tersendiri.
- Otorisasi mulai coding tetap eksplisit menurut D-16. F04 tidak menjadikan create EXEC, PLAN APPROVED, atau ack revisi sebagai otorisasi coding.

### 4.3 Identitas revisi, hash, dan baseline

- Nomor artefak tetap vN/vN.x; revisi isi disimpan terpisah sebagai integer positif. Baseline baru rev 1, perubahan tersertifikasi berikutnya rev 2 dan seterusnya. Edit file biasa tidak menaikkan nomor dan terdeteksi sebagai UNCERTIFIED_EDIT.
- PLAN menyimpan pasangan intent_revision_ref + intent_doc_sha256_ref; EXEC menyimpan plan_revision_ref + plan_contract_sha256_ref. Nomor saja tidak cukup karena isi bisa berubah tanpa memperbarui tracker.
- INTENT memakai hash sertifikasi yang sudah ada; ratify/amendment menaikkan revisi melalui layanan, bukan reader/doctor. Migrasi current baseline berprovenance tidak mengarang nomor revisi historis dari jumlah AMD.
- Usulan hash kontrak PLAN: UTF-8, CRLF/LF dinormalisasi; seluruh isi kecuali blok AUD Notes yang dikenali marker. Tidak mengecualikan ringkasan, AC, constraints, atau Contract Changes. Marker hilang/duplikat/rusak ditolak. Receipt append AUD Notes diperiksa append-only; revisi audit bukan alasan mengganti AC diam-diam.
- Tiket approval tetap mengikat hash byte dokumen penuh, termasuk AUD Notes, serta dependensi. Penambahan catatan sesudah prepare memerlukan prepare ulang meski bukan revisi kontrak.
- Simpan snapshot PLAN per revisi pada Sigma/revisions/PLAN-vN.x/rev-NNNN.md dan ledger tervalidasi yang diacu chain. Snapshot append-only; hash dan path diverifikasi. Riwayat akhir tidak dibuang mengikuti kuota mailbox.
- Hash/acuan mesin disimpan pada metadata JSON, bukan disisipkan ke isi PLAN yang sedang di-hash. Kandidat yang direview sudah memuat baris Contract Changes yang hendak disahkan; commit tidak menambahkan perubahan substantif di luar kandidat beku itu.
- Tidak membuat salinan backup INTENT: baseline dan diff berbasis Git serta sertifikasi INTENT penuh adalah F05. F04 hanya memberi acuan revisi/hash dan invalidasi pekerjaan terbuka.
- Pasangan LOCKED lama tanpa baseline baru tetap ditampilkan sebagai bukti legacy dengan keterbatasan yang eksplisit, bukan disertifikasi retroaktif. Edit kontrak pasangan LOCKED yang memiliki baseline terverifikasi diblokir/dilaporkan; doctor tidak menerima hash pengganti otomatis.

### 4.4 Perubahan kontrak, pemberitahuan, dan acuan EXEC

Alur CLI yang diajukan:
1. FMN menyiapkan kandidat melalui plan revise prepare --v. Salinan staging berada dalam Sigma/revisions/staging/; PLAN kanonik belum berubah.
2. FMN menyunting kandidat dan melengkapi alasan, checkpoint, peminta, klasifikasi pelonggaran, serta delta. plan revise check memperlihatkan before/after terhadap baseline tepercaya, termasuk nomor AC/test yang berubah.
3. plan revise commit mencatat rev berikutnya dan snapshot. Checkpoint pre-build/post-build menerima revisi biasa untuk ditinjau Director bersama EXEC. Checkpoint director atau pelonggaran memerlukan tiket/approval Director yang mengikat kandidat sebelum commit. Jangan edit kontrak kanonik dahulu lalu meminta persetujuan belakangan untuk perubahan yang wajib izin awal.
4. Revision commit yang belum diberitahukan berstatus administratif pending_notice pada ledger; PLAN tetap APPROVED. FMN menjalankan sigma send --type CONTRACT_CHANGE dengan revision_id tervalidasi. Jika send gate/migrasi mailbox menghalangi, jelaskan blocker, jangan membypass atau menandai notice sudah terkirim.
5. send mencatat receipt berisi ID pesan, from FMN/to DEV, owning INTENT, PLAN, revisi, hash, waktu, dan digest payload dalam transaksi bersama index/ledger. Pesan GENERAL, LEGACY, salah recipient, salah hash/revisi, atau reuse notice lama tidak memenuhi persyaratan.
6. DEV membaca pesan dan PLAN terbaru, kemudian menjalankan exec acknowledge-plan --v --revision. Layanan memverifikasi acuan/hash/notice; tidak mengakui otomatis hanya karena inbox status READ. Ini bukti pengakuan acuan, bukan bukti pemahaman atau izin coding.
7. exec approve mengumpulkan semua delta ordinary yang belum disetujui dan receipt approval awal. Hasil akhir mengunci pasangan, tidak melakukan auto-ack/auto-rebaseline.

CONTRACT_CHANGE_REQUEST hanya from DEV/to FMN, dengan justifikasi dan target PLAN. Permintaan tidak mengubah kontrak atau memberi persetujuan. Klasifikasi pelonggaran/checkpoint adalah deklarasi role, bukan hasil autentikasi atau analisis semantik otomatis; Director memeriksa bukti/delta. Bila ragu, FMN mengeskalasi dan tidak menandai non-pelonggaran untuk menghindari otorisasi.

READ/OUTDATED/archive atas notice tidak menghapus receipt. Bukti notice diperiksa melalui ID, hash, hubungan ledger, dan file yang dipertahankan F03; status UNREAD/READ/OUTDATED sendiri bukan bukti keselarasan revisi. File hilang, hash berubah, ledger rusak tetap menjadi blocker. Tidak membuka MCP list/read/send mailbox.

### 4.5 Amandemen INTENT dan bukti yang hilang

Ratify/amendment minimal memperbarui revision/hash dan menandai PLAN APPROVED dengan needs_intent_review. EXEC terkait tidak boleh disetujui atau dibuat untuk kontrak stale. FMN meninjau ulang, mencatat acuan INTENT terbaru melalui revisi PLAN (termasuk bila kontraknya tidak berubah), mengirim notice, dan DEV mengakui acuan baru. Pasangan LOCKED tidak diubah/didemote otomatis; laporan dapat menyebut perubahan INTENT setelah penyelesaian tanpa membatalkan riwayat itu.

Doctor biasa maupun MCP doctor tidak menyertifikasi edit atau menaikkan revision. INTENT current hash tidak cocok baseline, baseline tidak ada, atau snapshot PLAN hilang: laporkan keadaan sebenarnya dan tolak persetujuan model baru. Pemulihan baseline yang tidak punya bukti memerlukan tindakan Director tersendiri; bukan efek terselubung migrasi. Detail F05 tetap dicatat sebagai dependensi.

### 4.6 Persetujuan CLI/MCP dan transaksi

- Tambahkan sigma_prepare_plan_approve/sigma_commit_plan_approve serta sigma_prepare_exec_approve/sigma_commit_exec_approve. Role MCP FMN/DEV dan kewajiban trusted local CLI approval dipertahankan.
- Prepare membekukan target, lifecycle_model, chain identity/state_revision, hash INTENT/PLAN/EXEC yang relevan, revisi, ledger/receipt, serta paket delta/otorisasi. Commit membandingkan semua dependensi lagi di dalam lease. Tidak memperluas state_revision ke mailbox seluruh proyek.
- Nama MCP lock lama menjadi tombstone; tiket lama tidak diinterpretasikan sebagai persetujuan baru. Penolakan tidak mengonsumsi ticket/approval. Idempotency dan replay operasi lama yang sudah selesai perlu ditampilkan sebagai hasil historis, bukan eksekusi baru.
- CLI approve menyediakan preview dan mutasi dengan --director-confirm; gunakan engine evaluasi dan transaksi yang sama dengan MCP. CLI langsung tetap jalur tersendiri, tidak mewajibkan Director menyiapkan tiket MCP untuk setiap persetujuan.
- prepare/check kandidat yang membutuhkan otorisasi awal dapat menghasilkan operation ticket melalui CLI dengan identity/hash/arguments yang sama seperti control store. Director menggunakan control show/approve; revise commit mengonsumsi approval untuk kandidat itu saja. Ini bukan approval dari tool MCP atau self-approval role.
- Kartu review menampilkan PLAN/EXEC/revisi sumber, seluruh perubahan kontrak yang dikumpulkan, klasifikasi pelonggaran dan bukti izin, notice/pengakuan, risiko/verdict advisory, blocker, dan efek final. Rendering kartu sebelum tindakan bukan pengganti persetujuan.
- Lease+journal meliputi chain, snapshot/ledger, ROADMAP, serta ticket/approval/idempotency bila relevan. Commit pasangan tidak boleh terlihat hanya mengunci salah satu tracker. Ulang setelah crash mengembalikan sebelum commit atau menyelesaikan commit yang sah, tanpa mengonsumsi approval dua kali.
- CLI send receipt/revision mutation memakai lease proyek yang sama dengan F03/MCP. Recovery memverifikasi before-image/hash/path; perubahan eksternal selama recovery memerlukan pemulihan manual, bukan overwrite tebakan.

## 5. Kompatibilitas dan migrasi

**REKOMENDASI:** sigma doctor --migrate-lifecycle --v vN [--dry-run]; eksekusi memerlukan --director-confirm. Mode tanpa --v memakai chain aktif yang dinyatakan eksplisit pada preview; --all-versions tidak melakukan migrasi lifecycle masal. Tidak digabung dengan reconstruct, migrate-mailbox, repair-workspace, atau recovery biasa. Doctor/MCP biasa hanya mendiagnosis kebutuhan migrasi.

Preflight seluruh chain di bawah lease sebelum perubahan; migrasi berulang idempoten. Pisahkan konversi state dari sertifikasi baseline. Nomor, file artefak, amendments, evidence, timestamp historis, title/focus, dan supersede_reason dipertahankan. Timestamp lock yang dikonversi dipindahkan ke provenance, bukan dipalsukan sebagai persetujuan baru.

| Kondisi sebelum migrasi | Hasil state | Kesiapan model baru |
|---|---|---|
| PLAN LOCKED + satu EXEC LOCKED dengan versi/ref benar | Keduanya tetap LOCKED (TERKUNCI) | Historical legacy; jangan menciptakan hash bukti lama |
| PLAN LOCKED + satu EXEC DRAFT dengan versi/ref benar | PLAN APPROVED, EXEC DRAFT (TERKUNCI) | Perlu baseline yang direview dan acuan revisi; doctor bukan pemberi persetujuan |
| PLAN LOCKED tanpa EXEC non-SUPERSEDED | Usulan APPROVED, bukan mengarang EXEC | Perlu initial baseline review sebelum exec new |
| PLAN DRAFT / pasangan SUPERSEDED | State tetap | Persetujuan berikut memakai model baru; riwayat tidak dihapus |
| EXEC APPROVED di file lama, duplicate/lebih dari satu pasangan, ref silang/hilang, versi tak sama | Tolak seluruh migrasi chain | Diagnosis konflik; jangan memilih pasangan atau menjalankan deduplikasi dahulu |
| Pasangan sudah model baru dan valid | No-op | Jangan menaikkan rev/reset approval |
| INTENT/snapshot tidak terpercaya, file sumber hilang | Tolak persiapan baseline/approval terkait | State conversion tidak menyertifikasi isi yang tak dapat dibuktikan |

Untuk PLAN APPROVED hasil migrasi tanpa hash baseline, plan approve --v dengan jalur review baseline khusus mencatat rev 1 berprovenance imported_baseline setelah persetujuan Director; bukan klaim bahwa isi tersebut sama dengan isi ketika lock lama. INTENT tanpa sertifikasi tetap blocker, menunggu keputusan baseline O-9/F05. Tidak membuat amandemen fiktif untuk lolos.

Reconstruct:
- Pertahankan metadata/sertifikasi/revisi INTENT dan pasangan bila tracker, identitas, dan bukti valid, termasuk ketika set file lain berubah; jangan menghapus bukti hanya karena membuat initial chain baru.
- Pada model baru, keberadaan EXEC tidak membuktikan approval/lock. Bila tracker hilang/rusak dan tidak ada bukti transaksi tepercaya, pulihkan ke DRAFT/approval-unverified dengan diagnosis, bukan LOCKED.
- Marker penomoran F02 tidak menjadi marker lifecycle. State/model yang hilang dan belum dapat dibuktikan dilaporkan unknown; mutasi approval menolak, bukan menebak legacy untuk pasangan yang diduga baru.
- Reader tracker lama tanpa field masih fallback legacy sesuai O-2; disaster recovery tanpa tracker memerlukan perlakuan unknown yang berbeda.
- Tinjau juga heuristic legacy yang menganggap file EXEC berarti LOCKED: rekomendasi hentikan klaim selesai tanpa bukti tepercaya pada kedua model, dengan perubahan kompatibilitas dinyatakan pada O-11.

## 6. Keputusan terbuka dan rekomendasi

Seluruh jawaban Director masih **BELUM DIJAWAB**. Menyetujui penyusunan tidak mengotorisasi pilihan ini atau implementasinya.

| ID | Pertanyaan / pilihan | Rekomendasi dan alasan | Jawaban Director |
|---|---|---|---|
| O-1 | F04a dirilis sendiri, atau dua tahap satu hasil final? | Dua tahap satu hasil; lifecycle tanpa guard revisi belum memenuhi keputusan terkunci | Belum |
| O-2 | Bedakan lifecycle dari numbering melalui field sendiri, atau turunkan dari skema penomoran? Bagaimana approve pada legacy? | lifecycle_model terpisah; unmarked tracker = legacy_lock; chain baru = paired_approval. approve menjalankan semantik model lama dengan output eksplisit agar chain lama tetap operasional setelah tombstone | Belum |
| O-3 | Doctor biasa otomatis berpindah model, atau migrasi eksplisit per chain? | --migrate-lifecycle dengan dry-run/--v dan --director-confirm; konversi pasangan pasti otomatis dalam migrasi. Doctor biasa/MCP diagnosis saja, tanpa migrasi masal | Belum |
| O-4 | PLAN LOCKED tanpa EXEC: pertahankan lock, konversi APPROVED, atau tolak? Pasangan ambigu: sebagian migrasi atau seluruh chain ditolak? | Konversi tanpa EXEC menjadi APPROVED dengan baseline review wajib; ambiguitas menolak seluruh chain sebelum deduplikasi agar bukti tidak hilang | Belum |
| O-5 | Acuan cukup rev integer, atau rev+hash dan snapshot? Apakah AUD Notes mengubah kontrak? | Rev+hash, snapshot PLAN append-only, ledger tervalidasi; hash kontrak mengecualikan AUD Notes dengan validasi append-only. Ticket mengikat file penuh. Tidak membuat backup INTENT | Belum |
| O-6 | Revisi kanonik disertifikasi setelah edit, atau staging+prepare/check/commit? | Staging dan explicit commit sesuai checkpoint. Pelonggaran/perubahan di luar checkpoint harus mendapat approval kandidat sebelum kontrak kanonik berubah; edit langsung menjadi UNCERTIFIED_EDIT | Belum |
| O-7 | Notice cukup teks/ID message, atau metadata revisi+hash dan receipt durable? Otomatis terkirim oleh revise atau sigma send eksplisit? | sigma send eksplisit, typed CONTRACT_CHANGE/REQUEST dan metadata tervalidasi; receipt durable. Pending notice memblokir approval. Tidak bypass send gate dan tidak membuka tool mailbox MCP | Belum |
| O-8 | EXEC otomatis mengikuti revisi PLAN, atau DEV mengakui acuan eksplisit? | exec acknowledge-plan; hash/ref/server checks dan notice valid wajib, status READ saja tidak mengakui revisi. Tidak memberi otorisasi coding | Belum |
| O-9 | Baseline lama diisi doctor otomatis, atau reviewed import/unknown blocker? Seberapa jauh INTENT F04 vs F05? | Reviewed import PLAN rev 1 dengan provenance; INTENT yang punya current certified hash dapat menjadi baseline current, tanpa nomor sejarah buatan. INTENT tanpa sertifikasi tetap unknown/blocker sampai jalur Director/F05. F04 menambah hook revisi ratify/amendment, bukan workflow Git | Belum |
| O-10 | CLI approve cukup pemanggilan command seperti lock lama, atau preview+--director-confirm? Persetujuan awal dicatat teks atau durable approval? | Preview+confirm CLI; MCP tetap prepare/trusted local approval/commit. Otorisasi pelonggaran/outside-checkpoint mengikat kandidat melalui control ticket+approval dan receipt konsumsi durable; jangan menerima teks chat sebagai approval MCP. Persetujuan ordinary dikumpulkan saat approve EXEC | Belum |
| O-11 | INVALID/override boleh melewati guard revisi? Reconstruct boleh menyimpulkan selesai dari file EXEC? | Tidak bypass guard; reconstruct konservatif pada kedua model, pertahankan bukti valid dan jangan menyimpulkan LOCKED dari file saja. Menutup klaim selesai palsu meski mengubah heuristic legacy | Belum |
| O-12 | Rename MCP lock menjadi approve dengan alias, atau tombstone dan tiket baru? | Tool approve canonical, empat tool lock lama tombstone, tiket lama pending ditolak tanpa dikonsumsi. Legacy memakai tool approve dengan effects legacy; replay sukses lama tetap historical | Belum |
| O-13 | Cakupan teks master dan registry: F04 langsung atau seluruhnya F09? | F04 menyelaraskan template PLAN/EXEC, FMN/DEV rules+memory+8 skill, policy dan entry registry hanya operasi terkait approve/revise/ack/kontrak. Pembaruan terbatas registry memerlukan persetujuan eksplisit butir ini; refresh luas/sync tetap F09. AUD/ARC lintas dokumen dicatat F01/F05/F09, Protocol terakhir | Belum |
| O-14 | Verdict READY_FOR_LOCK diganti bagaimana tanpa merusak dokumen schema 3 lama? Build/uji boleh dilakukan pada implementasi? | Template baru READY_FOR_APPROVAL; validator menerima lama/baru dengan tepat satu verdict pada dokumen lama, tanpa veto dari pilihan advisory. Istilah Approval readiness untuk PLAN/EXEC, Lock readiness tetap CLOSE. SCHEMA_VERSION/schema dokumen/paket tidak dinaikkan. Izinkan build+uji pada titik bagian 7; migrasi hanya fixture | Belum |

F04 tidak dapat selesai bila O-9 memilih menunda seluruh baseline INTENT ke F05 tetapi sekaligus mengharuskan semua chain lama langsung eligible: dua tuntutan itu bertentangan. Rekomendasi menerima keadaan blocked/unknown secara jujur untuk chain tanpa bukti, sambil mendukung kelanjutan legacy yang belum dimigrasikan.

## 7. Strategi uji dan kriteria selesai

Tahap rencana tidak menjalankan Sigma CLI, build, atau test. Baseline pengujian sebelumnya: 69 berkas/966 tes lulus pada F03; tambahan terakhir doctor 6 berkas/68 tes lulus. Itu bukan hasil pengujian F04.

### Kontrak pengujian yang diajukan

| ID | Skenario | Hasil wajib |
|---|---|---|
| U-01 | Legacy_offset dan intent_aligned masing-masing dengan lifecycle lama/baru; tracker unmarked/unknown | Nomor tidak berubah; model tidak ditebak dari numbering; unsupported menolak tanpa write |
| U-02 | Approve PLAN DRAFT, create EXEC, approve EXEC | APPROVED antara persetujuan; terakhir kedua tracker LOCKED bersama dengan timestamp/bukti benar |
| U-03 | Dua PLAN/EXEC paralel, pointer aktif menunjuk draft lain, target implisit ambigu | Explicit target benar; tidak silent pick; Gate 2 per-target dan Gate 3 seluruh pekerjaan |
| U-04 | Gate 3 punya DRAFT/APPROVED, missing/double pair, versi/ref mismatch, SUPERSEDED | Blocker tepat; superseded dikecualikan; close tidak mengabaikan pekerjaan terbuka |
| U-05 | Tombstone CLI/MCP, ticket lama, replay commit lama berhasil | Tidak mutasi/konsumsi baru; pesan actionable; replay tidak mengulang effects |
| U-06 | Edit PLAN/INTENT di disk tanpa bump rev, perubahan CRLF/LF, AUD append/edit/delete/marker rusak | Hash sesuai spesifikasi; contract edit/invalid append terdeteksi; ticket penuh stale saat file berubah |
| U-07 | Ordinary pre/post checkpoint, outside-checkpoint, pelonggaran, false/missing classification | Guard data tepat; wajib approval awal untuk deklarasi yang memerlukannya; tidak mengklaim penilaian makna otomatis |
| U-08 | Sender/recipient/owning INTENT/PLAN/rev/hash notice salah; GENERAL/LEGACY; notice reuse | Tidak memenuhi gate; pending_notice tetap; notice benar hanya receipt terkait |
| U-09 | Send blocked oleh UNREAD satu INTENT/GENERAL, memo terpisah, legacy mailbox belum migrasi | Tidak bypass F03; tidak rollback/hilangkan baseline lama; langkah pemulihan jelas |
| U-10 | Notice READ/OUTDATED/archive, file/ledger hilang/diubah, quota sweep | Receipt tidak ikut retensi; hash/bukti aktual tetap diperiksa; status bukan proof |
| U-11 | EXEC ack tertinggal/otomatis, then newest ack; PLAN berubah sesudah prepare atau Director approval | Approve menolak stale; tidak auto-ack; ticket/approval tetap belum consumed pada rejection |
| U-12 | Amendment INTENT dengan PLAN APPROVED dan pasangan LOCKED | Pekerjaan terbuka wajib review/acuan baru; selesai tidak retro-demote. Doctor tidak recertify |
| U-13 | Migrasi known DRAFT/LOCKED pairs, orphan PLAN, ambiguity, repeat, dry-run, no-cert baseline | Hasil state sesuai keputusan; satu-chain preflight; no invented approvals/hash; idempotent |
| U-14 | Reconstruct tracker valid/missing/corrupt, sertifikasi INTENT, altered artifact set, dua model | Pertahankan bukti yang sah; tidak mengarang persetujuan dari file; identitas konflik F02 tidak ditulis |
| U-15 | INVALID recovery dan override aktif dengan stale source/missing notice/missing approval | Guard F04 tetap memblokir; tidak hilang melalui doctor/override |
| U-16 | CLI/MCP approve/check/status/orientation/ROADMAP, legacy/new documents/verdict | Evaluator sama; APPROVED terlihat; readiness/blocker konsisten; advisory tetap advisory |
| U-17 | Crash sebelum/sesudah chain, receipt, ROADMAP, ticket/approval consume; dua writer/lease expired | Rollback/finish sah; tidak half-lock, approval double-consume, orphan snapshot, atau lost update |

### Urutan validasi pada implementasi

1. Setelah source siap: TypeScript --noEmit.
2. Build sebelum tes CLI karena test memakai dist/. Build mengubah dist/ terlacak dan runtime sigma-mcp global via symlink; titik ini harus ikut persetujuan implementasi O-14.
3. Tes bermakna pada engine/gates, multidraft, doc-check schema lama/baru, doctor/reconstruct/override, control W2, mailbox/revision receipts dan amendment.
4. Tambahkan kasus F04 yang belum tercakup; jangan mengganti fixture legacy seluruhnya dengan model baru sehingga kompatibilitas tidak lagi diuji.
5. Setelah targeted lulus, npm test penuh. Build/tes diulang hanya bila source berubah atau ada kegagalan/ketidakpastian.
6. git diff --check serta pemeriksaan scope. Tidak mengubah Constitution/Protocol/SCHEMA_VERSION/sync/registry di luar otorisasi O-13.

Kriteria selesai: keputusan O-1–O-14 tertutup; implementasi memenuhi D-05–D-10 dan kompatibilitas yang disetujui; seluruh U-01–U-17 terbukti; TypeScript/build/tes lulus dengan exit 0; laporan mencatat limit baseline lama, hash projection, dan klasifikasi manusia; F00 diperbarui. Migrasi produksi dan sync bukan kriteria eksekusi pengembangan ini.

## 8. Risiko dan dependensi

- **F02:** numbering dan identity tetap, diuji kedua skema; lifecycle field tidak menggantikannya.
- **F03:** notice membutuhkan mailbox modern. Chain lifecycle dan migrasi mailbox adalah operasi terpisah; F04 tidak diam-diam memindahkan pesan lama/reset UNREAD.
- **F05:** pengikatan INTENT F04 harus tetap kompatibel dengan baseline Git, commit/tag, serta review amendment nanti. F04 tidak mengisi sejarah yang tak diketahui.
- **F01/F09:** salinan AUD/ARC, skill terpasang, registry proyek, dan Protocol bisa tetap memakai kosakata lama sampai distribusi. F04 memuat master FMN/DEV yang terkait saja; daftar keterlacakan perubahan untuk fokus berikut.
- **Binary lama:** field tambahan tanpa kenaikan SCHEMA_VERSION tidak membuat executable lama memahami APPROVED. Model baru harus dijalankan dengan runtime F04; distribusi/versi peringatan lintas host adalah F09/F12, bukan klaim kompatibilitas mundur executable.
- **Hash bukan penilaian semantik:** hash mendeteksi edit, tidak membuktikan klasifikasi pelonggaran atau kebenaran checkpoint/identitas manusia. Rules dan review Director tetap berwenang.
- **Pemulihan saat edit eksternal:** lock proyek mengoordinasikan CLI/MCP, bukan editor. Bandingkan dependensi sesaat sebelum commit; mismatch menolak. Jangan menulis ulang dokumen yang berubah saat recovery.
- **Ledger+receipt lintas file:** gunakan transaksi bersama yang sudah ada, tidak menambah lock terpisah. Bukti tak boleh bergantung hanya pada status mailbox atau teks bebas.
- **Batas LOCKED:** kontrak/result pasangan selesai tidak diedit. Append AUD Notes adalah pengecualian terbatas yang harus disetujui O-5; metadata display title/focus tidak memberi izin mengubah kontrak.

Tindak lanjut Protocol (dicatat, tidak diterapkan): definisi APPROVED/LOCKED dan Gate 2/3; revisi/acuan; dua checkpoint dan otorisasi pelonggaran; receipt notice/pengakuan; D-16; kompatibilitas legacy/migrasi; tombstone approve. Ikut daftar E04, dikerjakan terakhir.

## 9. Urutan implementasi setelah persetujuan

Urutan ini **usulan**, belum perintah eksekusi.

1. Tutup O-1–O-14 dan finalkan kontrak hash, field, command, receipt, serta otorisasi cakupan. Periksa ulang HEAD bila repo berubah.
2. F04a: model resolver/validator + evaluator gate per model; transisi approve/pair lock; layanan shared; draft/promote/supersede dan cardinality.
3. F04a: migrasi opt-in dan reconstruct konservatif, provenance, dry-run/preflight/transaction. Jangan menjalankan proyek nyata.
4. F04b: baseline/revision/hash/snapshot/ledger dan integrasi minimal INTENT; revise staging/check/commit; otorisasi kandidat.
5. F04b: typed messages/receipt melalui sigma send dan ack EXEC; final approval evaluator serta kartu delta.
6. CLI/MCP adapters+tools/tombstones/tickets/dependency hashes; satu lock/journal dan recovery, kemudian status/check/orientasi/ROADMAP.
7. Teks master yang disetujui O-13, kompatibilitas verdict O-14, policy/registry terbatas jika diotorisasi. Pertahankan kewenangan AUD/FMN advisory dan aturan isolasi sesi.
8. TypeScript/build/targeted/full suite sesuai bagian 7; perbaiki kegagalan dan ulang checks yang terdampak.
9. Laporan hasil aktual, keterbatasan, daftar paritas F01/F05/F09/Protocol, serta status F00. Commit/push menunggu instruksi terpisah.

## 10. Hasil tahap penyusunan

Diselesaikan pada sesi ini: pembacaan keputusan sumber, pemetaan kode read-only, dokumen rencana ini, serta pembaruan register F00 dan status commit/push F03. Tidak ada source/test/build/registry/state proyek atau aset terpasang yang diubah. Keputusan teknis dan eksekusi tetap menunggu Director.

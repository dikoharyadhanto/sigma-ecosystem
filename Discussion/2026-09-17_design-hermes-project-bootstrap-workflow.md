# Desain â€” Alur Kerja HERMES: Project Bootstrap

- **Tanggal:** 2026-09-17
- **Status:** Catatan diskusi Director; belum merupakan otorisasi implementasi.
- **Tujuan:** Mendefinisikan alur HERMES saat Director meminta pembuatan project baru yang langsung terdaftar di Sigma. Git dan GitHub sepenuhnya di luar scope HERMES (lihat §1).
- **Keterkaitan:** Melengkapi `2026-09-15_proposal-hermes-sigma-integration-setup-guide.md`, `2026-09-15_proposal-hermes-specialist-session-lifecycle-and-memo-policy.md`, dan `2026-09-12_proposal-hermes-security-boundaries.md`.
- **Catatan revisi (2026-09-17, diskusi lanjutan Director):** Director memutuskan HERMES tidak melakukan aktivitas Git/GitHub apa pun (init, add, commit, branch, remote, push, pull, pembuatan repository), dan tidak menulis file apa pun pada project yang telah terdaftar Sigma kecuali diotorisasi eksplisit — write pada project terdaftar Sigma adalah wewenang AI role terkait atau primitive Sigma sendiri. Director juga menetapkan bahwa HERMES tidak mempunyai memory project-bound atau workflow state persisten: untuk routing ia selalu membaca state Sigma dan artifact secara read-only. §1, §3–§5, §7–§11, §14–§17, §20, dan §22 poin 6 direvisi sesuai keputusan ini.

## 1. Keputusan yang telah ditetapkan

| Aspek | Keputusan Director |
|---|---|
| Root project | Semua project baru berada tepat di bawah `I:\Works\Project`. |
| Batas aktivitas Git/GitHub | HERMES tidak melakukan aktivitas Git apa pun (init, add, commit, branch, remote, push, pull) dan tidak membuat/mengubah repository GitHub. Seluruh aktivitas ini dikerjakan manual oleh Director, di luar alur bootstrap ini. HERMES tidak perlu mengetahui atau memverifikasi status Git suatu project; bila relevan, AI role Sigma (khususnya DEV) yang akan memberi tahu Director bila local Git belum ada — Sigma sendiri hanya mensyaratkan keberadaan local Git, bukan mewajibkan HERMES yang menyiapkannya. |
| Bootstrap exception | Hanya terhadap target yang **belum terdaftar Sigma**, dan hanya setelah decision packet dikonfirmasi eksplisit Director, HERMES boleh menjalankan primitive `sigma project start` untuk meregistrasikan project. Primitive Sigma, bukan HERMES, yang melakukan write registrasi. |
| Batas akses setelah registrasi | Setelah receipt `COMPLETED`, HERMES hanya boleh menjalankan operasi Sigma read-only dan membaca artifact Sigma untuk menentukan rute. HERMES tidak membuat, mengedit, meratify, mengunci, supersede, atau menjalankan operasi write Sigma. |

## 2. Batas semantik

Project yang selesai dibootstrap telah terdaftar dan siap berada dalam lingkungan Sigma. Namun ia **belum** memiliki DIR-INTENT, chain aktif, approval, gate lifecycle, atau mandat professional role.

HERMES boleh melakukan bootstrap operasional yang dibatasi. HERMES tidak boleh, sebagai konsekuensi bootstrap, membuat INTENT, memilih scope produk, menilai risiko, mengunci artefak, membuka gate, atau mengambil keputusan governance. Semua itu menunggu instruksi Director dan jalur role Sigma yang sah.

## 3. Kontrak permintaan

Director memulai dari channel HERMES dengan maksud seperti:

> Buat project `<nama>` dan daftarkan ke Sigma.

HERMES membentuk `ProjectBootstrapRequest` terstruktur, setidaknya memuat:

- `title`: nama yang dapat dibaca manusia;
- `slug`: nama folder yang diberikan eksplisit oleh Director; bila belum diberikan, HERMES wajib menanyakannya dan tidak boleh menurunkannya sendiri;
- `project_id`: usulan HERMES yang berasal dari nama project dan dikonfirmasi Director dalam decision packet; formatnya huruf besar, angka, dan tanda hubung, maksimal 12 karakter;
- `target_root`: hasil deterministik `I:\Works\Project\<slug>`;
- `document_language`: bahasa dokumen Sigma yang Director pilih; HERMES wajib bertanya bila belum diberikan;
- `notion_humanize_gate`: selalu `OFF` saat bootstrap; pengaktifannya adalah keputusan Director terpisah;
- `sigma_bootstrap_version`: versi primitive registrasi Sigma yang dipakai;
- `request_id` untuk idempotensi dan audit.

Request ini tidak memuat field apa pun terkait Git atau GitHub (visibilitas, owner, commit, push) karena seluruh aktivitas tersebut di luar scope HERMES (§1).

HERMES tidak boleh menerima path absolut bebas sebagai target. Ia menurunkan target dari root tetap dan slug yang tervalidasi. Slug yang memuat traversal, separator, drive lain, nama perangkat Windows, atau bentuk ambigu ditolak.

## 4. Preflight wajib

Sebelum perubahan apa pun, HERMES melakukan pemeriksaan read-only dan menghasilkan decision packet untuk Director.

| Pemeriksaan | Syarat lulus |
|---|---|
| Boundary filesystem | Canonical target tetap merupakan anak langsung dari `I:\Works\Project`; tidak ada traversal atau reparse-point/symlink escape. |
| Collision | Target belum ada. HERMES tidak mengadopsi, mengosongkan, atau menimpa folder yang sudah ada dalam alur ini. |
| Sigma | Primitive registrasi Sigma tersedia dan versi yang akan dipakai dapat diidentifikasi. |

Decision packet wajib menampilkan path, project ID, bahasa dokumen, dan status `notion_humanize_gate: OFF` yang akan didaftarkan. Packet ini tidak memuat elemen Git/GitHub apa pun karena aktivitas tersebut sepenuhnya di luar scope HERMES (§1).

Tidak ada folder atau registrasi Sigma sebelum Director memberi konfirmasi eksplisit terhadap packet ini.

## 5. Eksekusi setelah konfirmasi

Setelah packet dikonfirmasi, HERMES melakukan urutan yang idempoten per `request_id`:

1. Membuat folder kosong `I:\Works\Project\<slug>`.
2. Menjalankan `sigma project start` yang telah direvisi menjadi primitive bootstrap non-interaktif, tanpa aktivitas Git/GitHub, tanpa perubahan konfigurasi MCP global, dan tanpa membuat lifecycle chain. Primitive ini — bukan HERMES — yang menulis file registrasi Sigma dan bridge project yang diperlukan, termasuk stub `HERMES.md`.
3. Primitive registrasi menerbitkan dan menyimpan receipt yang menyatakan setiap aksi, output aman, identitas actor, waktu, `request_id`, dan hasil registrasi Sigma; retry dengan `request_id` yang sama me-replay receipt, bukan menciptakan project kedua.

HERMES tidak melakukan langkah apa pun di luar ketiga hal ini. Tidak ada inisialisasi atau pemeriksaan Git, staging, commit, pembuatan repository GitHub, push, maupun perubahan konfigurasi MCP global. HERMES juga tidak menulis file tambahan (README, `.gitignore`, atau lainnya) ke dalam folder tersebut; file apa pun yang diperlukan pada tahap ini adalah tanggung jawab primitive registrasi Sigma, bukan HERMES (§1). Setelah registrasi `COMPLETED`, bootstrap exception berakhir dan HERMES kembali menjadi router read-only (§1).

## 6. Gitignore dan initial commit — tidak berlaku

HERMES tidak membuat `.gitignore`, initial commit, atau file starter apa pun (README atau lainnya). Seluruh aktivitas Git berada di luar scope HERMES, dan write file pada project terdaftar Sigma hanya dilakukan lewat primitive registrasi Sigma atau otorisasi eksplisit Director (§1). Bagian ini dipertahankan sebagai catatan historis bahwa opsi ini sempat dipertimbangkan dan secara eksplisit ditolak Director pada 2026-09-17.

## 7. Failure dan recovery

Rollback otomatis dilarang untuk folder atau hasil registrasi Sigma yang sudah berhasil dibuat. HERMES mengembalikan status deterministik berikut:

| Status | Arti | Tindakan HERMES |
|---|---|---|
| `COMPLETED` | Folder dan registrasi Sigma selesai. | Terbitkan receipt; project siap menerima instruksi governance berikutnya. |
| `NOT_STARTED` | Preflight/konfirmasi gagal sebelum write pertama. | Terbitkan alasan; tidak ada artefak baru. |
| `PARTIAL` | Folder berhasil dibuat, tetapi registrasi Sigma gagal. | Hentikan, catat state aktual dan langkah pemulihan. Jangan menghapus apa pun otomatis. |
| `CONFLICT` | Target folder, identitas, atau request id tidak cocok. | Hentikan tanpa write tambahan; minta keputusan Director. |

Contoh: apabila folder berhasil dibuat tetapi primitive registrasi Sigma gagal, statusnya `PARTIAL`. Receipt menyatakan path lokal, error aman, dan langkah pemulihan. HERMES tidak mencoba primitive alternatif, menghapus folder, atau melakukan write pemulihan tanpa keputusan baru.

## 8. Binding setelah bootstrap

Receipt bootstrap bukan binding otomatis ke project dalam percakapan atau sesi specialist lain. Untuk action lanjutan, HERMES harus melakukan binding eksplisit terhadap `project_id` dan root yang ada di receipt, lalu membaca state Sigma/gate serta artifact yang berlaku melalui operasi read-only.

Ini mencegah `cwd`, nama repository, ingatan percakapan, atau memory HERMES menjadi sumber otoritas. Sigma adalah satu-satunya source of truth lifecycle. Sesudah bootstrap, tindakan wajar berikutnya adalah meminta Director memberi objective/mandat untuk memulai DIR-INTENT; bukan HERMES memulai lifecycle sendiri.

## 9. Hubungan dengan message, memo, dan MCP

Pekerjaan bootstrap tidak membutuhkan message atau memo Sigma. Receipt operasional bukan memo teknis role dan tidak boleh menggantikannya.

Bila nanti HERMES diberi fasilitas komunikasi, interface awal yang lebih aman adalah primitive control-plane sempit untuk handoff/receipt terstruktur, dengan role binding, idempotency, audit, dan policy anti-spam. Jangan mengekspos `send message` atau `write memo` generik sebagai MCP write tanpa kontrak otorisasi terpisah.

## 10. Keputusan bootstrap yang telah ditutup

1. **Slug:** Director selalu memberikan nama folder secara eksplisit. Bila tidak ada, HERMES berhenti dan bertanya; ia tidak menurunkan slug dari title.
2. **Project ID:** HERMES mengusulkan akronim/kode dari nama project dan Director mengonfirmasinya dalam decision packet. Bentuknya huruf besar, angka, dan tanda hubung, maksimal 12 karakter.
3. **Rules HERMES:** Ada global HERMES Rules yang berlaku penuh untuk seluruh sesi, termasuk project Sigma. Primitive bootstrap menginjeksi `HERMES.md` lokal sebagai aturan tambahan khusus project. `HERMES.md` tidak dapat mengecualikan, melemahkan, atau mengganti batas keamanan global, otorisasi eksplisit Director, penanganan secret, atau gaya komunikasi.
4. **Memory dan routing:** HERMES tidak memiliki memory project-bound maupun workflow state persisten. Ia mengetahui workflow dari global rules/skill, membaca `HERMES.md` untuk tambahan aturan lokal, dan menentukan rute dari state/artifact Sigma yang dibaca read-only pada saat binding. Session history bukan dasar routing otomatis.
5. **Primitive registrasi:** Primitive final adalah `sigma project start` yang direvisi untuk bootstrap HERMES: non-interaktif, idempoten per `request_id`, menghasilkan receipt, tanpa Git/GitHub, tanpa perubahan MCP global, dan tanpa lifecycle chain. Ia hanya dapat dipanggil dalam bootstrap exception sebelum target terdaftar Sigma (§1).

## 11. Kriteria penerimaan implementasi masa depan

- Uji filesystem: traversal, symlink/reparse-point escape, collision, dan idempotent retry.
- Uji bahwa bootstrap tidak memanggil binary `git` maupun API GitHub dalam bentuk apa pun, termasuk untuk pemeriksaan status Git.
- Uji bahwa HERMES tidak menulis file apa pun ke folder target selain lewat primitive registrasi Sigma, dan tidak mengubah konfigurasi MCP global.
- Uji bahwa primitive bootstrap membuat stub `HERMES.md`, memakai bahasa dokumen yang dikonfirmasi Director, dan selalu menetapkan `notion_humanize_gate: OFF`.
- Uji bahwa setelah receipt `COMPLETED`, HERMES hanya menggunakan operasi Sigma read-only untuk binding, status, dan pembacaan artifact.
- Uji failure injection pada setiap tahap, dengan receipt `PARTIAL` yang akurat dan tanpa rollback destruktif.
- Uji secret hygiene: tidak ada credential pada prompt, receipt, ataupun log.
- Uji bahwa bootstrap tidak membuat chain/artifact lifecycle atau mengubah gate Sigma.

## 12. Tahap pertama setelah bootstrap â€” ARC intake dan interview loop

Setelah bootstrap `COMPLETED`, gerbang lifecycle pertama selalu menuju ARC untuk pembentukan intent pertama. Ini bukan kewenangan HERMES untuk menebak berdasarkan tampilan folder. HERMES terlebih dahulu melakukan binding eksplisit atas `project_id` dan root pada receipt, lalu memverifikasi state Sigma bahwa belum ada chain atau artifact lifecycle yang berlaku.

Hanya kombinasi bukti berikut yang merutekan pekerjaan menjadi `ARC â†’ intent baru`:

- project receipt bootstrap valid;
- binding root dan `project_id` cocok;
- state Sigma menyatakan belum ada chain aktif maupun intent terdahulu yang harus dievaluasi/amend;
- tidak ada conflict atau partial bootstrap yang belum diselesaikan.

Jika salah satu bukti tidak terpenuhi, HERMES berhenti dan meminta keputusan Director; ia tidak memilih `intent baru`, evaluasi, atau amendment sendiri.

### 12.1 Empat pertanyaan fondasi Director

Sebelum membuka sesi ARC, HERMES menanyakan empat pertanyaan intake berikut sebagai satu paket.

1. **Konteks masalah:** project ini tentang apa; masalah, latar belakang, atau alasan pembuatannya?
2. **Pihak dan dampak:** siapa yang terdampak, serta perubahan apa yang diharapkan bagi mereka?
3. **Objective:** end-state atau tujuan inti apa yang ingin dicapai dari project ini?
4. **Batas awal:** scope, constraint, risiko, deadline, atau hal yang sudah diketahui tidak boleh dilakukan?

HERMES boleh membantu Director menyusun jawaban atau menunjukkan ambiguity, tetapi tidak boleh melengkapi fakta/keputusan yang belum diberikan sebagai fakta Director.

### 12.2 ARC intake envelope

Setelah empat jawaban tersedia, HERMES mengirim envelope minimum ke sesi ARC baru dan bounded:

```text
Project binding
- project_id, canonical root, bootstrap receipt reference
- hasil verifikasi: no-chain / first-intent route

Director foundation answers
- jawaban literal untuk empat pertanyaan intake
- keputusan yang telah eksplisit dibuat
- ambiguity atau conflict yang Director nyatakan belum diputuskan

Verified operational facts
- hasil binding dan state Sigma
- batas capability/runtime yang berlaku

Mandat ARC
- lakukan discovery untuk DIR-INTENT pertama
- jangan membuat artifact atau mengambil keputusan Director sebelum discovery cukup
- kembalikan paket pertanyaan, opsi rute, dan open decision yang masih diperlukan
```

ARC menerima jawaban dan keputusan Director sebagai sumber utama. Envelope ke ARC tidak boleh memuat persetujuan, keraguan, ketidaksetujuan, rekomendasi, atau interpretasi substantif HERMES.

### 12.3 Paket interview, bukan pertanyaan satuan

ARC mengirim pertanyaan kepada Director melalui HERMES dalam beberapa **paket keputusan**, bukan satu pertanyaan setiap giliran. HERMES dapat mengelompokkan paket berdasarkan dependensi dan urgensi, tetapi tidak mengubah substansi pertanyaan ARC.

Setiap item dalam paket setidaknya menyatakan:

- `question_id` atau `decision_id` yang stabil;
- pertanyaan/keputusan yang dibutuhkan;
- alasan mengapa ia material bagi DIR-INTENT;
- opsi, konsekuensi, dan rekomendasi ARC bila tersedia;
- dependensi dengan item lain;
- status: `DIRECTOR_DECISION_REQUIRED`, `CLARIFICATION_REQUIRED`, atau `ASSUMPTION_PROPOSED`.

HERMES menyajikan paket itu kepada Director dalam bahasa yang jelas. HERMES boleh memberi rekomendasi praktis kepada Director, dengan provenance `HERMES recommendation`; rekomendasi itu berhenti pada channel Director dan tidak pernah diteruskan kepada ARC atau role Sigma lain.

### 12.4 Siklus jawaban dan feedback

Jawaban Director dikirim kembali ke ARC sebagai paket yang mempertahankan provenance:

```text
question_id / decision_id
Director answer or decision: ...
Decision status: confirmed / deferred / rejected
Unresolved ambiguity: ... (optional)
```

HERMES mengirim hanya jawaban, keputusan, dan ambiguity yang berasal dari Director, ditambah fakta operasional terverifikasi bila relevan. Ia tidak dapat menyisipkan posisi substantifnya dalam paket ke ARC, termasuk bila dipisahkan labelnya.

ARC kemudian dapat:

1. menyatakan jawaban cukup dan menawarkan rute intent;
2. memberi feedback atas trade-off atau conflict;
3. mengajukan paket pertanyaan lanjutan; atau
4. menyatakan blocker yang memerlukan keputusan Director.

HERMES mengulang loop paket ini sampai ARC menyatakan discovery cukup untuk menyusun DIR-INTENT draft. HERMES tidak memaksakan kelengkapan berdasarkan jumlah paket, dan tidak menyatakan interview selesai tanpa sinyal eksplisit ARC serta keputusan Director yang masih wajib telah tertutup atau ditandai deferred secara sah.

### 12.5 Batas komunikasi dan state

Pada tahap ini, percakapan HERMESâ€“Director dan envelope specialist adalah state operasional, bukan message/memo Sigma formal. Message atau memo baru diperlukan bila ada handoff formal yang telah diberi primitive dan policy tersendiri. HERMES tidak menciptakan memo teknis atas nama ARC, dan tidak menandai pesan formal role sebagai dibaca ketika hanya melakukan discovery.

Output terminal tahap ini adalah salah satu dari: `READY_FOR_ARC_INTENT_DRAFT`, `DIRECTOR_DECISION_PENDING`, atau `BLOCKED`. Hanya ARC dalam mandat yang sah kemudian dapat membuat draft DIR-INTENT; HERMES merutekan dan menyimpan referensi, bukan menulis artifact governance itu sendiri.

### 12.6 Invariant posisi substantif HERMES

HERMES hanya boleh menyampaikan **persetujuan, keraguan, ketidaksetujuan, atau rekomendasi** ketika berkomunikasi langsung dengan Director. Keempat bentuk posisi substantif itu dilarang dalam setiap komunikasi HERMES ke AI role Sigma, termasuk ARC, FMN, DEV, dan AUD.

| Tujuan komunikasi | Konten yang diizinkan bagi HERMES |
|---|---|
| HERMES → Director | Analisis, persetujuan, keraguan, ketidaksetujuan, rekomendasi, fakta, dan decision packet. |
| HERMES → role Sigma | Fakta terverifikasi, project binding, state Sigma, instruksi/keputusan Director dengan provenance, scope/capability envelope, dan output contract. |
| Role Sigma → HERMES → Director | Pertanyaan, alternatif, feedback, evidence, risk, blocker, serta rekomendasi yang jelas sumber role-nya. |
| Role Sigma meminta posisi HERMES | HERMES tidak memberi posisi; ia meneruskan pertanyaan ke Director atau meminta role menggunakan mandat profesionalnya sendiri. |

HERMES tidak boleh menyatakan atau menyiratkan bahwa pendapatnya adalah pendapat Director. Ia juga tidak boleh menilai, mendukung, meragukan, atau menolak kesimpulan role di hadapan role tersebut. Envelopes dan handoff ke role harus membawa `source`/`decision_id` untuk setiap keputusan Director agar provenance dapat diaudit.

## 13. Director-facing projection dan approval checkpoint

### 13.1 Keputusan arah

Projection manusiawi **bukan** gate lifecycle Sigma dan bukan syarat untuk mengaktifkan `notion_humanize_gate`. HERMES tetap wajib mengirimkan projection Director-facing sebelum meminta keputusan ratify atau lock kepada Director, tetapi ketiadaan projection tidak mengubah gate Sigma atau memblokir command lifecycle secara langsung.

Dengan demikian, `notion_humanize_gate` dapat tetap `OFF`. Project tidak dipaksa membuat atau mendorong dokumen ke Notion sebagai prasyarat lifecycle hanya karena HERMES memakai projection untuk komunikasi Director.

### 13.2 Pemilik isi dan kanal pengiriman

Projection harus selalu diturunkan dari canonical artifact, version, dan source hash yang spesifik. Pemilik semantik transformasi adalah role pemilik source — ARC untuk DIR-INTENT — atau generator source-bound yang dijalankan dalam mandat role tersebut. HERMES tidak menulis ulang isi artifact menjadi projection; HERMES bertanggung jawab mengirimkan projection dan decision packet kepada Director.

Untuk DIR-INTENT yang belum ratified, ini memerlukan primitive Director-facing preview yang terpisah dari `sigma intent humanize` saat ini. Preview tersebut harus non-otoritatif, menyatakan `PRE_RATIFICATION`, membawa source version/hash dan fidelity/coverage record, serta tidak menggantikan canonical document. Ia tidak boleh dicampurkan dengan pipeline external-facing/Notion yang hanya bekerja dari source ratified/locked.

### 13.3 Approval checkpoint HERMES

Sebelum meminta approval, HERMES mengirim decision packet yang sekurang-kurangnya memuat:

- Director-facing projection yang sinkron dengan canonical source;
- artifact type, version, dan SHA-256 canonical source;
- verdict AUD, nomor putaran, serta temuan/risk residual berprovenance AUD;
- respons atau revisi ARC yang berprovenance ARC;
- action persis yang diminta: misalnya `intent_ratify` atau `plan_lock`;
- status bahwa tidak ada perubahan source setelah projection/audit final.

Pengiriman tidak dianggap sebagai bukti Director telah membaca. HERMES menunggu keputusan eksplisit Director terhadap packet yang terikat tersebut.

### 13.4 Perekaman dan eksekusi approval

Ketika Director memberikan approval atau penolakan, HERMES hanya merekam dan meneruskan fakta keputusan dengan provenance Director. Ia tidak menginterpretasikan persetujuan umum sebagai otorisasi action tertentu, dan tidak menjalankan ratify/lock berdasarkan inference dari percakapan.

Approval record minimal mengikat:

- `action` yang diotorisasi;
- artifact type/version dan canonical source hash;
- decision packet/audit reference;
- identitas Director, timestamp, dan channel yang terautentikasi;
- status `approved` atau `rejected`.

ARC atau control plane hanya dapat mengeksekusi action apabila record tersebut valid dan source hash masih sama. Bila source berubah setelah projection dikirim atau setelah approval direkam, approval menjadi `STALE`; HERMES harus mengirim packet/projection baru dan meminta keputusan baru.

Untuk `PASS_WITH_RISK`, approval biasa tidak cukup. Packet harus mencantumkan seluruh risk residual, dan Director harus menerima risiko itu secara eksplisit sebelum ratify/lock dapat diajukan. Untuk `REJECT_RECOMMENDED` atau hasil audit final unresolved, HERMES menyampaikan keadaan apa adanya kepada Director dan tidak mengubahnya menjadi `PASS_WITH_RISK`.

### 13.5 Batas HERMES terhadap role

Ke role Sigma, HERMES hanya meneruskan approval record atau penolakan Director yang telah terikat artifact/hash. Ia tidak mengirim penjelasan, endorsement, keberatan, atau rekomendasi HERMES mengenai apakah artifact seharusnya diratify/lock. Projection dan rekomendasi HERMES berhenti pada channel Director.

## 14. Status operasional HERMES dan Slack

### 14.1 Sumber kebenaran dan tampilan channel

Status card HERMES bukan source of truth project dan tidak didukung oleh dispatch ledger/runtime state persisten HERMES. Pada sesi aktif, card hanya merupakan proyeksi sementara dari state Sigma yang dibaca read-only, task envelope yang sedang diterima, dan keputusan Director yang sedang disampaikan. Slack atau channel hanya menampilkan proyeksi itu.

```text
Sigma state + artifact (read-only)  ← source of truth project
             ↓
HERMES session projection
             ↓
Slack status card / channel display
```

Setiap request dari Slack harus melewati verifikasi identitas Director, project binding, state Sigma yang sedang dibaca, dan policy otorisasi. Request itu tidak langsung mengubah state Sigma maupun menciptakan workflow state HERMES persisten.

### 14.2 State yang ditampilkan

| Status | Arti |
|---|---|
| `IDLE` | Tidak ada role session atau approval packet aktif; HERMES standby untuk diskusi. |
| `DISCUSSING` | HERMES sedang berdiskusi dengan Director; belum ada mandat yang dikirim ke role. |
| `DISPATCH_READY` | Packet untuk role telah siap, menunggu instruksi Director untuk memulai. |
| `WORKING` | Ada sesi role Sigma aktif; status menyatakan role, project, task/reference, dan deadline bila ada. |
| `AWAITING_DIRECTOR` | Role atau approval checkpoint menunggu keputusan Director. |
| `PAUSED` | Workflow dihentikan Director; tidak ada dispatch baru. |
| `BLOCKED` | Ada kegagalan, conflict, atau state yang memerlukan pemulihan/keputusan. |

`WORKING` berarti ada role session yang benar-benar sudah dibuka dan memiliki task envelope aktif; HERMES tidak boleh menggunakannya hanya karena sedang menyusun atau mengirim pesan. Kehidupan koneksi bot Slack juga bukan bukti `WORKING`.

### 14.3 Status card minimum

Status card menampilkan informasi operasional minimum yang sesuai dengan visibilitas channel:

```text
HERMES — WORKING
Project: <project label>
Role session: ARC
Task: Intent discovery · question package 2
State: No Director action required
Updated: <timestamp>
```

Jika diperlukan tindakan Director, card beralih menjadi `AWAITING_DIRECTOR` dan menyebut decision/reference yang diperlukan tanpa menampilkan artifact rahasia atau credential. Detail proyek hanya ditampilkan pada channel/DM yang memang diizinkan menerima data tersebut.

### 14.4 Request transisi dari Slack

Tindakan seperti `Start ARC`, `Pause`, atau `Resume` adalah request Director, bukan instruksi langsung ke role atau perubahan state instan. HERMES memverifikasi request terhadap state Sigma saat itu lalu merutekannya bila sah; ia tidak mencatat workflow state persisten. Permission Slack bot untuk memperbarui pesan tidak memberi kewenangan governance atau approval Sigma.

HERMES tidak menggunakan custom status pada profil Slack pribadi Director. Custom profile status memerlukan user-token dan mencampurkan identitas Director dengan identity HERMES. Bila diperlukan, bot HERMES memakai identitas bot terpisah dan satu status card di channel/DM yang disetujui.

## 15. Projection progresif PLAN–EXEC

### 15.1 Keputusan arah

Gunakan satu projection gabungan `PLAN-EXEC-HUMAN` yang tumbuh sepanjang lifecycle, bukan preview FMN-PLAN terpisah dan bukan dokumen yang baru dibuat setelah seluruh PLAN+EXEC terkunci. HERMES dapat mengirim projection ini beberapa kali kepada Director pada milestone yang relevan.

```text
FMN-PLAN draft
→ PLAN-EXEC-HUMAN: plan tersedia, eksekusi belum tersedia
→ audit/revisi plan
→ projection diperbarui
→ FMN-PLAN locked + DEV-EXEC draft
→ projection diperbarui
→ DEV-EXEC berkembang/evidence tersedia
→ projection diperbarui
→ DEV-EXEC locked
→ projection final
```

Projection ini tetap non-otoritatif. FMN-PLAN dan DEV-EXEC canonical tetap satu-satunya source of truth untuk isi masing-masing.

### 15.2 Aturan isi bertahap

FMN-PLAN selalu menjadi source minimum. DEV-EXEC adalah source opsional sampai artifact itu benar-benar ada. Renderer harus merepresentasikan availability secara jujur: ia tidak mengisi data yang belum ada, tidak menyatakan delivery selesai sebelum evidence tersedia, dan tidak menjadikan ketiadaan source sebagai error render.

Bagian yang belum tersedia tidak boleh dibiarkan kosong atau dihilangkan secara ambigu. Projection memakai penanda manusiawi eksplisit, contohnya:

```text
Implementation status
Belum dimulai. Rencana kerja telah disetujui, tetapi belum ada hasil implementasi atau bukti pengujian.

Verification evidence
Belum tersedia. Bagian ini akan diisi setelah pekerjaan implementasi selesai dan bukti pengujian tercatat.
```

### 15.3 Provenance, delivery, dan perubahan

Setiap render mencatat:

- FMN-PLAN version/hash yang menjadi source;
- DEV-EXEC version/hash bila tersedia;
- milestone dan timestamp render;
- coverage/omission record untuk source yang belum tersedia atau belum direpresentasikan;
- status projection: draft, in-progress, atau final (deskriptif, bukan state lifecycle Sigma).

HERMES hanya mengirim ulang kepada Director jika ada milestone atau perubahan source hash yang material. Setiap delivery membawa delta singkat dari render sebelumnya. Pengiriman tidak membuktikan bahwa Director sudah membaca atau menyetujui isi.

Path projection dapat stabil untuk satu pasangan plan/exec karena projection non-otoritatif dapat digenerasi ulang. Traceability berasal dari canonical artifact, hash, dan approval record Sigma; HERMES membawa referensinya hanya selama sesi aktif, bukan dalam dispatch ledger persisten.

### 15.4 Tanggung jawab

HERMES tidak menulis isi projection. Generator source-bound menghasilkan projection dari source canonical:

- FMN dapat memicu render saat baru ada FMN-PLAN atau saat plan direvisi;
- DEV dapat memicu render setelah DEV-EXEC hadir atau evidence berubah;
- HERMES mengirimkan hasil dan delta kepada Director.

Mekanisme `humanize` yang ada saat ini mensyaratkan pasangan plan/exec locked. Untuk mendukung policy ini, primitive tersebut perlu direvisi menjadi renderer gabungan bertahap yang menerima FMN-PLAN draft/locked dan DEV-EXEC sebagai input opsional, tanpa mengubahnya menjadi gate lifecycle atau kewajiban Notion.

## 16. Checkpoint delivery PLAN–EXEC kepada Director

HERMES mengirim `PLAN-EXEC-HUMAN` kepada Director minimal pada tiga checkpoint berikut. Ini adalah policy delivery HERMES; ia tidak mengubah gate lifecycle Sigma.

| Checkpoint | Waktu | Fungsi |
|---|---|---|
| `C1_PLAN_LOCK` | AUD selesai mengaudit FMN-PLAN, sebelum plan lock. | Kirim projection, verdict AUD, respons FMN, dan hash source; minta approval `plan_lock`. |
| `C2_PRE_EXECUTION` | FMN pre-build review selesai, setelah DEV-EXEC tersedia tetapi sebelum implementasi kode. | Kirim projection terbaru sebagai briefing kesiapan eksekusi. Default informasional, bukan approval baru. |
| `C3_EXEC_LOCK` | DEV menyelesaikan implementasi dan FMN post-build review selesai, sebelum DEV-EXEC lock. | Kirim projection final, evidence, post-build verdict FMN, source hash, dan residual risk; minta approval `exec_lock`. |

### 16.1 Disiplin delivery

- HERMES tidak mengirim laporan per test, per commit, atau per perubahan kecil.
- Satu checkpoint menghasilkan satu delivery/decision packet lengkap, bukan rangkaian pesan kecil.
- Update status Slack `WORKING` tidak dihitung sebagai checkpoint laporan.
- Setiap packet menyatakan source hash terbaru, milestone, delta sejak checkpoint sebelumnya, status availability bagian DEV-EXEC, dan provenance AUD/FMN/DEV yang relevan.

### 16.2 Checkpoint tambahan

Checkpoint tambahan hanya boleh dibuat bila ada `DIRECTOR_DECISION_REQUIRED`, `RISK_ACCEPTANCE_REQUIRED`, `BLOCKED`, atau perubahan scope/material. Bila beberapa open question muncul pada state yang sama, HERMES membundelnya dalam satu packet tambahan.

Apabila source berubah setelah packet terkait approval dikirim, packet tersebut menjadi `STALE`. HERMES wajib membuat projection/packet baru sebelum meminta atau meneruskan approval terkait.

## 17. HERMES Work Ledger di luar Sigma — ditunda

HERMES tidak memiliki Work Ledger persisten untuk menyimpan project state, workflow state, atau riwayat kerja Sigma. Sigma tetap satu-satunya source of truth lifecycle dan routing dibangun ulang melalui operasi read-only setiap kali ada binding project.

Director dapat kelak memilih tool daftar kerja independen di luar Sigma untuk ide, reminder, atau pekerjaan non-Sigma. Tool tersebut bukan bagian dari HERMES bootstrap, tidak boleh menyimpan state project Sigma, dan tidak boleh menjadi dasar routing maupun otoritas. Schema, retention, dan aksesnya tetap `OPEN — DEFERRED` bersama state machine/runtime recovery HERMES (§22).

Apabila tool daftar kerja independen tersebut kelak dibuat, ia tidak boleh menyimpan secret, credential, isi artifact sensitif, atau approval Sigma sebagai pengganti record otoritatif. Retensi, backup, akses channel, dan penghapusan item memerlukan policy HERMES terpisah, bukan lifecycle Sigma.

## 18. Director-Controlled Parallelism

### 18.1 Prinsip

Sigma dan HERMES boleh menjalankan beberapa FMN-PLAN/DEV-EXEC dari version atau workstream yang independen secara paralel. Ini bukan larangan sistem dan tidak dibatasi oleh preferensi kerja sequential Director.

Namun, HERMES tidak membuka paralelisme hanya karena ia mendeteksi kapasitas kosong. Setiap workstream paralel memerlukan instruksi eksplisit Director atau autonomy envelope yang secara jelas mengizinkan workstream tersebut.

```text
DIRECTOR_CONTROLLED_PARALLELISM
```

### 18.2 Otorisasi dan dispatch

Contoh otorisasi Director:

```text
Lanjutkan DEV-EXEC v3.2 yang sedang berjalan.
Sambil menunggu, buka FMN-PLAN v3.3.
Keduanya independen; v3.3 tidak membutuhkan output v3.2.
```

HERMES merekam workstream/version yang diizinkan, alasan atau independensi yang dinyatakan, batas waktu/kondisi berhenti bila ada, serta binding/worktree yang berlaku. HERMES kemudian merutekan FMN/DEV hanya untuk mandat yang disetujui tersebut.

### 18.3 Workstream lama dan isolasi

DEV-EXEC yang memerlukan proses panjang dapat tetap berada pada status `RUNNING` atau `LONG_RUNNING` tanpa dianggap gagal atau dibatalkan. Workstream independen yang baru dapat dibuka setelah otorisasi Director.

Untuk paralelisme DEV, HERMES harus memastikan:

- tidak ada dependency artifact/output antara workstream;
- tidak ada shared source area yang berisiko konflik tanpa worktree/branch terpisah;
- audit, projection, source hash, approval, dan evidence dipisahkan per version/workstream;
- kegagalan atau timeout satu workstream tidak otomatis membatalkan workstream independen lain.

### 18.4 Routing dan decision queue

Pada setiap `C4_POST_EXEC_ROUTING`, HERMES membantu Director memilih salah satu:

```text
1. menunggu workstream aktif selesai;
2. menjalankan workstream berikutnya paralel sebagai workstream independen; atau
3. memarkir workstream berikutnya.
```

Open question dari beberapa workstream masuk decision queue yang dibundel. HERMES menjaga reference plan/version/source setiap item; approval tetap terikat dan dinilai per artifact/hash walaupun beberapa item dikirim dalam satu packet.

## 19. Remote Director Approval Bridge

### 19.1 Keputusan desain

Approval Director melalui Slack dirancang sebagai *approval bridge* terpisah, bukan pembacaan pesan bebas oleh Sigma. Bridge ini belum merupakan kemampuan Sigma yang ada dan tidak diimplementasikan oleh keputusan ini.

```text
Sigma membuat decision packet
→ HERMES mengirim packet Slack terstruktur
→ Director memilih APPROVE / REJECT / ACCEPT_RISK secara eksplisit
→ bridge memverifikasi identitas dan menulis approval record terikat
→ Sigma control memverifikasi record sebelum mutasi lifecycle
```

Pesan Slack biasa, emoji, atau kalimat natural tidak dapat langsung menjadi approval lifecycle.

### 19.2 Invarian keamanan minimum

Setiap approval record harus terikat setidaknya pada:

- identitas Slack Director dan workspace/channel binding yang diizinkan;
- action spesifik, artifact/version, dan source hash saat packet dibuat;
- nonce sekali pakai, waktu kedaluwarsa, timestamp, dan status revoke/reject;
- provenance packet dan signature/integrity record yang dapat diverifikasi Sigma;
- acceptance risiko eksplisit dan terpisah untuk `PASS_WITH_RISK`.

Sigma hanya melakukan action bila record masih valid dan source hash tetap sama. Perubahan source menjadikan approval `STALE`; HERMES membuat packet baru. Bridge tidak boleh mengonversi diam, timeout, atau `REJECT` menjadi `PASS_WITH_RISK`.

### 19.3 Cakupan awal dan batas

Jika bridge kelak dibangun, cakupan awal yang direkomendasikan hanya `intent_ratify`, `plan_lock`, dan `exec_lock`. Action destruktif, pengelolaan credential, publikasi GitHub, supersede massal, dan perubahan policy sistem tetap memerlukan jalur yang lebih kuat/terpisah.

## 20. Batas Komunikasi HERMES pada Fase Awal

Pada pengembangan awal, HERMES tidak memiliki atau menggunakan Sigma message maupun Sigma memo. Fasilitas tersebut tetap milik role Sigma yang sudah ada sesuai lifecycle mereka.

HERMES bekerja melalui task envelope ke role, pembacaan state/artifact Sigma secara read-only, dan channel Director. Penambahan Sigma message atau memo untuk HERMES hanya dapat dipertimbangkan kemudian sebagai keputusan desain baru, setelah kebutuhan nyata dan dampaknya terhadap boundary governance dievaluasi.

## 21. Planned Stages sebagai Horizon Rencana Informal

`Planned Stages` pada roadmap adalah section manual untuk memberi gambaran awal urutan fokus dan perkiraan jumlah stage. Bentuk minimum setiap entri hanya:

```text
stage | title | focus
```

Section ini bukan kontrak lifecycle, bukan source of truth status aktual, bukan dependency map, dan tidak menciptakan kewajiban update, audit, atau stale state. Ia boleh masih mencerminkan rencana awal dan berbeda dari realisasi.

`Stage Overview` otomatis tetap menjadi catatan status/realisasi yang operasional. `Planned Stages` lazimnya dibuat saat roadmap awal berdasarkan intent, lalu tetap tidak berubah. Pembaruannya umumnya relevan setelah amendment yang turut mengubah roadmap atau bila Director secara eksplisit memerintahkan FMN memperbaruinya. HERMES boleh membawanya sebagai konteks penjelasan kepada Director, tetapi tidak boleh memakai section itu sendiri untuk melakukan routing atau menarik kesimpulan dependency.

## 22. Open Questions Ditunda

Pada 2026-09-17, Director memutuskan untuk menghentikan sementara pembahasan enam area berikut. Status seluruh item adalah `OPEN — DEFERRED`: tidak menjadi pekerjaan implementasi, tidak memicu dispatch, dan tidak boleh diselesaikan melalui asumsi HERMES.

1. ~~Role Session Adapter trust boundary~~ — **sebagian besar terjawab 2026-09-17** (diskusi lanjutan, termasuk uji langsung memanggil Codex/Claude/OpenCode). Kesimpulan: sandbox, capability allowlist, dan logging **tidak perlu dibangun sebagai infrastruktur baru** — sudah tercakup oleh rule file role (`Sigma/rules/{ROLE}-RULE.md`) dan paket aktivasi skill (`setup/targets/{platform}/{role}.md`), yang begitu dimuat (mis. via `/dev`) sudah membawa sendiri logika kapan berhenti, kapan minta otorisasi Director (dengan bahasa yang didefinisikan presisi), batas command per authority class, dan kewajiban evidence/dokumentasi — independen dari setting teknis adapter (terbukti: `DEV-RULE.md` mewajibkan DEV mengutip ulang kata Director sebelum menulis file apa pun, terlepas dari flag `approval` CLI yang dipakai). HERMES cukup menjalankan satu perintah aktivasi; disiplinnya sudah melekat di skill yang termuat.
   Sisa yang benar-benar masih terbuka, jauh lebih sempit dari cakupan awal: (a) integritas file rule/skill — memastikan yang termuat ke sesi memang versi asli, belum ada mekanismenya; (b) **cakupan skill lintas adapter belum merata** — sudah ada untuk Claude Code, Codex, Antigravity, Reasonix, tapi **belum ada untuk OpenCode Zen** — relevan langsung karena AUD di `2026-09-17_hermes-model-routing-config.yaml` default ke OpenCode, sehingga sampai skill itu dibuat, AUD via OpenCode belum otomatis mendapat disiplin AUD-RULE.md seperti yang didapat DEV via Claude Code. Identitas session, worktree enforcement teknis, dan pencabutan sesi paksa tetap belum dijawab (level infrastruktur, bukan perilaku), dinilai rendah urgensi selama Director menjalankan sesi secara langsung.
   **Simpulan penutup (Director, 2026-09-17):** sisi AI role sudah pasti — DEV-RULE.md/AUD-RULE.md mewajibkan Escalation Path eksplisit (kapan wajib lapor, format laporan) begitu sesuatu tidak sesuai/tidak mulus. Satu-satunya variabel yang tersisa bukan lagi perilaku role, melainkan **apakah laporan/eskalasi itu benar-benar sampai ke Director lewat HERMES** — terutama saat sesi dijalankan tanpa Director menonton langsung (crash sebelum sempat lapor, output tidak tertangkap, gagal relay ke channel). Ini titik temu poin 1 dengan poin 4 (Recovery dan kegagalan) — keduanya bermuara ke satu pertanyaan: keandalan jalur tangkap-dan-teruskan HERMES, bukan lagi soal kelengkapan aturan role. Tetap `DEFERRED` sampai poin 4 dibuka.
2. **Credential dan data policy provider** — klasifikasi data serta provider/tier yang diizinkan untuk data publik, internal, sensitif, secret, dan PII.
3. **State machine runtime HERMES** — state kanonis, transisi legal, dan otoritas perubahan state untuk `IDLE` sampai kondisi recovery/blocked.
4. **Recovery dan kegagalan** — prosedur untuk restart host, event channel duplikat, adapter crash, proses yang menggantung, dan output parsial.
5. **Budget dan limit policy** — budget, durasi, token/biaya, retry, tool call, circuit breaker, dan kondisi HERMES wajib kembali meminta keputusan Director.
6. ~~Detail bootstrap GitHub~~ — **diputuskan 2026-09-17, tidak lagi berupa open question**: HERMES tidak melakukan aktivitas Git/GitHub apa pun (§1). Policy nama repository, branch, license, commit, dan push adalah tindakan manual Director, sepenuhnya di luar scope HERMES.

Pembahasan hanya dapat dibuka kembali oleh instruksi Director. Saat dibuka kembali, HERMES harus memperlakukan daftar ini sebagai agenda diskusi, bukan sebagai mandat implementasi yang sudah disetujui.

# F18 - Konsistensi Protocol, Constitution, README, dan berkas Sigma lain

Tanggal: 15 Oktober 2026
Status: DIIMPLEMENTASIKAN pada master 15 Oktober 2026 (belum di-commit). O-1 sampai O-12 dan teks lampiran A disetujui Director sesuai rekomendasi; amandemen 003-005 diratifikasi atas deklarasi eksplisit Director. Hasil dan batas pada bagian 9. Distribusi ke `~/.sigma`, skill terpasang, dan proyek tetap F09.
Urutan: fokus "finalisasi Protocol/keputusan review Constitution" pada urutan yang diterima Director (F17 → F10 → F12 → finalisasi Protocol/Constitution → F09).
Basis pemeriksaan: repositori master, branch `main`, HEAD d045e70 (F12 ter-commit), 15 Oktober 2026.

## 1. Tujuan dan batas

Tujuan (arahan Director, 15 Oktober 2026): menyelaraskan Protocol, README, Constitution, dan berkas Sigma lain dengan perilaku Sigma v2 yang sudah diimplementasikan (F02 sampai F17), sehingga tidak ada dokumen yang menjelaskan model lama.

Otorisasi Director yang tercatat:

1. Mengubah dan mengamandemen Constitution secara eksplisit, dengan review AUD pada [artifact_sigma_review_director.md](artifact_sigma_review_director.md) sebagai bahan pertimbangan (bukan keputusan).
2. Penyuntingan README memakai skill `/humanize` level BALANCE.

Di luar batas: sinkronisasi ke `~/.sigma`, skill terpasang, dan proyek nyata (F09); perubahan `SCHEMA_VERSION`; perubahan perilaku CLI di luar teks bantuan (O-8); review isi template CLOSE secara mendalam (O-10).

Catatan jujur tentang otorisasi: pernyataan Director memenuhi syarat 1 Article VIII (deklarasi eksplisit). Syarat 2 sampai 4 (rationale, analisis kontradiksi, dampak hilir) disusun pada lampiran A dan memerlukan persetujuan teksnya sebelum Constitution disentuh.

## 2. Ringkasan temuan

| Dokumen | Keadaan | Label |
|---|---|---|
| `SIGMA_PROTOCOL.md` | Tertinggal jauh; v0.11 (18 September). Menjelaskan model PLAN 10 bagian, EXEC 18 bagian, tier Sovereign/Operationalization, gate PLAN LOCKED, `plan lock`/`exec lock`, `roadmap activate`. Tidak menyebut F03, F06, F08, F12, F13, F17. Nomor bagian melompat (5.4→5.6, 7→13, 17→19) | TERVERIFIKASI |
| `SIGMA_CONSTITUTION.md` | Lima prioritas review AUD terbukti pada teks (bagian 3); tidak ada rule/skill/memory yang mengutip frasa yang akan diubah | TERVERIFIKASI |
| `README.md` | Sebagian sudah mutakhir (F04, F05, F06, F08, F12). Sisa drift pada bagian 4 | TERVERIFIKASI |
| Registry | 11 operasi terdeteksi CLI belum terdaftar, 1 entri tidak lagi terdeteksi (`intent_baseline`); 59 baris memuat nama berprefix lama | TERVERIFIKASI (`refresh-registries:dry`) |
| Skill/rule/memory master | Rules dan memory sudah selaras (E01-E04, F11). Skill FMN/DEV/ARC/REPORT pada lima target masih memuat nama berprefix lama (DEV 12, FMN 8-10, REPORT 5, ARC dan HUMANIZE 4 baris per berkas) | TERVERIFIKASI (grep) |
| Salinan terpasang (`~/.claude/commands`) | Masih memuat `cso.md`, `checkpoint.md`, dan `humanize.md` dengan dua rujukan Notion; master bersih. Wilayah F09 | TERVERIFIKASI |

## 3. Constitution

### 3.1 Evaluasi review AUD (satu per satu)

Review AUD berasal dari ChatGPT dan belum direview Director (kata berkas itu sendiri). Setiap butir dinilai terhadap teks saat ini; rekomendasi di bawah adalah penilaian saya, bukan hasil review AUD yang disalin.

| # | Butir AUD | Verifikasi pada teks | Rekomendasi | Amandemen |
|---|---|---|---|---|
| 1a | "project-level instructions" tidak terdefinisi; Article III bisa bentrok dengan IV | Benar: Art. III baris 49 memakai istilah itu; Art. IV menempatkan RULES di bawah INTENT | TERIMA: definisikan sebagai instruksi ad hoc yang tidak tercatat di INTENT/PLAN | 003 |
| 1b | `DIR-INTENT` vs `DIR-DI` | Benar: Art. IV baris 60 dan 73 | TERIMA: satu istilah, `INTENT` (selaras F10) | 003 |
| 2 | Hierarki mencampur dokumen, state, dan pelaku; "next applicable tier" tidak terdefinisi | Benar: Art. IV mencantumkan `DEV (execution)`; Art. X baris 167 memakai frasa tanpa aturan | TERIMA dengan perubahan: pisahkan otoritas normatif dari catatan eksekusi; fakta eksekusi yang hilang tidak direkonstruksi dari PLAN | 004 |
| 3 | "remove the Director from the decision or approval flow" terlalu luas; fallback Director pada Art. X tidak dibatasi | Benar: Art. II baris 27, Art. X baris 167 | TERIMA: bedakan otoritas tertinggi dari kewajiban hadir pada setiap keputusan; fallback Director tunduk pada instrumen Art. II | 004 |
| 4 | SSOT "not re-state it" terlalu absolut; "concern" tanpa granularitas | Benar: Art. V baris 83. Templat PLAN sendiri memuat ulang acuan INTENT | TERIMA: larang redefinisi normatif independen, izinkan kutipan/ringkasan berprovenance | 004 |
| 5a | Role tetap per session = mekanisme, bukan tujuan | Sebagian benar: kalimatnya memang mekanisme. TIDAK diterima sebagai alasan melonggarkan (lihat 3.2) | TOLAK pelonggaran; TERIMA pendefinisian "session" | 003 |
| 5b | Lifecycle hanya dua klasifikasi | Teks Art. IX menyebut dua klasifikasi "fundamental"; kebijakan retensi sudah didelegasikan ke Protocol | TIDAK PERLU diubah | - |
| 5c | Markdown vs runtime state (Art. VII) | Tujuan konstitusional tetap terpenuhi; selaras F04/F05 | TIDAK PERLU diubah | - |
| R-A | TEA didefinisikan dua kali (Art. II dan VIII) | Benar. Catatan: bidang wajib deklarasi (artikel, cakupan, durasi, bukan-preseden) hanya ada di Art. II; harus dipindah ke VIII, bukan hanya dihapus dari II | TERIMA | 005 |
| R-B | Art. VI dan IX tumpang tindih | Benar sebagian; Art. VI punya norma khusus (hasil kognitif tidak otomatis menjadi otoritas) | TERIMA: persempit VI | 005 |
| K-1 | Kalimat retoris ("defined by discipline, not size"; "answers to nothing else"; "not a document storage system") | Kalimat-kalimat ini berasal dari Amendment 001 dan 002 yang diratifikasi Director sendiri (14 Juli 2026) | TIDAK DIUBAH kecuali Director meminta; tidak ada cacat fungsional, hanya preferensi gaya | - |
| K-2 | "repeatedly" tanpa ambang | Benar: Art. VIII baris 145 | TERIMA: ambang "lebih dari sekali untuk skenario yang sama" | 005 |
| K-3 | "aged"/"stale" tanpa pembeda | Benar tetapi pemicunya didelegasikan ke Protocol (Art. IX) | TIDAK PERLU diubah; Protocol yang mendefinisikan | - |

### 3.2 Alasan menolak pelonggaran "session" (butir 5a)

AUD menulis bahwa transisi role terenkripsi dengan reset state akan menjaga isolasi tanpa session baru. Pada sistem yang dioperasikan AI, konteks percakapan tidak dapat direset di dalam session yang sama; role baru akan membawa penalaran role lama. Ini batasan teknis yang dapat diperiksa hari ini, bukan preferensi. Karena itu "session" adalah primitif isolasi, bukan sekadar mekanisme implementasi. Yang valid dari butir ini adalah ambiguitasnya: "session" dan "role diaktifkan" belum didefinisikan. Label: **opini teknis yang dapat dibantah** bila runtime masa depan menyediakan reset konteks yang dapat diverifikasi; pada saat itu amandemen baru dapat diajukan.

### 3.3 Paket amandemen yang diusulkan

Tiga amandemen (teks lengkap pada lampiran A), agar tiap tema memiliki rationale, analisis kontradiksi, dan daftar dokumen hilir sendiri sesuai Article VIII:

| Amandemen | Tema | Artikel |
|---|---|---|
| 003 | Terminologi dan definisi: `INTENT`, instruksi ad hoc, session | III, IV |
| 004 | Semantik otoritas: normatif vs catatan eksekusi, alur keputusan Director, SSOT, fallback | II, IV, V, X |
| 005 | Pengurangan duplikasi dan ambang: TEA, Art. VI, "repeatedly" | II, VI, VIII |

Perubahan pada Art. II dan IV masuk daftar yang menurut Art. VIII memerlukan pengakuan Director atas konsekuensi sistemik. Bagian 5 (O-5) meminta pengakuan itu secara eksplisit.

Dokumen hilir yang wajib diperbarui sebelum amandemen dianggap diratifikasi penuh: `SIGMA_PROTOCOL.md` (pasti), README (bagian Actors/Gates), `Sigma/SIGMA-REGISTRY.json` bila memuat deskripsi hierarki. Rules, role-memory, dan skill tidak mengutip frasa yang diubah (TERVERIFIKASI: grep tanpa hasil di luar Constitution).

## 4. Protocol, README, dan berkas lain

### 4.1 Protocol: temuan per bagian

Pendekatan: tulis ulang menjadi v1.0 (O-1). Prinsip: Protocol tidak menyalin jumlah atau nomor bagian template; ia merujuk template sebagai sumber (aturan Director: rules tidak menyebut nomor section). Daftar di bawah adalah temuan, bukan teks baru.

| Bagian Protocol | Drift | Sumber kebenaran |
|---|---|---|
| Header, 1, 19, footer | Versi v0.3 pada header, v0.11 pada footer; residu "heavier process"/promotion yang sudah dinyatakan tidak relevan oleh Director (review ARC butir 4); riwayat v0.2-v0.11 berisi rujukan PLAN-EVAL "bukan jalur live" | Instruksi Director; CHANGELOG |
| 3 Lifecycle | "FMN-PLAN must be LOCKED before DEV-EXEC" | F04 (APPROVED/LOCKED berpasangan) |
| 4.0, 4.1-4.4 | Tabel role memuat "6 section", "Sections 1-12", "Section 13/14"; AUD "Intent Core sovereign"; tidak menyebut workspace `dev/` | E01-E04, F13 |
| 5.1, 5.1.1 | Tier Sovereign/Operationalization, `amendment --change "<free text>"`, "Versioning Tier 1/2" | F05 (tier dihapus, amandemen dari commit Git), E01 |
| 5.2, 5.3 | Tabel 10 dan 18 bagian | Template PLAN schema 3, EXEC schema 4 (E02, E03, F17) |
| 5.4 sampai 5.8 | Nomor 5.5 hilang; label manusia memakai nama berprefix; proyeksi HUMAN | F10, F14 |
| 7 Gates | Gate 2 "LOCKED", paragraf FIFO/`plan lock`, rujukan PLAN-IMPL historis, nomor bagian melompat ke 13 | F04, F03 |
| 13 Folder | Tidak menyebut `Sigma/revisions/`, `Sigma/messages/<ROLE>/<KONTEKS>`, `Sigma/memo/`, `dev/`, `CHANGE-RECORD.md`, `Sigma/logs/f08.json` | F03, F04, F13, F17, F08 |
| 14 Audit | "Intent Core sovereign", tabel Sovereign vs Auditable | E04 |
| 15 AUD | "tidak ada perintah CLI", rujukan "Section 12", "Section 7" | F08 (`audit`, `decisions`) |
| 16 CLI | Tabel domain tanpa `notes`, `memo`, `dev`, `audit`, `decisions`, `control`, `report`; memuat `roadmap activate` yang sudah dihapus | CLI saat ini (`--help`) |
| 16A | `plan lock`, `exec lock` pada kelas Approval; footnote `intent amendment`; tidak menyebut `control` | F04, F05, sigma-control |
| 16B | Artefak "human-facing" | F14 (D-13) |
| 16D | Daftar status lama `BUILDING/TESTING/COMPLETED` | F14, chain saat ini |
| 16E, 16F | Mailbox/memo global; tidak menyebut konteks per INTENT, `--related-artifact`, CONTRACT_CHANGE | F03, F04 |
| 17 | Tidak menyebut baseline dan tag Git | F05 |
| Tidak ada | Penomoran chain; versi/stempel; direktori revisi; changelog produk; opencode; `sigma notes` | F02, F12, F04, F17, F16, F06 |

### 4.2 README: temuan (di luar yang sudah mutakhir)

| Temuan | Detail | Label |
|---|---|---|
| "lightweight" | Baris 3 dan 424 ("lightweight governance ecosystem", "lightweight protocol") bertentangan dengan Amendment 002 yang menyatakan karakterisasi itu sudah tidak akurat. Deskripsi yang sama ada pada `package.json` dan banner CLI | TERVERIFIKASI |
| ROADMAP "optional" | Baris 12 dan 102 menyebut ROADMAP opsional; Gate 1.5 dan `plan new` mewajibkannya | TERVERIFIKASI |
| Gate | Tabel Gate tanpa Gate 3.5; Gate 3 "DEV-EXEC LOCKED" tidak lengkap | TERVERIFIKASI |
| Nama artefak | 32 kemunculan `DIR-INTENT`, `FMN-PLAN`, `DEV-EXEC`, `DIR-CLOSE` sebagai kode artefak, padahal artefak baru bernama `INTENT-`, `PLAN-`, `EXEC-`, `CLOSE-` (F10) | TERVERIFIKASI |
| Perintah belum ada pada tabel | `plan revise`, `exec acknowledge-plan`, `dev create-workspace/status`, `control show/approve/reject`, `scan`, `intent clone`, `plan clone` (hanya di bagian akhir), `doctor --migrate-mailbox/--migrate-lifecycle/--repair-workspace`, `inbox`/`send` dengan konteks per INTENT | TERVERIFIKASI (`--help`) |
| Baris usang | `plan supersede` tidak menyebut APPROVED; `send --from --to --message` tidak menyebut `--related-artifact` | TERVERIFIKASI (perlu dicek ulang sintaks saat eksekusi) |
| Tabel skill | Hanya 5 skill; master memiliki 9 (arc, aud, dev, fmn, humanize, read-memo, report, sigma-test, write-memo) | TERVERIFIKASI |
| Urutan | Bagian "Summary" berada sebelum bagian terakhir "Source review..." | TERVERIFIKASI |
| Jumlah tool MCP | README: 26 query + 39 control. Hitungan sementara dari kode: 26 query, 37 pemanggilan `registerTool` di `src/mcp/control`; perlu dihitung ulang tepat | PERLU VERIFIKASI |

Penyuntingan README memakai `/humanize` BALANCE. Konflik yang harus diputuskan (O-9): Rule 8 skill itu melarang kata "Sigma" dan nama artefak, sedangkan README adalah dokumentasi produk Sigma bagi pembaca yang memang menggunakannya.

### 4.3 Berkas Sigma lain

| Berkas | Tindakan |
|---|---|
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | Daftarkan 11 operasi yang hilang, tinjau 1 entri usang, perbarui deskripsi bernama berprefix, isi `NEEDS_REVIEW` |
| `Sigma/SIGMA-REGISTRY.json` | Selaraskan nama dokumen dan deskripsi (9 kemunculan) |
| Skill ARC, FMN, DEV, REPORT, HUMANIZE pada lima target (`setup/targets/*`) | Nama berprefix lama dan teks yang sudah dikoreksi pada rules; konsistensi lima target |
| `Sigma/templates/DIR-CLOSE-TEMPLATE.md` | Hanya rujukan lintas-bagian yang usang (dicatat E04); tidak mereview isi (O-10) |
| Teks bantuan CLI (`src/commands/*`, banner, `package.json`) | Deskripsi perintah dan banner "Lightweight"; tidak mengubah perilaku; perlu build dan tes (O-8) |
| `Sigma/role-memory/*.json` | Hanya bila rules berubah (hash `source_rule_version`); saat ini tidak direncanakan |
| `CHANGELOG.md` | Entri F18 |

## 5. Keputusan terbuka

| ID | Pertanyaan | Rekomendasi dan alasan | Jawaban Director |
|---|---|---|---|
| O-1 | Protocol: tambal per bagian, atau tulis ulang jadi v1.0 dengan penomoran bersih? | Tulis ulang. Setiap bagian bergantung pada model lama; penambalan mempertahankan nomor yang melompat dan sisa tier. Bagian yang masih benar (4.0, 16C, 16D prinsip) dipertahankan teksnya | TERBUKA |
| O-2 | Penamaan artefak dalam Protocol/README: `INTENT`, `PLAN`, `EXEC`, `CLOSE` dengan satu catatan legacy? | Ya, selaras F10 dan aturan rules yang sudah berlaku. Nama legacy hanya pada catatan kompatibilitas dan nama berkas template | TERBUKA |
| O-3 | Hapus residu "heavier process" (Protocol 1 dan 19, README "use a heavier governance process")? | Ya. Director sudah menyatakannya tidak relevan pada review ARC. README tetap memuat batas penggunaan (sistem regulasi/keselamatan) tanpa kata promosi | TERBUKA |
| O-4 | Riwayat versi v0.2-v0.11 di akhir Protocol | Hapus dari Protocol; Protocol hanya memuat versi dan tanggal terkini. Riwayat ada di Git dan CHANGELOG. Alasan: berisi rujukan ke dokumen yang bukan jalur live | TERBUKA |
| O-5 | Paket amandemen 003/004/005 sesuai bagian 3.3 dan lampiran A, termasuk pengakuan konsekuensi sistemik untuk Art. II dan IV | Setuju. Anda dapat meminta perubahan teks pada lampiran A sebelum Constitution disentuh | TERBUKA |
| O-6 | Butir yang tidak diubah: K-1 (kalimat retoris), 5b, 5c, K-3 | Biarkan; alasan pada tabel 3.1 | TERBUKA |
| O-7 | Penolakan pelonggaran "session" (3.2): setuju? | Setuju; hanya definisi yang ditambahkan | TERBUKA |
| O-8 | Teks bantuan CLI dan banner (`src`, `package.json`) ikut disentuh? | Ya, hanya deskripsi, tanpa perilaku. Build `dist/` dan tes dilaporkan sebelum commit. Kalau tidak, banner "Lightweight" bertentangan dengan Amendment 002 | TERBUKA |
| O-9 | README dengan `/humanize` BALANCE: terapkan Rule 1 sampai 7 dan kecualikan Rule 8 (larangan istilah Sigma)? | Ya, kecualikan Rule 8. README adalah dokumen produk Sigma; menghapus "Sigma" dan nama artefak membuatnya tidak dapat dipakai. Bahasa tetap Inggris (dokumen Sigma harus Inggris). Hasilnya: kalimat lebih pendek, tanpa tanda kurung, lead dengan keputusan | TERBUKA |
| O-10 | Template CLOSE: perbaiki rujukan usang saja, atau review isi (fokus terpisah)? | Perbaiki rujukan saja; review isi dijadikan fokus tersendiri bila Anda mau | TERBUKA |
| O-11 | Salinan terpasang (`cso.md`, `checkpoint.md`, humanize lama) | Di luar F18; dicatat sebagai pekerjaan F09 (hapus berkas usang saat distribusi) | TERBUKA |
| O-12 | Urutan eksekusi: Constitution lebih dulu, lalu Protocol, lalu README dan sisanya? | Ya. Art. VIII mewajibkan dokumen hilir diperbarui sebelum amandemen penuh diratifikasi; Protocol ditulis terhadap Constitution final | TERBUKA |

## 6. Strategi verifikasi dan kriteria selesai

1. Constitution: tiap amandemen punya tanggal, artikel, ringkasan, rationale, analisis kontradiksi, dan daftar dokumen hilir pada Amendment Log; tidak ada `DIR-DI`, `project-level instructions`, atau `next applicable tier` yang tersisa (grep).
2. Protocol: grep menunjukkan nol kemunculan `Intent Core`, `Sovereign`, `Operationalization`, `plan lock`, `exec lock`, `roadmap activate`, `Section N` yang merujuk template, dan nomor bagian Protocol berurutan tanpa celah.
3. Setiap perintah yang disebut pada Protocol dan README ada pada `node dist/cli.js <domain> --help`.
4. Registry: `refresh-registries:dry` tidak melaporkan operasi baru atau hilang; `NEEDS_REVIEW` tidak tersisa.
5. README: setiap kolom tabel perintah dicocokkan dengan `--help`; jumlah tool MCP dihitung ulang dari kode.
6. Kode (bila O-8 disetujui): `tsc` bersih, suite penuh hijau (baseline 81 berkas / 1.296 tes), `dist/` dibangun.
7. `sigma doctor --check-assets` untuk memastikan drift master-host adalah drift yang diharapkan (belum didistribusikan) dan tidak ada tambahan tak terduga.

## 7. Risiko dan dependensi

| Risiko | Mitigasi |
|---|---|
| Amandemen Art. IV mengubah makna hierarki yang dipakai AI role | Teks lampiran A mempertahankan urutan; hanya menambah pembeda normatif/catatan eksekusi; Protocol ditulis sesudahnya |
| Protocol v1.0 yang besar menyembunyikan kesalahan faktual | Setiap perintah dan klaim perilaku diperiksa terhadap `--help` dan dokumen fokus; daftar bagian 4.1 menjadi daftar periksa |
| README `/humanize` mengubah makna teknis | Aturan Preserve/Infer skill: keputusan, batas, dan ketidakpastian tidak diubah; perubahan README dibandingkan dengan diff |
| Salinan terpasang dan proyek nyata memakai Protocol lama | Tidak berubah sampai F09 (syarat urutan T-19 terpenuhi hanya setelah F18) |
| Perubahan Art. II/IV/VIII tanpa pengakuan eksplisit | O-5 meminta pengakuan terpisah |

## 8. Urutan langkah (setelah O-1 sampai O-12 dijawab)

| Gelombang | Isi |
|---|---|
| W0 | Baseline: `git status`, suite penuh, `tsc` |
| W1 | Constitution: amandemen 003, 004, 005 + Amendment Log |
| W2 | Protocol v1.0 (struktur, teks, penomoran) |
| W3 | Registry (operasi baru, deskripsi) dan teks bantuan CLI/banner (O-8) |
| W4 | Skill lima target dan referensi template CLOSE (O-10) |
| W5 | README melalui `/humanize` BALANCE |
| W6 | CHANGELOG, verifikasi bagian 6, build, suite penuh, catat hasil di F18 dan F00 |

## Lampiran A. Rancangan teks amandemen Constitution

Teks dalam bahasa Inggris, mengikuti bahasa Constitution. Tanda `→` menunjukkan penggantian. Teks bukan final sampai Director menyetujui.

### Amendment 003 — Terminology and definitions

- **Articles amended**: Article III, Article IV.
- **Rationale**: Article III refers to "project-level instructions" without defining them, while Article IV places agent rule files below the Director's intent. A reader cannot tell whether the Director's intent is a project-level instruction. Article IV also names the same document `DIR-INTENT` and `DIR-DI`. "Session" is a constitutional boundary and is not defined.
- **Changes**:
  - Article III, last paragraph: "…but superior to project-level instructions." → "…but superior to ad hoc instructions. An ad hoc instruction is a direction that is not recorded in an INTENT or an approved PLAN, such as a chat prompt or a one-time session request. An ad hoc Director instruction that conflicts with an agent rule file is handled through Director Override, not by silently departing from the rule file."
  - Article III, after the second paragraph: add "A session is one continuous AI conversation or invocation context in which a role is activated. Activating a role in a new context starts a new session."
  - Article IV: both `DIRECTOR_INTENT (DIR-INTENT)` and `DIRECTOR_INTENT (DIR-DI)` → `INTENT`, with one sentence: "INTENT is the Director's formal expression of strategic will within a project."
- **Contradiction analysis**: removes the possible conflict between Article III and Article IV. No other article uses the replaced terms.
- **Downstream**: `SIGMA_PROTOCOL.md` (role and hierarchy sections), `README.md` (Actors and Terminology).

### Amendment 004 — Authority semantics

- **Articles amended**: Article II, Article IV, Article V, Article X.
- **Rationale**: Article IV orders documents, runtime state, and an actor in one list and states that the higher tier always prevails, without saying what is compared. Article X falls back to the "next applicable tier" without a rule. Article II can be read as requiring the Director in every decision. Article V forbids restating a source, which would make an auditable PLAN impossible.
- **Changes**:
  - Article II: "No agent, automated process, or governance rule may remove the Director from the decision or approval flow." → "No agent, automated process, or governance rule may remove the Director's authority over a decision or approval that this Constitution or the operational governance protocol reserves to the Director. The Director is not required to take part in every decision; decisions delegated by an INTENT, a PLAN, or an agent rule file proceed within those bounds."
  - Article IV: the list is stated as an order of normative authority (what may or must be done): CONSTITUTION, INTENT, PROTOCOL, RULES, PLAN. Add: "RUNTIME_STATE and DEV output are execution records. They establish what was executed and cannot widen what was authorized." The existing sentence on RUNTIME_STATE is kept and aligned.
  - Article V: "exactly one authoritative source" → "exactly one normative authority"; "must reference it — not re-state it" → "must reference it and must not independently redefine it. A lower-tier document may quote or summarize a higher-tier requirement when it keeps the source identified and does not change the meaning." Add: "Runtime state is a record derived from the normative source and is not a competing authority."
  - Article X: "authority falls back to the next applicable tier" → "the authority to decide what is permitted falls back to the governing documents in the order of Article IV. An execution fact that cannot be traced to runtime state is treated as unverified and is not reconstructed from a PLAN." The Director remains the final fallback decision authority, subject to the instruments in Article II.
- **Contradiction analysis**: Articles II, IV, V, and X are changed together so that none contradicts another. Article VII (runtime state is the record of execution) is consistent with the new Article IV wording. Article VIII requires Director acknowledgment of the systemic effect of changes to Articles II and IV; see O-5.
- **Downstream**: `SIGMA_PROTOCOL.md` (authority, gate, and runtime sections), `README.md` (Actors, Gates, State Integrity).

### Amendment 005 — Duplication and thresholds

- **Articles amended**: Article II, Article VI, Article VIII.
- **Rationale**: the Temporary Experimental Authorization is defined in two articles, and the required declaration fields exist only in Article II. Article VI restates lifecycle mechanics held by Article IX. "Repeatedly" has no threshold.
- **Changes**:
  - Article VIII, Temporary Experimental Authorization: add the required declaration fields now in Article II (the article deviated from, the scope, the duration or termination condition, and the acknowledgment that it creates no precedent and does not modify doctrine). "If the same deviation is authorized repeatedly for the same scenario" → "If the same deviation is authorized more than once for the same scenario".
  - Article II, Instrument 2: keep the name and a one-sentence statement that it is a scoped, time-bounded deviation, and refer to Article VIII for its definition and required fields.
  - Article VI: keep the first two sentences (cognitive exchanges, audit outputs and reasoning artifacts are transient and carry no governance authority unless the Director approves elevating them and assigns document status). Replace the rest with a reference to Article IX for lifecycle mechanics.
- **Contradiction analysis**: no change of doctrine; moves a definition to the article that already owns it (Article V).
- **Downstream**: `SIGMA_PROTOCOL.md` (Temporary Experimental Authorization operational rules).

## 9. Hasil eksekusi (15 Oktober 2026)

Dieksekusi W0-W6 sesuai bagian 8 pada master. Belum di-commit; tidak ada push, sinkronisasi, atau perubahan pada `~/.sigma` dan proyek nyata.

| Gelombang | Hasil |
|---|---|
| W0 | Baseline HEAD d045e70: `tsc` bersih, 81 berkas / 1.296 tes hijau |
| W1 | Constitution: Amendment 003, 004, 005 diterapkan sesuai lampiran A dan dicatat pada Amendment Log (tanggal 2026-10-15). Pengakuan konsekuensi sistemik Art. II dan IV tercatat pada entri 004. `DIR-DI`, "project-level instructions", dan "next applicable tier" tidak tersisa (grep) |
| W2 | Protocol v1.0: 19 bagian berurutan tanpa celah; 48 perintah yang dikutip diverifikasi ada pada CLI; tidak ada `Intent Core`, `Sovereign`, `Operationalization`, nomor bagian template, atau `roadmap activate`; nama berprefix lama hanya pada catatan kompatibilitas |
| W3 | Registry: 11 operasi didaftarkan dan dilengkapi, `intent_baseline` diganti `intent_baseline_check` dan `intent_baseline_adopt`, 88 operasi, `refresh-registries:dry` tanpa selisih; 11 operasi diklasifikasikan pada tabel tier MCP; banner dan `package.json` tanpa "Lightweight"; 30 deskripsi perintah CLI memakai INTENT/PLAN/EXEC/CLOSE; `SIGMA-REGISTRY.json` 7 deskripsi |
| W4 | Skill ARC, FMN, DEV, AUD, REPORT pada lima target (247 penggantian), HUMANIZE (5 berkas), bridge (5), plugin Antigravity (3), openai.yaml Codex (3), memo/test skill; rujukan template CLOSE; frasa "PLAN is LOCKED" pada bridge diganti "approved" |
| W5 | README ditulis ulang dengan `/humanize` BALANCE (Rule 1-7); 85 perintah yang dikutip diverifikasi pada CLI; jumlah tool MCP diverifikasi dari server (26 query, 39 control) |
| W6 | CHANGELOG; `tsc` bersih; `dist/` dibangun; suite penuh 81 berkas / 1.296 tes hijau |

Perubahan tes: tiga tes (`dev-workspace`, `f14-removal`, `mcp-binding`) memaku jumlah registry di 78; kini 88 sesuai CLI.

Batas dan temuan yang belum ditangani:

- **TEA tidak memiliki mekanisme pencatatan.** Constitution mendelegasikan aturan operasional Temporary Experimental Authorization ke Protocol. Protocol v1.0 hanya mengulang bidang wajib dan menyatakan tidak ada perintah CLI. Lokasi dan bentuk pencatatan memerlukan keputusan Director.
- **Teks keluaran CLI dan pesan galat** (misalnya `FMN-PLAN v1.1 APPROVED` pada `approval.ts`, string pada `chain.ts`, `override.ts`, `session.ts`, `docCheck.ts`) masih memakai nama berprefix. Hanya deskripsi bantuan yang diubah (O-8); pesan runtime dibiarkan karena registry mencerminkannya dan sebagian dipakai tes.
- **Salinan terpasang dan host belum disinkronkan:** `doctor --check-assets` melaporkan 60 selisih master-host (Constitution, Protocol, rules, templates, skill). Salinan `cso.md`, `checkpoint.md`, dan humanize lama di `~/.claude/commands` masih ada. Ini F09, dan syarat urutan T-19 untuk Protocol kini terpenuhi pada master.
- **Template CLOSE:** hanya rujukan yang diperbaiki; review isi tetap fokus tersendiri (O-10).
- **README dan skill HUMANIZE:** Rule 8 skill (larangan istilah Sigma) tidak diterapkan pada README, sesuai O-9.

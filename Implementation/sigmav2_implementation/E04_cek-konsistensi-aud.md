# E04 - Cek konsistensi: AUD rules, AUD skill, AUD memory

Tanggal: 7 Oktober 2026
Status: DIEKSEKUSI (7 Oktober 2026), belum di-commit. Director menyetujui D-1 sampai D-10 sesuai rekomendasi. W1 AUD-RULE, W2 skill AUD (empat target diseragamkan), W3 memory AUD, W4 `npm test` 67 file / 907 test lulus (tanpa build; tidak ada kode yang berubah). Catatan eksekusi ada di bagian 9.
Dasar: arahan Director 7 Oktober 2026 (AUD dan CLOSE tidak direview isinya; AUD dicek konsistensinya terhadap perubahan ARC, FMN, DEV, INTENT, PLAN, EXEC; E04 disetujui; Protocol dikerjakan terakhir), hasil E01 sampai E03, F13, F14, dan catatan review Director pada [artifact_sigma_review_director.md](artifact_sigma_review_director.md) (ARC RULES butir 2, 3, 4 dan INTENT TEMPLATE butir 1).
Label: **TERKUNCI** (keputusan Director), **TERVERIFIKASI** (diperiksa pada berkas), **REKOMENDASI** (asisten, belum keputusan).

## 1. Cakupan

Dikerjakan: satu aturan baru atas permintaan Director (Session Isolation Rule, D-10), dan AUD-RULE, skill AUD (empat target), serta memory AUD dibandingkan dengan keadaan terkini template INTENT (schema 5), PLAN (schema 3), EXEC (schema 3), rules ARC, FMN, DEV, kode CLI, dan registry.

Tidak dikerjakan: penilaian mutu logika audit (kriteria Critic Mode, Verificator Mode, Evidence Boundary, isolasi); template CLOSE dan validator `close`; penambahan Writing Style Rules pada AUD (keputusan lama); Constitution; Protocol (terakhir); sinkronisasi ke `~/.sigma` dan proyek (F09); penghapusan tier pada kode amandemen (F05); nama file, marker, dan `type=` (F10).

## 2. Keputusan Director (TERKUNCI)

1. AUD dan CLOSE tidak ada review isi; AUD hanya dicek konsistensinya.
2. Rules tidak menyebut nomor section dan sebisa mungkin tidak menyebut nama section yang berelasi ke template (review ARC RULES butir 2, berlaku sebagai pola).
3. Rules menyebut artefak tanpa prefix role: INTENT, PLAN, EXEC, CLOSE (review ARC RULES butir 3).
4. "Heavier process" tidak ada lagi (review ARC RULES butir 4).
5. Tier sudah tidak ada di Sigma v2.
6. Protocol terakhir; butir perubahannya dicatat per fokus (bagian 7).
7. AUD menerima Session Isolation Rule (permintaan Director, 7 Oktober 2026). Teks aturan yang Director tulis TERKUNCI sebagai maksud; redaksi final dan penempatan menunggu persetujuan (D-10).

## 3. Temuan (TERVERIFIKASI)

Pembanding: ARC-RULE dan FMN-RULE memakai nama artefak tanpa prefix (0 kemunculan `DIR-INTENT`/`FMN-PLAN`), DEV-RULE 4, AUD-RULE 66. Template INTENT schema 5 tidak bernomor, tidak punya tag tier, dan tidak punya Intent Core.

| ID | Temuan | Lokasi | Tingkat |
|---|---|---|---|
| F-1 | Prefix role pada nama artefak (66 kemunculan), termasuk subjek pesan `AUD Findings: DIR-INTENT-v{X}` dan `FMN-PLAN-v{X}`. FMN-RULE sudah memakai `PLAN-vX.Y` pada subjek pesannya. | AUD-RULE (tersebar, trigger baris 1221, 1248); `aud-memory.json` baris 29; skill AUD | Tinggi |
| F-2 | Rujukan nomor section yang tidak ada lagi: "1.4 Desired Outcome", "3.1 Concrete Outcome", "Intent Core (§1.1-1.5)", "DIR-INTENT §2.1", "Section 6, 7, 9, 1", "template's §1.6". Template sekarang menamai bagian itu "Desired Outcome and Measurement"; tidak ada Intent Core. | AUD-RULE baris 166-167, 465-467, 481-482, 497-509, 647-651 | Tinggi |
| F-3 | Pemeriksaan kebenaran tag Sovereign vs Operationalization tidak dapat dijalankan: template INTENT, ARC-RULE, FMN-RULE, DEV-RULE memuat 0 kemunculan. Frasa "sovereign intent layer" dan "separation of sovereign intent from challengeable means" memakai konsep tier yang sama. | AUD-RULE baris 451, 503-515, 932 | Tinggi |
| F-4 | "Comprehensive Research" sudah bernama "Research" pada INTENT dan ARC-RULE. Status gerbang Verificator ditulis "NEEDED/NOT_NEEDED" (§2.1); template memakai Verification Status `NEED_VERIFICATION`, `NO_NEED_VERIFICATION`, `SKIP_VERIFICATION` dan menyatakan Verificator hanya berlaku bila Research ada. AUD-RULE tidak mengenal pembebasan Director (`SKIP_VERIFICATION`). | AUD-RULE baris 166-168, 330, 342, 349, 416, 420, 463; `aud-memory.json` baris 30 | Sedang |
| F-5 | "Quality Bar" (13 kemunculan) sudah bernama "Quality Standards" pada INTENT, PLAN, dan ARC-RULE; empat dimensinya sama. | AUD-RULE baris 237, 239, 254, 260, 281, 287, 524, 544, 546, 616, 647, 1043; `aud-memory.json` baris 25 | Sedang |
| F-6 | "Heavier process" masih ada pada tiga tempat: daftar rekomendasi, opsi aksi Director pada format keluaran, dan butir eskalasi. Kalimat "Is the project still appropriate for Sigma?" (baris 485) berasal dari pola yang sama (ARC-RULE butir 4 dihapus). Verdict `PROMOTE_TO_HEAVIER_PROCESS` sudah dihapus pada 1.0.0 tetapi sisanya tertinggal. | AUD-RULE baris 28, 485, 731, 986 | Sedang |
| F-7 | Nama bagian PLAN dan EXEC pada fokus audit sudah berganti: "implementation constraints" menjadi bagian Constraints for DEV (kolom DEV Freedom); "pre-build test contract" menjadi Acceptance Criteria and Test Contract; "Git Diff Evidence" menjadi Change Evidence; "developer verification", "known issues", "technical debt" kini tersebar pada Verification, Deviations Issues and Limitations, dan DEV Status. Per keputusan 2, perbaikannya menyebut isi, bukan nama section. | AUD-RULE baris 521-533, 578-588, 609-619 | Sedang |
| F-8 | Daftar verdict internal tidak seragam: enumerasi memuat sembilan verdict; format Verificator memakai juga `VERIFIED` dan `NEEDS_MORE_SOURCE`; format Standard AUD Findings hanya enam. Template INTENT dan PLAN serta validator hanya mengenal PASS, PASS_WITH_RISK, REVISE, REJECT_RECOMMENDED, OTHER, SKIP_FOR_AUDIT; selain empat pertama dicatat ARC atau FMN sebagai OTHER. Perilakunya konsisten, hanya daftar AUD-RULE belum menjelaskan pemetaannya. | AUD-RULE baris 668-696, 720, 749, 780 | Rendah |
| F-9 | Skill AUD berbeda antar target. `claude_code` (hash ec12eecc) memuat teks kebijakan CLI terbaru dan blok "Onboarding opener" serta "First-mention ordering". `codex` dan `reasonix` identik satu sama lain (701fbe7f) tetapi tidak memuat ketiganya. `antigravity` identik dengan `codex` selain nama pada frontmatter. Pola yang sama (blok opener hanya pada `claude_code`) terlihat pada skill ARC. | `setup/targets/*/aud*` | Sedang |
| F-10 | `aud-memory.json` bertanggal 2026-09-12; `source_rule_version` masih `unversioned` (sama dengan ARC, FMN, DEV). | `Sigma/role-memory/aud-memory.json` | Rendah |

Temuan di luar E04, dicatat tanpa tindakan:
- Template CLOSE masih merujuk "Desired Outcome (1.4)" dan "Success criteria (3.1)" pada bagian Intent Satisfaction, nomor yang tidak ada lagi pada INTENT. CLOSE tidak direview (keputusan Director), jadi hanya dicatat. Akibatnya AUD-RULE tidak dapat merujuk baris tabel itu dengan nama bagian.
- Blok "Onboarding opener" dan "First-mention ordering" hanya ada pada `claude_code` untuk ARC juga (F01/F09).
- Tabel label manusia pada skill (Intent Doc (DIR-INTENT), dan seterusnya) tetap sampai F04/F10, seperti pada skill ARC, FMN, DEV (E03 D-1).

## 4. Diperiksa dan konsisten (TERVERIFIKASI)

- Format pesan `sigma send --from aud --to ARC|FMN --type NOTE --action REVIEW`: tipe `NOTE` dan aksi `REVIEW` ada pada `VALID_MESSAGE_TYPES` dan `VALID_ACTIONS`. Pemetaan terhadap F03 (mailbox per intent) ditunda ke F03.
- Nama alat MCP pada AUD-RULE (`sigma_get_state`, `sigma_get_gates`, `sigma_get_orientation`, `sigma_list_artifacts`, `sigma_doctor`, `sigma_get_memory`) semuanya terdaftar pada server query.
- Wewenang menulis bagian AUD Notes: ARC (INTENT dan PLAN sesuai ARC-RULE) dan FMN (PLAN dan INTENT sesuai FMN-RULE) menyalin verdict persis; AUD tidak menulis. Sesuai AUD-RULE. DEV tidak boleh menulis di sana; sesuai template.
- Rujukan silang ke ARC-RULE (Research Mode Source Priority, Petition / Admission Review) dan ke DEV-RULE ("AUD may audit EXEC") masih valid.
- Memory AUD tidak memuat butir `sigma config show` yang dimiliki memory ARC, FMN, DEV. Ini disengaja: AUD pasif dan tidak menjalankan CLI selain `sigma memory --aud` dan `sigma send`.
- Doktrin Director memiliki tujuan dan AUD menyerang rute (baris 60-85, 852-858, 1275) memakai "sovereign" sebagai konsep wewenang Director, bukan tier. Tetap.
- Protocol §5.8 (Director-Facing Labels) yang dirujuk skill masih ada.
- Tidak ada test yang membaca AUD-RULE, skill AUD, atau memory AUD selain fixture schema 4; perubahan E04 tidak memerlukan build.

## 5. Keputusan terbuka

**D-1. Bagian tag Sovereign vs Operationalization (F-3).** Rekomendasi sebelumnya adalah menandainya "menunggu F05". Bukti baru: template INTENT sudah tidak memuat tag, sehingga pemeriksaan itu tidak dapat dijalankan hari ini. Opsi: (a) hapus sekarang beserta frasa "sovereign intent layer" dan "challengeable means"; (b) tunda ke F05.
Rekomendasi: (a). F05 menghapus tier pada kode amandemen; aturan AUD tidak bergantung pada kode itu. Menunda membiarkan AUD diminta memeriksa sesuatu yang tidak ada.

**D-2. Penamaan artefak (F-1).** Ganti DIR-INTENT, FMN-PLAN, DEV-EXEC, DIR-CLOSE dengan INTENT, PLAN, EXEC, CLOSE pada AUD-RULE, skill, memory, dan subjek pesan (`AUD Findings: INTENT-v{X}`).
Rekomendasi: ya, mengikuti ARC-RULE dan FMN-RULE. Nama file pada disk dan marker tetap berprefix sampai F10; rules tidak menyebut nama file.

**D-3. Nomor dan nama section (F-2, F-7).** Hapus semua nomor; rujukan ditulis menurut isi ("outcome yang diinginkan dan ukuran keberhasilannya", "kebutuhan yang diaudit"), meniru pola ARC-RULE.
Rekomendasi: ya.

**D-4. Heavier process (F-6).** Hapus tiga rujukan "heavier process". Untuk baris 485 ("Is the project still appropriate for Sigma?"): opsi (a) hapus, (b) pertahankan.
Rekomendasi: hapus tiga rujukan; untuk baris 485 pilih (a) dengan label TENTATIF, karena asalnya sama dengan butir yang sudah dihapus dari ARC-RULE, tetapi maksudnya tidak dinyatakan Director secara eksplisit.

**D-5. Research dan Quality Standards (F-4, F-5).** Ganti "Comprehensive Research" menjadi "Research" dan "Quality Bar" menjadi "Quality Standards". Gerbang Verificator ditulis menurut keberadaan Research, dan disebut bahwa Director dapat membebaskannya (`SKIP_VERIFICATION`), tanpa mengubah urutan Critic lalu Verificator.
Rekomendasi: ya.

**D-6. Daftar verdict (F-8).** Tambahkan `VERIFIED` dan `NEEDS_MORE_SOURCE` pada daftar verdict AUD dan satu kalimat pemetaan: verdict di luar empat verdict template dicatat sebagai OTHER oleh ARC atau FMN. Tidak mengubah arti verdict.
Rekomendasi: ya. Alternatif: tidak diubah (hanya kerapian).

**D-7. Skill antar target (F-9).** Seragamkan skill AUD pada empat target ke teks `claude_code` (frontmatter nama tetap per target), pada sumber master saja. Diff penuh dilakukan di W2 sebelum menyalin, karena diff awal hanya diperiksa sebagian.
Rekomendasi: ya untuk AUD. Drift pada skill ARC, FMN, DEV, dan lainnya dicatat ke F01/F09, tidak diperbaiki di E04.

**D-8. Memory AUD (F-10).** Perbarui butir yang memuat prefix, "Comprehensive Research", dan "Intent Quality Bar"; perbarui `memory_updated_at`. `source_rule_version` tetap `unversioned` (F01).
Rekomendasi: ya.

**D-9. Perluasan tugas AUD.** Tambah pemeriksaan keterlacakan PLAN ke ID INTENT (Source Alignment) pada fokus audit PLAN.
Rekomendasi: tidak. Itu tugas baru, bukan konsistensi, dan Director menyatakan tidak ada review isi AUD. Hanya nama dan rujukan yang diselaraskan.

**D-10. Session Isolation Rule (permintaan Director).** Maksud (TERKUNCI): pada percakapan dengan AUD aktif, AUD tidak boleh memakai pengetahuan, memory, asumsi, keputusan, ringkasan, atau informasi apa pun dari sesi percakapan lain, termasuk yang disodorkan otomatis oleh memori platform AI-nya sendiri. AUD mengabaikannya, tetap seindependen mungkin, dan hanya memakai informasi eksplisit dari sesi ini, berkas yang Director berikan pada sesi ini, dan sumber eksternal yang secara eksplisit diizinkan. Informasi yang hanya diketahui dari sesi lain diperlakukan sebagai tidak diketahui.

Usulan penempatan: bagian baru "Session Isolation Rule" tepat setelah External Auditor Isolation Policy pada AUD-RULE (satu keluarga aturan isolasi). Skill: ringkasan tiga baris pada bagian External Auditor Isolation Policy di empat target. Memory: satu butir pada `role_specific`.

Usulan teks AUD-RULE (bahasa Inggris, mengikuti bahasa rules):

> ## Session Isolation Rule
>
> In a conversation where AUD is active, AUD MUST rely only on: information the Director states explicitly in this session; files and materials the Director provides or authorizes in this session, including this role's rules and role memory loaded at activation; and external sources the Director explicitly permits, or that Verificator Mode's Source Priority allows while that mode is active.
>
> AUD MUST NOT use knowledge, memory, assumptions, decisions, summaries, or any other information that originates from another conversation session, including anything the AI platform's own automatic memory or cross-session recall supplies without the Director providing it. If AUD notices such information, AUD ignores it, treats anything known only from another session as unknown, and asks the Director to provide it if it is needed.
>
> AUD stays as independent as possible and relies on the references the Director provides.

Hal yang saya tambahkan agar aturan tidak bertabrakan dengan aturan lain (REKOMENDASI, mohon dikonfirmasi):
1. **Role memory dan rules bukan "sesi lain".** AUD-RULE sendiri mewajibkan memuat memory AUD saat aktivasi (`sigma memory --aud` / `sigma_get_memory`). Tanpa pengecualian, dua aturan saling bertentangan. Teks di atas menyebutnya eksplisit.
2. **Sumber eksternal Verificator Mode.** Verificator Mode wajib memverifikasi ke dokumentasi resmi dan sumber lain menurut Source Priority. Saya perlakukan Source Priority itu sebagai izin eksplisit yang sudah ada. Alternatif: Director mengizinkan sumber eksternal per audit; itu membuat Verificator Mode macet pada setiap audit.
3. **Keterbatasan penegakan.** AUD tidak dapat memeriksa secara andal dari mana sebuah ingatan berasal. Aturan ini bersifat perilaku, bukan jaminan teknis; efektivitasnya bergantung pada kepatuhan model. Tidak ada mekanisme kode yang dapat menggantikannya.
4. **Cakupan.** Hanya AUD (sesuai permintaan). Ini berbeda dari butir `memory_isolation` lintas role yang sebelumnya Director putuskan tidak diperlukan; tidak ada perubahan pada ARC, FMN, DEV.
5. **Pelaporan.** Tidak menambah baris pada blok Evidence Boundary. Format keluaran tetap stabil. Opsi: (a) tidak ada pelaporan; (b) satu baris "Not used: information from other sessions" pada Evidence Boundary.

Rekomendasi: setujui teks di atas dengan lima butir tersebut, dan pelaporan (a).

## 6. Urutan eksekusi (setelah keputusan)

W1 AUD-RULE (D-1 sampai D-6 dan D-10; urutan section yang ada tidak diubah, bagian baru D-10 disisipkan setelah External Auditor Isolation Policy). W2 skill AUD empat target (D-2, D-5, D-7, D-10). W3 memory AUD (D-8, D-10). W4 `npm test` tanpa build, lalu pencarian `DIR-INTENT|FMN-PLAN|DEV-EXEC|DIR-CLOSE|Comprehensive Research|Quality Bar|heavier|Sovereign` pada tiga berkas AUD untuk memastikan hanya sisa yang disengaja. Lampiran keterlacakan perubahan AUD-RULE dibuat bila Director menghendaki (E01 dan E03 memilikinya).

Tidak dilakukan: sinkronisasi ke `~/.sigma` dan proyek (F09); perubahan Constitution dan Protocol; perubahan kode.

## 7. Butir perubahan Protocol dari E04 (untuk sapuan akhir)

- Bagian 5.7: judul "Reference List — Comprehensive Research Source Index" memakai nama lama.
- Bagian 5.8: label manusia memakai nama berprefix.
- Bagian yang menjelaskan AUD dan verdict: periksa kesesuaian dengan D-1, D-4, D-6 setelah dieksekusi.
- Rujukan Sovereign vs Operationalization (12 kemunculan) mengikuti F05.

## 8. Di luar E04: Constitution

Director menyatakan sebagian besar mengikuti hasil audit ChatGPT atas Constitution (bagian CONSTITUTION pada artifact_sigma_review_director.md; berkas itu sendiri menyatakan tidak direview Director dan ditunda). Setiap perubahan Constitution memerlukan deklarasi amandemen eksplisit Director (Article VIII) dan tidak termasuk E04. Usulan: fokus terpisah (F15) yang memetakan lima prioritas audit itu menjadi usulan amandemen per butir untuk disetujui satu per satu. Bagian Sovereign vs Operationalization (prioritas 5) berhubungan dengan F05 dan sebaiknya dikerjakan bersamanya.

## 9. Catatan eksekusi

- AUD-RULE: prefix role dihapus (INTENT, PLAN, EXEC, CLOSE), nomor section dan Intent Core dihapus, pemeriksaan tag Sovereign vs Operationalization dihapus (Critic Mode pada INTENT menjadi dua langkah), "Research" dan "Quality Standards" menggantikan nama lama, gerbang Verificator mengikuti keberadaan Research dan `SKIP_VERIFICATION`, empat rujukan "heavier process" dan kalimat "Is the project still appropriate for Sigma?" dihapus, `VERIFIED` dan `NEEDS_MORE_SOURCE` ditambahkan beserta kalimat pemetaan OTHER, bagian Session Isolation Rule disisipkan setelah External Auditor Isolation Policy. Urutan section lain tidak diubah.
- Skill AUD: keempat target kini identik dengan teks `claude_code` ditambah ringkasan Session Isolation Rule; hanya nama pada frontmatter yang berbeda (`antigravity`: `sigma-aud`).
- Memory AUD: butir prefix, "Research", dan "INTENT Quality Standards" diperbarui; satu butir Session Isolation Rule ditambahkan; `memory_updated_at` 2026-10-07; `source_rule_version` tetap `unversioned`.
- Penyimpangan kecil dari rencana: (1) baris label manusia pada skill ("Intent Doc (DIR-INTENT)" dan seterusnya) dipertahankan karena fungsinya memetakan label ke kode dan sama dengan skill ARC, FMN, DEV (E03 D-1); mengikuti F04/F10. (2) Pertanyaan "Are technical assumptions marked as auditable means?" diubah menjadi "presented as auditable means rather than as the Director's destination", karena kata "marked" berasal dari konsep tag. (3) Definisi `VERIFIED` dan `NEEDS_MORE_SOURCE` pada tabel verdict adalah teks baru yang saya tulis; sebelumnya keduanya dipakai tanpa definisi.
- Tidak dikerjakan: sinkronisasi ke `~/.sigma`, proyek, dan lokasi skill terpasang (F09). Salinan terpasang AUD (termasuk yang dipakai AUD eksternal) belum memuat Session Isolation Rule sampai sinkronisasi atau penyalinan manual.

**D-11 (tambahan Director setelah eksekusi, 7 Oktober 2026): Reference Requests.** AUD boleh meminta izin atas referensi tambahan yang spesifik sebelum audit dimulai; Director menyetujui atau menolak; permintaan source code umumnya ditolak demi independensi AUD. Diterapkan: AUD-RULE (subbagian Reference Requests pada External Auditor Isolation Policy), ringkasan pada skill AUD (empat target tetap identik), satu butir pada memory AUD. Tambahan redaksi dari saya, bukan dari Director: permintaan harus menyebut referensi dan pertanyaan yang dijawabnya; AUD tidak meminta source code kecuali tidak ada referensi lain dan harus menyebut alasannya; penolakan final untuk audit itu (AUD melanjutkan dengan batasan tercatat di Evidence Boundary, tidak meminta ulang, tidak mencari sendiri). `npm test` tetap 67 file / 907 test lulus.

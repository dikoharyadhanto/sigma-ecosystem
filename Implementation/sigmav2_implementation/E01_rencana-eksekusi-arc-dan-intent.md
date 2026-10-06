# E01 - Rencana eksekusi: INTENT template, ARC rules, ARC skill, ARC memory

Tanggal: 6 Oktober 2026
Status: RENCANA, menunggu persetujuan Director atas butir bagian 5. Belum ada file rules, skill, memory, template, atau kode yang diubah.
Dasar: otorisasi Director "kerjakan terbatas pada 4 hal" dan keputusan yang tercatat di [F00](F00_indeks-dan-register.md) bagian 7 dan [F11](F11_writing-style-rules.md).

## 1. Cakupan

**Dikerjakan:**

1. INTENT template (master) beserta penyesuaian kode dan test.
2. ARC rules (master), batch A.
3. ARC skill: hanya penambahan Writing Style Rules.
4. ARC memory: hanya penambahan Writing Style Rules.

**Tidak dikerjakan di E01:** amandemen berbasis Git (F05), penamaan tanpa prefix pada pembuatan artefak (F10), aturan gaya untuk FMN dan DEV (F11 bagian FMN/DEV), template dan skill role lain, Constitution dan Protocol, sinkronisasi ke skill terpasang di home dan ke proyek (F09).

## 2. Temuan kode (terverifikasi, read-only)

- Template INTENT dipakai lewat `copyTemplateToArtifact('DIR-INTENT-TEMPLATE.md')` di [intentDraftService.ts](../../src/services/intentDraftService.ts) baris 98.
- Marker template saat ini: `<!-- SIGMA:DOC type=DIR_INTENT schema=4 -->`.
- [docCheck.ts](../../src/utils/docCheck.ts): satu `DOC_SPECS.intent` (baris 119-160) dengan 13 section wajib, urutan section, dan `AMENDMENT_HISTORY` opsional. Persyaratan isi (content-aware) mencakup verdict AUD, `FINAL_VALIDATION_CHECKLIST`, checklist Quality Bar, dan heading `### 13.2 Conditional Requirement`. Seluruhnya terikat pada struktur lama.
- Pemakai ID section INTENT hanya `docCheck.ts`, template, dan dua test: `doc-check-optional-sections.test.ts` dan `helpers.ts`. Test lain yang menyebut INTENT: `doc-check.test.ts`, `intent-amendment.test.ts`, `reconstruct.test.ts`, `humanize-fidelity-coverage.test.ts`, `role-memory-bootstrap.test.ts`.
- Sebutan tier di kode hanya berupa teks deskripsi: [intent.ts](../../src/commands/intent.ts) baris 200-203 dan [amendmentHistory.ts](../../src/utils/amendmentHistory.ts) baris 17. Kemunculan "tier" di `chain.ts` baris 198 dan 1252 berarti hal lain.
- `dist/` dilacak Git (405 berkas) dan sigma-mcp terpasang lewat symlink global. Build (`npm run build`, `tsc`) mengubah berkas yang dilacak dan perilaku MCP seluruh host.
- Template di proyek adalah salinan lokal. Proyek lama tetap memakai template schema 4 sampai disinkronkan, sehingga validator harus menerima schema 4 dan schema baru.

## 3. Rincian pekerjaan

### W0 - Baseline
Pastikan working tree bersih, jalankan `npm test` (vitest, tanpa build), catat hasil sebagai pembanding.

### W1 - INTENT template ([DIR-INTENT-TEMPLATE.md](../../Sigma/templates/DIR-INTENT-TEMPLATE.md))
- Struktur sembilan section ditambah ringkasan, mengikuti §5.1 dokumen 28 September dengan koreksi di F00 bagian 7. Judul section dan petunjuk berbahasa Inggris, petunjuk satu baris, petunjuk panjang dipindah ke ARC rules.
- Nama section: Director Summary; Purpose and Problem; Desired Outcome and Measurement; Scope; Quality Standards; Priorities and Constraints; Assumptions and Risks; Functional Requirements dengan Guidance for FMN sebagai section sendiri; Research (opsional); AUD Notes.
- Tanpa tier, Final Validation Checklist, Amendment History, dan tabel definisi.
- Marker `schema` naik ke 5; `type=DIR_INTENT` tetap sampai F10.

### W2 - Kode dan test
1. `docCheck.ts`: pemilihan spesifikasi INTENT berdasarkan `schema` (4 memakai spesifikasi lama tanpa perubahan, 5 memakai spesifikasi baru).
2. Spesifikasi schema 5: section wajib, urutan, `AMENDMENT_HISTORY` tetap opsional sementara (agar `sigma intent amendment` yang ada tidak rusak sebelum F05).
3. Persyaratan ratify schema 5 menggantikan 15 checkbox: (a) Director Summary terisi, (b) contoh uji batas terisi, (c) Quality Standards terisi untuk empat dimensi, (d) verdict AUD tercatat (logika yang ada). Jumlah contoh (3 dan 3) diperiksa sebagai peringatan sampai pilot, tidak memblokir.
4. Teks deskripsi di `intent.ts` dan `amendmentHistory.ts`: hilangkan istilah tier.
5. Test: fixture schema 5, test spesifikasi baru, test bahwa INTENT schema 4 tetap lolos, penyesuaian `helpers.ts`.
6. Tidak ada build pada W2.

### W3 - ARC rules batch A ([ARC-RULE.md](../../Sigma/rules/ARC-RULE.md))
1. Hapus section Sovereign vs Challengeable dan seluruh sebutan dua tier, termasuk klasifikasi pada Amendment Request. "Source tier" Research Mode dan skala skor bertingkat tetap.
2. Hapus nomor section dan rujukan nomor ke template; rujukan lintas dokumen memakai nama.
3. Hapus prefix role: INTENT, PLAN, EXEC, CLOSE.
4. Hapus Key Rule "preserve Sigma simplicity" dan sisa "heavier process".
5. Tulis ulang rujukan "Ratify Requirement checklist in Section 13" mengikuti persyaratan schema 5.
6. Tambah panduan pengisian INTENT (petunjuk panjang dari template).
7. Amandemen: butir 5 (persetujuan langsung Director, konfirmasi ulang otoritas) dan butir 7 (daftar perubahan dan section terdampak disetujui Director) masuk batch A karena tidak bergantung pada infrastruktur Git. Butir 6 dan 8 (commit sebelum amandemen, INTENT lokal sama dengan Git) masuk batch B bersama F05.
8. Tambah Writing Style Rules (F11) pada `Behavioral Standards`.
9. Susun ulang urutan (langkah terpisah setelah butir 1-8 selesai, perlu persetujuan kerangka di bagian 4), disertai tabel keterlacakan setiap kewajiban MUST dan MUST NOT.

### W4 - ARC skill
Tambah Writing Style Rules pada empat target: [claude_code](../../setup/targets/claude_code/arc.md), [codex](../../setup/targets/codex/arc/SKILL.md), [reasonix](../../setup/targets/reasonix/arc.md), [antigravity](../../setup/targets/antigravity/sigma-arc/SKILL.md). Teks sama dengan rules. Bila ditemukan sebutan tier, nomor section, atau prefix yang bertentangan dengan rules baru, saya laporkan dan tidak mengubahnya tanpa persetujuan.

### W5 - ARC memory
Tambah pengingat Writing Style Rules pada [arc-memory.json](../../Sigma/role-memory/arc-memory.json) dengan rujukan ke rules, tanpa kewajiban baru. Sebutan tier dilaporkan bila ada.

### W6 - Verifikasi
`npm test` penuh (hasil dibandingkan dengan W0), pemeriksaan teks aturan identik di rules dan empat skill, pemeriksaan bahwa tidak ada kata tier Sovereign/Operationalization tersisa di berkas cakupan.

## 4. Kerangka urutan baru ARC-RULE (untuk persetujuan, butir 9)

Pengelompokan menurut alur kerja ARC:

1. Role
2. Core Responsibilities
3. Key Rules & Constraints
4. Behavioral Standards (termasuk Writing Style Rules) dan Role Stance Requirement
5. Role Activation
6. INTENT Creation Rules, panduan pengisian INTENT, AUD Findings Section Authorization
7. Research Mode
8. Interaction With Other Roles
9. Petition / Admission Review
10. Amendment Request
11. Closure Evaluation
12. ARC Satisfaction Score Methodology
13. CLI Operation Policy
14. Inter-Role Communication Protocol dan Mandatory Message Triggers
15. Escalation Path
16. Final Doctrine

Urutan sekarang: Role, Core Responsibilities, Key Rules, Research Mode, INTENT Creation Rules, AUD Findings Section Authorization, Interaction, Escalation, Petition, Amendment, Role Activation, Closure Evaluation, Score, Behavioral Standards, Role Stance, CLI Operation Policy, Inter-Role Communication, Mandatory Triggers, Final Doctrine.

## 5. Butir yang perlu persetujuan Director

| ID | Butir | Rekomendasi |
|---|---|---|
| E-1 | Pembagian batch ARC-RULE disempurnakan: butir 5 dan 7 masuk batch A, butir 6 dan 8 batch B | Setuju |
| E-2 | Persyaratan ratify schema 5 (W2 butir 3) | Setuju |
| E-3 | `AMENDMENT_HISTORY` opsional pada schema 5 sampai F05 | Setuju |
| E-4 | Marker `type=DIR_INTENT` tetap, `schema=5`; rename tipe dikerjakan dengan F10 | Setuju |
| E-5 | Baris "Amandemen terakhir" di header ditunda ke F05 agar tidak ada placeholder tanpa mekanisme | Setuju |
| E-6 | Kerangka urutan ARC-RULE bagian 4 | Setuju atau ubah |
| E-7 | Target skill ARC: keempat target | Setuju |
| E-8 | Tidak menyinkronkan ke skill terpasang di home dan proyek (KLHK dan lainnya) pada E01 | Setuju; perubahan master belum berlaku di sesi AI sampai sinkronisasi (F09) |
| E-9 | Titik build: tidak ada build sampai W6 selesai dan Director menyetujui. Karena `dist/` dilacak Git dan MCP berubah seluruh host, build dilaporkan sebelum dijalankan | Setuju |
| E-10 | Commit: hanya atas instruksi Director; usulan pengelompokan satu commit per W (W1 dan W2 bersama, W3, W4 dan W5) | Setuju |

## 6. Risiko

- Perubahan validator tanpa fixture lama membuat INTENT schema 4 gagal. W2 butir 5 menguji ini secara eksplisit.
- Penyusunan ulang ARC-RULE mengubah makna tanpa terdeteksi. Tabel keterlacakan dan pemisahan langkah mengurangi risiko.
- ARC-RULE di proyek (contoh KLHK) berbeda dari master; perbedaan itu tetap sampai sinkronisasi.
- Perubahan master tidak langsung terlihat oleh AI role karena skill terpasang masih salinan lama.

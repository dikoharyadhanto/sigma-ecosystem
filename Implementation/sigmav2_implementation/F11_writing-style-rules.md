# F11 - Writing Style Rules pada rules dan skill AI role

Tanggal: 6 Oktober 2026
Status: DRAFT rencana. Seluruh keputusan terbuka (W-1 sampai W-10) sudah dijawab Director. Belum ada file rules, skill, atau memory yang diubah.
Register dan urutan fokus ada di [F00](F00_indeks-dan-register.md).

## 1. Tujuan dan batas

Menambahkan satu aturan bernama **Writing Style Rules** ke rules dan skill AI role, agar artefak yang ditulis AI role lebih pendek, langsung ke inti, dan hanya memuat informasi terbaru yang benar.

Masalah yang dituju (laporan Director): AI role menceritakan proses pengambilan keputusan, sehingga pembaca terdistraksi. Kalimat AI cenderung bertele-tele. Ketika sebuah hal salah dipahami lalu diklarifikasi dan diperbaiki, dokumen masih menyebut versi yang salah sebagai penjelasan.

Cakupan tulisan: artefak **INTENT, PLAN, EXEC, dan CLOSE**, ditambah bagian ROADMAP yang disunting manual (Core Process Flow dan Planned Stage; Stage Overview diisi CLI). Dokumen lain mengikuti skill humanize bila diaktifkan.

Di luar batas fokus ini: struktur dan isi template, perubahan kode.

## 2. Keputusan Director (TERKUNCI)

1. Satu aturan Writing Style Rules ditambahkan pada rules dan skill AI role yang menulis artefak: ARC (INTENT, CLOSE), FMN (PLAN, ROADMAP), DEV (EXEC). **AUD dikeluarkan:** aturan AUD independen dan didesain sebagai sudut pandang pengguna; Director dapat memahami hasil audit AUD.
2. Isi diadopsi dari `humanize.md`: (1) kurangi atau hilangkan contrastive negation ("X, not Y"); (2) kurangi artificial completeness (over-explain, over-clarify, over-redundancy); (3) professional and effective writing.
3. Dokumen hanya memuat informasi terbaru yang benar, tidak redundan, dan langsung ke inti. Bila sebuah hal salah dipahami lalu diklarifikasi Director dan diperbaiki, dokumen hanya memuat versi yang benar. Versi yang salah, miskomunikasinya, dan klarifikasinya tidak ditulis.
4. Aturan hanya berlaku untuk dokumen baru. Dokumen LOCKED dan dokumen lama tidak ditulis ulang.
5. Skill memuat teks aturan juga, tidak hanya rules.
6. Tidak ada penegakan otomatis. Penilaian ada pada AI role dan pada keterbacaan dokumen menurut Director. Director dapat menolak approve bila gagal memahami isi kontrak, EXEC, atau INTENT. Pemahaman berasal dari keterbacaan dokumen, tidak dari penjelasan lisan.
7. Role memory memuat aturan ini kemudian, kemungkinan untuk ARC, FMN, dan DEV saja.
8. Catatan deviasi yang menyatakan fakta tidak melanggar aturan. Contoh: kontrak menyatakan PLAN harus mengukur A, tetapi A tidak dapat diukur saat implementasi karena B belum tersedia. Pernyataan itu keadaan nyata dan alasannya, bukan narasi miskomunikasi, sehingga tetap berlaku.
9. ROADMAP termasuk cakupan pada bagian yang disunting manual, karena sebagian ROADMAP diisi CLI.
10. Tidak ada butir aturan tambahan tentang revisi artefak saat Director belum memahami. Director dapat mensyaratkan perbaikan tulisan sesuai writing style sebagai syarat approve, sesuai tingkat kesulitan memahami dokumen. Pada tingkat wajar, Director tidak menuntutnya. Ini hak Director, tidak menjadi kewajiban dalam rules.

## 3. Fakta terverifikasi

- Sumber adopsi: [setup/targets/claude_code/humanize.md](../../setup/targets/claude_code/humanize.md), Writing Rules nomor 2 (contrastive negation, baris 109-121), nomor 3 (artificial completeness, baris 123-127), nomor 7 (professional and effective writing, baris 149-154). Nomor 3 memuat klausa bahwa batasan, risiko, atau keputusan yang material tetap dicantumkan.
- Butir humanize yang tidak diadopsi: nomor 1 (passive voice), 4 (lead with decision), 5 (technical terms), 6 (parenthetical asides), 8 (never use Sigma terminology). Nomor 8 tidak cocok untuk artefak Sigma yang memakai istilah Sigma.
- Tidak ada aturan gaya penulisan di empat role rules maupun empat role skill saat ini. FMN-RULE baris 309 dan DEV-RULE baris 146 hanya meminta Director's Summary yang ringkas, terbatas pada satu section.
- Setiap role rules memiliki bagian `Behavioral Standards` (ARC baris 630, FMN 462, DEV 591, AUD 1021) sebagai kandidat lokasi.
- Skill AUD untuk Codex menyebut memory dan rules, tetapi langkah aktivasinya tidak eksplisit memuat pembacaan rules ([daftar periksa F01](F01-lampiran_daftar-periksa-dokumen.md), bagian 5). Hal ini mendasari keputusan nomor 5.

## 4. Draf teks aturan (usulan, bahasa Inggris sesuai bahasa rules)

> ### Writing Style Rules
>
> Applies to INTENT, PLAN, EXEC, and CLOSE, and to the manually edited parts of ROADMAP.
>
> 1. State facts directly. Avoid contrastive negation ("X, not Y"). Use a contrast once, and only when the reader would otherwise misread a specific risk.
> 2. Write to the information need. Do not over-explain, over-clarify, or repeat a point in other words. A material limitation, risk, or decision stays in.
> 3. Write concisely and professionally: plain sentences, short paragraphs, each claim stated once, no filler openers.
> 4. Write only the current, correct statement. When information is corrected after a clarification, state the corrected version. Do not mention the earlier wrong version, the misunderstanding, or the clarification. Do not narrate how a decision was reached.

Butir 1-3 berasal dari `humanize.md`; butir 4 dari penjelasan Director (keputusan nomor 3).

## 5. Peta dampak dan rencana langkah

| Kelompok | Berkas | Catatan |
|---|---|---|
| Rules (3) | [ARC-RULE](../../Sigma/rules/ARC-RULE.md), [FMN-RULE](../../Sigma/rules/FMN-RULE.md), [DEV-RULE](../../Sigma/rules/DEV-RULE.md) | Satu aturan per file, pada `Behavioral Standards` atau padanan setelah penyusunan ulang urutan |
| Skill (12) | `setup/targets/{claude_code,codex,reasonix,antigravity}/` untuk arc, fmn, dev | Teks aturan sama di seluruh target |
| Role memory (3) | `Sigma/role-memory/{arc,fmn,dev}-memory.json` | Ditambahkan kemudian, setelah review ARC memory |
| Salinan proyek | `<proyek>/Sigma/rules/` dan skill terpasang di home | Lewat sinkronisasi (F09), tanpa menimpa perubahan lokal |

Langkah:
1. ARC: aturan masuk bersamaan dengan ARC-RULE batch A, review ARC skill, dan review ARC memory yang sedang berjalan, agar penyusunan ulang urutan section tidak bentrok.
2. FMN dan DEV: aturan ditambahkan di rules, skill, dan memory setelah ARC selesai.
3. Pemeriksaan paritas: teks aturan identik di semua rules dan skill (perbandingan teks, bukan hash berkas).
4. Distribusi dan sinkronisasi ke proyek mengikuti F09.

## 6. Keputusan terbuka

Tidak ada.

## 7. Risiko

- Pemangkasan berlebihan menghilangkan batasan atau risiko yang material. Klausa "material tetap dicantumkan" dari `humanize.md` dibawa ke butir 2.
- Dua tempat berisi teks yang sama (rules dan skill) dapat menyimpang bila disunting terpisah. Sumber otoritatif di rules dan pemeriksaan paritas mengurangi risiko.
- Konflik dengan butir lain di Behavioral Standards. Contoh: ARC butir 7 ("heavyweight governance ceremony") tumpang tindih dengan keputusan menghapus "preserve simplicity" dan ditangani di ARC-RULE batch A.
- Penilaian gaya tidak dapat diperiksa validator, sehingga hasilnya bergantung pada kepatuhan AI role dan review Director.

## 8. Kriteria selesai

1. Satu aturan Writing Style Rules ada di rules, skill, dan memory role yang dicakup, dengan teks identik.
2. Tidak ada aturan lain di rules, skill, atau memory yang bertentangan dengan aturan ini.
3. Director dapat memahami kontrak, EXEC, atau INTENT baru dari keterbacaan dokumen saja. Tidak ada target angka; panjang dokumen bukan ukuran keberhasilan.

## 9. Dependensi

Bergantung pada ARC-RULE batch A, review ARC skill dan ARC memory (penempatan ARC), serta F09 (distribusi dan paritas). Tidak bergantung pada F02-F05.

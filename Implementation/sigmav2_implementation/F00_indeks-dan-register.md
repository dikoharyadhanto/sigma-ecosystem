# F00 - Indeks rencana implementasi Sigma v2

Tanggal mulai: 6 Oktober 2026
Status dokumen: DRAFT kerja, diperbarui sepanjang penyusunan rencana.
Sifat dokumen: catatan kerja rencana implementasi. Bukan artefak governance Sigma dan bukan otorisasi untuk mengubah kode, konfigurasi, state, atau Git. Implementasi tiap fokus baru dimulai setelah Director menyetujui rencana fokus tersebut secara eksplisit.

## 1. Dasar dan batas

- Sumber keputusan: [diskusi_rencana_perubahan_sigma_v2.md](../../Discussion/Evaluation-06102026/diskusi_rencana_perubahan_sigma_v2.md). Dokumen pendukung di folder yang sama: audit UX 27 September, keputusan desain dan inventaris 28 September, EVALUASI-SIGMA.md (kasus AUD KLHK).
- Basis kode: branch `main`, HEAD 7549f4b saat dokumen ini dibuat. Nomor baris yang dikutip dari dokumen diskusi harus diverifikasi ulang pada kode saat ini sebelum dipakai di rencana fokus.
- Branch kerja: `main`, atas instruksi eksplisit Director 6 Oktober 2026 (evaluasi menyentuh inti Sigma, bukan Hermes). Commit dan merge hanya atas arahan Director.
- Folder ini adalah lokasi seluruh rencana implementasi. Satu file per fokus, Bahasa Indonesia.

## 2. Daftar fokus dan status

| Kode | Fokus | Strategy Action | Status | File |
|---|---|---|---|---|
| F00 | Indeks, glosarium, dependensi, register keputusan terbuka, disiplin build | - | Berjalan | file ini |
| F01 | Peta konsistensi aturan (master, proyek, skill, memory, versi aturan) | 1 | **DITAHAN** - menunggu feedback review Director per dokumen | rencana belum dibuat; bahan review: [F01-lampiran_daftar-periksa-dokumen.md](F01-lampiran_daftar-periksa-dokumen.md) |
| F02 | Penomoran chain dan warning bootstrap | 5 | Belum dimulai | - |
| F03 | Mailbox per intent | 4 | Belum dimulai | - |
| F04 | Lifecycle APPROVED/LOCKED, doctor, pengikatan revisi | 2, 9 | Belum dimulai (kemungkinan dipecah F04a/F04b) | - |
| F05 | Amandemen INTENT melalui Git, penghapusan tier | 8 | Belum dimulai | - |
| F06 | sigma notes | 3 | Belum dimulai (track terpisah, rilis 1.1.0) | - |
| F07 | Pilot keterbacaan dan penyederhanaan dokumen | 6, 7 | Belum dimulai; bergantung pada F01 | - |
| F08 | Review sumber/kesiapan, revisi dari artefak lama, paket audit, keputusan tertunda | 10-12 | Belum dimulai | - |
| F09 | Distribusi skill/bridge dan validasi paritas CLI/MCP, chain lama/baru | 13 | Belum dimulai | - |
| F10 | Penamaan artefak tanpa prefix role untuk artefak baru; proyek/artefak lama tidak diubah | (tambahan, sumber: D-07 dokumen 28 September) | Ditambahkan 6 Oktober atas keputusan Director; urutan ditentukan kemudian | - |

Urutan penyusunan yang disetujui Director: F00, F02, F03, F04, F05, F06, F01, F07, F08, F09. Satu fokus per giliran; setiap fokus berakhir dengan pertanyaan terbuka dan rekomendasi, lalu menunggu keputusan Director.

Penyimpangan dari tabel Strategy Action pada dokumen diskusi: F02 didahulukan dari F03 karena pemetaan pesan bertanda v2.1 ke INTENT v2 membutuhkan identitas chain dan aturan penomoran.

### Penanda F01 - DITAHAN

F01 tidak dikembangkan sampai Director memberikan feedback hasil review per dokumen. Yang sudah ada hanya bahan yang tercatat di dokumen diskusi, tanpa analisis tambahan:

- Salinan AUD-RULE di KLHK berbeda dari master; bagian pemeriksaan tag pada audit INTENT ada di master dan tidak ada di KLHK (hash berbeda). Sebab dan waktu drift belum ditelusuri.
- `aud-memory.json` master dan KLHK identik, `source_rule_version` masih unversioned.
- Skill AUD (Codex) menyebut memory dan rules, tetapi langkah aktivasi tidak eksplisit memuat pembacaan rules.

Constitution dan Protocol juga DITAHAN dan direview belakangan (keputusan Director, 6 Oktober 2026). Review Constitution dari AI lain tersimpan di `artifact_sigma_review_director.md` dan belum diolah; perubahan Constitution memerlukan deklarasi amandemen eksplisit Director (Article VIII).

Pengembangan lanjutan F01 menunggu: (a) feedback Director per dokumen, (b) kejelasan dokumen mana yang menjadi cakupan peta. Fokus lain yang menyentuh rules/memory/skill (F03, F04, F05, F09) mencatat butir yang perlu disinkronkan di F01 tanpa menunggu F01 selesai.

## 3. Struktur standar dokumen rencana per fokus

1. Tujuan dan batas fokus.
2. Keputusan Director yang sudah terkunci (dengan rujukan ke dokumen diskusi).
3. Peta dampak kode, diverifikasi pada kode saat ini (file, fungsi, jalur CLI dan MCP).
4. Spesifikasi perilaku: kondisi, hasil, kasus tepi.
5. Kompatibilitas dan migrasi.
6. Keputusan terbuka: pertanyaan, opsi, rekomendasi dengan alasan, kolom jawaban Director.
7. Strategi uji dan kriteria selesai.
8. Risiko dan dependensi.
9. Urutan langkah implementasi (diisi setelah keputusan terbuka tertutup).

Label isi yang dipakai konsisten: **TERKUNCI** (keputusan Director), **TERVERIFIKASI** (diperiksa pada kode), **REKOMENDASI** (asisten, belum keputusan), **TERBUKA** (menunggu keputusan).

## 4. Dependensi antar fokus

```text
F02 (identitas chain, aturan penomoran)
 |-- F03 (mailbox per intent)
 |-- F04 (lifecycle, acuan revisi)
 |-- F05 (amandemen; PLAN menunjuk revisi INTENT)
F04 --> F08 (review sumber, revisi dari artefak lama)
F01 --> F07 --> (template, rules, memory baru)
F06 independen
F09 menutup seluruh fokus
```

Dependensi lunak (dapat dikerjakan paralel, perlu sinkron): F05 dan F07 sama-sama menyentuh penghapusan tier pada rules/template/memory/protocol; F03, F04, F05 menambah perilaku yang perlu dicerminkan di skill dan orientasi (F09).

## 5. Register keputusan terbuka lintas fokus

Disalin dari dokumen diskusi sebagai titik awal. Setiap butir dibahas di rencana fokus yang ditunjuk; rekomendasi asisten ditambahkan di sana.

| ID | Fokus | Butir terbuka |
|---|---|---|
| T-01 | F02 | Bentuk penanda permanen aturan penomoran chain dan bukti pemulihannya untuk rekonstruksi saat state chain hilang |
| T-02 | F03 | Apakah GENERAL ikut send gate dan kuota memo; aturan balasan dengan konteks tidak sesuai |
| T-03 | F03 | Retensi, auto-outdate, dan akses riwayat lintas konteks |
| T-04 | F03 | Friksi antar-minor dalam intent yang sama (kasus FYI v4.4 terhadap audit v4.5) |
| T-05 | F03 | Perlakuan migrasi doctor yang idempoten dan pembaruan index/referensi path |
| T-06 | F04 | Perlakuan PLAN LOCKED tanpa EXEC pasangan, atau pasangan ambigu, pada migrasi doctor |
| T-07 | F04 | Spesifikasi lengkap APPROVED: gate, validator, orientasi, makna "persetujuan EXEC langsung mengunci pasangan" |
| T-08 | F04 | Jalur operasional chain v1 dan penghapusan plan lock/exec lock (tombstone) |
| T-09 | F04 | Migrasi state opsional chain lama sebagai keputusan terpisah dari penomoran baru |
| T-10 | F05 | Urutan persetujuan, pencatatan, sertifikasi, commit, tag; penanganan kegagalan parsial |
| T-11 | F05 | Distribusi tag pada alur push manual Director |
| T-12 | F06 | Penyimpanan registry, kolom katalog, kebijakan file hilang/rename/benturan nama |
| T-13 | F06 | Cakupan validasi subfolder dan unregistered-notes; kompatibilitas nama command `sigma note` lama terhadap `sigma notes` |
| T-14 | F07 | Struktur final template setelah pilot; jumlah contoh brief (3 termasuk, 3 tidak termasuk) |
| T-15 | F01 | Seluruh butir ditahan menunggu feedback Director |
| T-16 | F10 | **TERKUNCI (Director, 6 Oktober 2026):** sejak Sigma v2 terpasang, setiap `intent new`, `plan new`, `exec new`, dan `close new` membuat file tanpa prefix role. Artefak lama tetap berprefix dan tidak diganti nama. Semua operasi yang bergantung pada pengecekan nama file menerima nama dengan maupun tanpa prefix |
| T-17 | F06 | `diskusi_rencana_perubahan_sigma_v2.md` memiliki perubahan belum di-commit (bukan dari asisten) yang membalik struktur notes (`unregistered-notes/`, `note-list/`, `note-list.md` menjadi `LEGACY/`, `notes-list.md`). Menunggu kepastian versi yang berlaku |

## 6. Disiplin kerja dan build (tentatif)

- Tahap rencana hanya menulis file Markdown di folder ini. Tidak ada build, uji, atau perubahan source.
- Setiap build di repo ini langsung mengubah perilaku sigma-mcp di seluruh host (symlink global). Titik build dan uji pada tahap implementasi ditetapkan di rencana tiap fokus dan disetujui Director sebelum dijalankan.
- Verifikasi kode pada tahap rencana bersifat read-only. Perintah CLI Sigma yang dapat menulis state atau log tidak dijalankan untuk reproduksi.
- Pembaruan dokumen ini: setiap fokus yang selesai disusun mengubah baris statusnya dan menutup/menambah butir register.

## 7. Keputusan Director dari review dokumen (6 Oktober 2026)

Jalur eksekusi tiga target: **ARC memory, ARC rule, INTENT template**. Eksekusi dimulai setelah Director menyelesaikan review INTENT template dan ARC memory, lalu menyetujui rencana eksekusi secara eksplisit.

**Review ARC-RULE (9 butir, [artifact_sigma_review_director.md](artifact_sigma_review_director.md)) - tujuh jawaban Director:**

| No | Keputusan |
|---|---|
| 1 | "Tier" sebagai source tier Research Mode dan skala skor bertingkat dipertahankan; yang dihapus hanya tier Sovereign/Challengeable (Operationalization) |
| 2 | Sejak Sigma v2 terpasang, `intent new`, `plan new`, `exec new`, dan `close new` membuat artefak tanpa prefix role, di proyek baru maupun lama. Artefak lama tetap berprefix; semua operasi yang memeriksa nama file menerima keduanya (T-16). Ditambahkan sebagai fokus F10 |
| 3 | Rujukan nomor section lintas dokumen diganti rujukan berbasis nama; ID gate (misalnya Gate 3.5) tetap |
| 4 | ARC-RULE dieksekusi dalam dua batch: A (butir 1-4, 9) dan B (butir 5-8, mengikuti penutupan T-10/T-11 di F05). Urutan antar implementasi tidak dipersoalkan selama seluruh permintaan Director terimplementasi |
| 5 | "Intent versi terbaru" berarti isi INTENT pada chain aktif; proyek tanpa Git lokal tidak dapat menjalankan amandemen |
| 6 | Susun ulang urutan section ARC-RULE: edit konten dahulu, penyusunan ulang terpisah, dengan kerangka urutan baru untuk persetujuan dan tabel keterlacakan MUST/MUST NOT |
| 7 | Perubahan INTENT template mencakup perubahan kode (validator `docCheck.ts` dan terkait) agar tetap selaras; build/uji mengikuti disiplin di bagian 6 |

Konsekuensi: eksekusi INTENT template menyentuh kode dan build sigma-mcp (symlink global), sehingga titik build dan uji disepakati dalam rencana eksekusi.

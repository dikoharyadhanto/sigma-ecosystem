# Bug Report: Konversi CRLF pada checkout Windows memicu UNCERTIFIED_EDIT dan STALE_INTENT

| Field | Nilai |
|:--|:--|
| Tanggal | 2026-10-15 |
| Proyek | JLH (KLHK_JasaLingkunganHidup), rantai INTENT v7 |
| Dilaporkan oleh | DEV, atas persetujuan Director |
| Lingkungan | Windows 11 Pro 10.0.26200, Git 2.55.0.windows.5, `core.autocrlf=true`, tanpa `.gitattributes` |
| Komponen | `sigma intent baseline adopt`, pemeriksaan sertifikasi INTENT, pemeriksaan `STALE_INTENT` pada PLAN |
| Dampak | Gate 2 tertutup. PLAN v7.1 (APPROVED) dan EXEC v7.1 (DRAFT) diblokir sampai PLAN ditinjau ulang terhadap INTENT revision 2, padahal konten INTENT tidak berubah. |
| Status | Diperbaiki di cabang `fix/crlf-hash-normalization` (belum di-commit, `dist` belum dibangun). Lihat bagian "Perbaikan" di bawah. |

## Ringkasan

Intent Doc disahkan dan disertifikasi di Fedora (akhir baris LF). Setelah repositori di-checkout di Windows dengan `core.autocrlf=true`, berkas kerja berakhiran CRLF dan hash SHA-256 berbeda dari hash tersertifikasi, walaupun konten identik. Sigma membaca selisih ini sebagai `UNCERTIFIED_EDIT`. Menyelesaikannya dengan `intent baseline adopt --import-current` menaikkan INTENT ke revision 2, dan PLAN yang masih mengacu revision 1 menjadi `STALE_INTENT`. Revisi baru tidak berisi perubahan konten.

## Bukti

Seluruh nilai berikut dibaca langsung dari repositori; tidak ada yang diubah.

| Butir | Nilai |
|:--|:--|
| Hash tersertifikasi saat pengesahan (revision 1, commit `68b650b`, `certification`) | `89550d78ec459289e3003b7dcd65346d124fe171515feff1e96d426ef49b81e6` |
| Hash blob `Sigma/charter/INTENT-v7.md` di HEAD | `89550d78…81e6` (sama dengan revision 1) |
| Hash berkas kerja Windows | `9dff6c5af6f6f17f9311bbed1d77db09d0cbdfe0161fb9d719292516b0810545`, 345 karakter CR |
| Hash berkas kerja setelah CR dibuang | `89550d78…81e6` (sama dengan revision 1) |
| `git diff 68b650b HEAD -- Sigma/charter/INTENT-v7.md` | kosong |
| Commit terakhir yang menyentuh INTENT-v7.md | `4038df5`, 13:27:36 +0700, sebelum pengesahan 13:31:59 +0700 |

Urutan peristiwa (dari `Sigma/.mcp-control/idempotency/` dan `audit.jsonl`, waktu UTC, peran Director, kanal CLI):

| Waktu | Operasi | Hasil | Pesan galat atau keterangan |
|:--|:--|:--|:--|
| 13:44:26 | `intent_baseline_adopt` | gagal, `rolled_back` | `UNCERTIFIED_EDIT: the INTENT file differs from its certified content and no Git baseline can prove the certified content. ... re-run with --import-current` |
| 13:45:25 | `intent_baseline_adopt` | gagal, `rolled_back` | `Sigma/charter/INTENT-v7.md has uncommitted changes` |
| 13:45:44 | `intent_baseline_adopt` | `committed` | Baseline `50f328c978be`, tag `sigma/intent-v7-base`, `doc_sha256=9dff…0545`, `doc_sha256_lf=89550d78…81e6`, revision 2, provenance `imported_current` |

Keadaan setelahnya (`sigma plan status` dan `sigma exec status`):
- `progress-v7.json`: `certified_doc_sha256 = 9dff…0545`, `revision = 2`, `revision_provenance = imported_current_certification`.
- PLAN v7.1: `intent_revision_ref = 1`, `needs_intent_review = true`, blocker `STALE_INTENT: PLAN must review the current INTENT through plan revise.`
- `gate_2_open = false`.

## Analisis

Terverifikasi:
- Berkas kerja dan blob git berbeda hanya pada akhir baris. Konten identik dengan yang disertifikasi.
- Sertifikasi revision 2 mengunci hash CRLF, bukan hash LF yang menjadi hash sertifikasi awal.
- Baseline merekam kedua hash (`doc_sha256` dan `doc_sha256_lf`).

Inferensi, belum diverifikasi:
- Galat kedua (`has uncommitted changes`) kemungkinan juga berasal dari perbedaan akhir baris, karena `git status` tidak melaporkan perubahan pada INTENT-v7.md. Cara pemeriksaan kebersihan pohon kerja belum dibaca dari kode.
- Pemeriksaan di host LF (Fedora) terhadap sertifikasi revision 2 dapat gagal kembali atau lolos melalui `doc_sha256_lf`. Belum diuji.
- Dokumen tersertifikasi lain (PLAN, EXEC, ledger) dapat terpengaruh dengan cara yang sama. `plan status` saat ini tidak melaporkan ketidakcocokan hash untuk keduanya.

## Perilaku yang diharapkan

1. Pembandingan hash dokumen tersertifikasi tidak bergantung pada konversi akhir baris yang dilakukan Git (`core.autocrlf`) pada checkout, atau membandingkan keduanya dan menganggap cocok bila salah satu sama.
2. Selisih yang hanya berupa akhir baris tidak menghasilkan `UNCERTIFIED_EDIT` dan tidak mengharuskan adopsi baseline.
3. Bila adopsi tetap diperlukan, adopsi yang tidak mengubah konten (hash LF sama) tidak menaikkan revision yang dibaca PLAN sebagai perubahan INTENT, atau menyediakan jalur peninjauan tanpa delta.

## Arah perbaikan yang dapat dipertimbangkan

Keputusan ada pada pemilik Sigma.
- Normalisasi akhir baris sebelum menghitung hash sertifikasi, dan simpan hash ternormalisasi sebagai hash utama.
- `sigma doctor` memperingatkan bila `core.autocrlf=true` pada proyek yang memiliki dokumen tersertifikasi, dan menyarankan `.gitattributes` (misalnya `Sigma/** text eol=lf`).
- Pesan galat `UNCERTIFIED_EDIT` menyebut kemungkinan perbedaan akhir baris dan menampilkan hash LF di samping hash mentah.
- Dokumentasikan bahwa `intent baseline adopt --import-current` menaikkan revision dan membuat PLAN APPROVED menjadi `STALE_INTENT`, supaya Director tahu akibatnya sebelum menjalankannya.

## Langkah reproduksi (belum dijalankan ulang)

1. Sahkan Intent Doc di host LF (`sigma intent ratify`), commit, push.
2. Clone atau pull di Windows dengan `core.autocrlf=true`.
3. Jalankan `sigma intent baseline check` atau `sigma intent baseline adopt`.
4. Jalankan `sigma plan status` dan perhatikan `STALE_INTENT` setelah adopsi berhasil.

## Penanganan di proyek

Bukan bagian laporan produk, dicatat untuk konteks. DEV mengirim pesan ke FMN meminta peninjauan PLAN v7.1 terhadap INTENT revision 2 lewat `plan revise`. Perbaikan `.gitattributes` di repositori proyek menunggu keputusan Director.

## Perbaikan (2026-10-16)

Terverifikasi dengan tes (CLI terhadap build sementara, bukan `dist` global):
- Penyebab: hash sertifikasi dihitung dari byte mentah. Perbandingan sekarang memakai `matchesCertified` ([src/engine/docHash.ts](../src/engine/docHash.ts)), yang menerima hash mentah, hash LF, dan hash CRLF, sehingga sertifikasi lama (LF dari Fedora, CRLF dari Windows) tetap valid di kedua host tanpa migrasi.
- Sertifikasi baru menyimpan hash LF. `currentIntent` mengembalikan hash tersertifikasi yang tersimpan, jadi acuan PLAN tidak berubah antar host.
- Inferensi laporan yang kini terverifikasi: ledger, snapshot, dan notice PLAN juga gagal pada checkout CRLF (`PLAN ledger hash mismatch`, `Snapshot hash mismatch`). Sudah diperbaiki dengan toleransi yang sama.
- Perilaku yang diharapkan 1–3 terpenuhi: selisih akhir baris saja bukan `UNCERTIFIED_EDIT`; adopsi pada checkout CRLF tidak memerlukan `--import-current` dan tidak menaikkan revision. Pesan galat menampilkan hash mentah dan LF; `sigma doctor` memperingatkan `core.autocrlf=true` tanpa `eol=lf`.
- Tidak diperbaiki surut: rantai yang sudah menjalankan `--import-current` (revision 2 di JLH) tetap pada revision 2; PLAN APPROVED-nya tetap perlu `plan revise`.

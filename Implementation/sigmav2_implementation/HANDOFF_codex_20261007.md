# Handoff ke Codex - Sigma v2, 7 Oktober 2026

Ditulis untuk: Codex (sesi pengembang Sigma yang melanjutkan), dari sesi Claude yang mengerjakan F14, E04, dan E05.

## 1. Keadaan repo

- Repo `I:\Works\Project\sigma-ecosystem`, branch `main`, HEAD `8bdc540` (F14 sudah di-commit Director).
- Belum di-commit (menunggu instruksi Director): `Sigma/rules/AUD-RULE.md`, `Sigma/role-memory/aud-memory.json`, empat skill AUD (`setup/targets/{claude_code/aud.md, codex/aud/SKILL.md, reasonix/aud.md, antigravity/sigma-aud/SKILL.md}`), dan dokumen baru `E04_cek-konsistensi-aud.md`, `E05_prompt-aud-web_draf.md`, berkas ini.
- Tes terakhir: 67 file / 907 test lulus. Perubahan E04 hanya teks rules, skill, dan memory; tidak ada build tertunda.
- Teks "belum di-commit" pada baris F14 di F00 dan pada status F14 sudah usang. Perbaiki bersama commit berikutnya.

## 2. Yang sudah selesai

E01 sampai E03 (INTENT schema 5 + ARC, PLAN schema 3 + FMN, EXEC schema 3 + DEV), E01B, F11 (Writing Style Rules untuk ARC, FMN, DEV), F13 (workspace DEV), F14 (penghapusan HUMAN dan Notion; ringkasan di F14 bagian 12), E04 (konsistensi AUD terhadap perubahan itu, ditambah Session Isolation Rule dan Reference Requests, keduanya permintaan Director), E05 (prompt AUD untuk Claude chat web dan ChatGPT chat web; Director menyalinnya manual, versi final ada di E05 bagian 3).

## 3. Aturan kerja Director (berlaku untuk Anda)

1. Bahasa Indonesia, formal, padat. Tanpa pembuka atau penutup kosong dan tanpa pujian.
2. Rencana dulu, eksekusi setelah persetujuan eksplisit. "Oke" atau "noted" bukan persetujuan untuk tindakan berdampak besar.
3. Pembedaan label: fakta terverifikasi, konsensus, opini, spekulasi. Hasil "tidak ditemukan" bersifat sementara sampai dicek independen.
4. Ambiguitas: sebutkan, beri opsi dan rekomendasi singkat, tunggu jawaban.
5. Commit hanya atas instruksi Director. Build dilaporkan lebih dulu: `sigma-mcp` terpasang lewat symlink global dan `dist/` dilacak Git.
6. Dilarang tanpa instruksi: sinkronisasi ke `~/.sigma` atau proyek (F09), perubahan Constitution (butuh deklarasi amandemen eksplisit, Article VIII), perubahan Protocol, perubahan `SCHEMA_VERSION`.
7. Rules tidak menyebut nomor section, nama section yang berelasi ke template, atau prefix role (pakai INTENT, PLAN, EXEC, CLOSE). Writing Style Rules tidak berlaku untuk AUD.
8. Satu fokus per giliran. Setiap fokus berakhir dengan keputusan terbuka dan rekomendasi, lalu menunggu Director.

## 4. Urutan pekerjaan yang disetujui

F00 (berjalan), F02, F03, F04, F05, F06, F01 (DITAHAN, menunggu feedback Director), F07, F08, F09. F10, F12, F15 belum berurutan.

- **F02** (penomoran chain dan warning bootstrap) adalah berikutnya. F03 bergantung padanya. Mulailah dari `Discussion/Evaluation-06102026/diskusi_rencana_perubahan_sigma_v2.md`, verifikasi ulang nomor baris pada kode saat ini, dan susun dokumen dengan struktur F00 bagian 3. Tidak ada kode diubah sebelum rencana disetujui.
- **F15** (usulan, belum disetujui): amandemen Constitution dari audit ChatGPT di `artifact_sigma_review_director.md` (bagian CONSTITUTION). Director mengikuti sebagian besar hasil audit, tetapi tiap perubahan perlu deklarasi eksplisit. Prioritas ke-5 audit (Sovereign vs Operationalization) kemungkinan dipengaruhi prompt AUD lama yang mengajarkan kerangka tier; nilai ulang, dan kerjakan bersama F05.
- **Protocol dikerjakan paling akhir.** Setiap fokus mencatat butir perubahan Protocol di dokumennya; daftar yang sudah ada ada di E04 bagian 7.

## 5. Keputusan Director yang masih terbuka

- Instruksi commit untuk E04 dan E05.
- E05 butir E-2 sampai E-5 (sumber aturan tunggal untuk prompt AUD web, penilaian ulang prioritas ke-5 Constitution, lokasi berkas prompt).
- Aturan kedalaman hasil audit: ditunda atas keputusan Director ("bukan masalah"); jangan dikerjakan tanpa permintaan baru.
- Salinan AUD di luar repo (`~/.sigma`, skill terpasang, AUD eksternal) belum memuat aturan baru sampai F09.

## 6. Catatan teknis

- Berkas rules dan template memakai CRLF pada sebagian berkas; jaga akhir baris saat menyunting. Di Windows, jalankan Python dengan `PYTHONUTF8=1`.
- `tsc` tidak menghapus keluaran dari sumber yang dihapus; hapus berkas `dist/` basi secara eksplisit.
- Test CLI memakai `dist/`: jalankan build sebelum `npm test` bila kode berubah.
- Temuan lama di luar cakupan: `dist/engine/progress.js` basi; `refresh-registries:dry` melaporkan 7 operasi belum terdaftar (`config_set_mailbox_outdate_keep`, `config_set_memo_limit`, `control_show`, `control_approve`, `control_reject`, `inbox_clear`, `intent_lock`); baris template HUMAN pada F01 daftar periksa menunjuk berkas yang sudah dihapus; template CLOSE masih merujuk "Desired Outcome (1.4)" dan "Success criteria (3.1)" yang tidak ada lagi di INTENT (CLOSE tidak direview, hanya dicatat).
- Kredensial Notion sudah dicabut dan dihapus Director.

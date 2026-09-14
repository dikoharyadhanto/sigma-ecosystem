# PLAN-IMPL — Humanize Technical Detail Levels

**Status:** DRAFT — menunggu review Director. Belum ada perubahan pada skill, command, template, atau konfigurasi yang diterapkan.

**Tujuan:** Menambahkan kontrol eksplisit atas kedalaman detail teknis pada skill `/humanize`, tanpa mengubah fakta sumber, batasan kesetiaan makna, atau larangan terminologi internal.

## 1. Keputusan yang Sudah Ditetapkan

1. Skill mendukung tiga level detail teknis: `LOW`, `BALANCE`, dan `HIGH`.
2. Jika level tidak disebutkan saat `/humanize` diaktifkan, gunakan `BALANCE`.
3. Level yang sudah dipilih tetap dipakai selama rangkaian revisi dokumen itu. Perubahan level membutuhkan instruksi eksplisit Director.
4. Larangan seluruh terminologi Sigma berlaku mutlak pada `LOW`, `BALANCE`, dan `HIGH`.
5. Level teknis mengatur banyaknya dan kedalaman detail yang ditampilkan. Level tersebut tidak boleh mengubah keputusan, status, risiko, keterbatasan, atau tingkat kepastian yang didukung sumber.

## 2. Masalah yang Diselesaikan

Aturan `/humanize` saat ini menjelaskan pembaca, kejelasan, dan penggunaan istilah teknis secara umum. Aturan tersebut belum memberi kontrak yang cukup spesifik untuk membedakan kebutuhan pembaca umum, pembaca lintas fungsi, dan reviewer teknis.

Akibatnya, dua keluaran yang sama-sama mengikuti aturan gaya dapat memiliki kedalaman teknis yang tidak konsisten. Pembaca umum dapat menerima detail implementasi yang tidak dibutuhkan. Reviewer teknis dapat menerima ringkasan yang terlalu abstrak untuk mengevaluasi desain atau risiko.

Perubahan ini memberi AI arah yang eksplisit sebelum menyusun atau merevisi dokumen.

## 3. Kontrak Perilaku Baru

### 3.1 Bentuk Aktivasi

Level ditulis setelah aktivasi skill, misalnya:

```text
/humanize LOW
/humanize BALANCE <file atau section>
/humanize HIGH this
```

Alias aktivasi yang setara pada target lain mengikuti konvensi target tersebut. Nilai kanonis yang ditampilkan dan dicatat dalam instruksi adalah huruf besar: `LOW`, `BALANCE`, `HIGH`.

Jika level tidak diberikan, AI wajib menyatakan atau menerapkan `BALANCE` sebagai level aktif. Untuk revisi terhadap dokumen yang sudah dikerjakan dalam konteks yang sama, level sebelumnya dipertahankan sampai Director meminta level lain secara eksplisit.

### 3.2 Invariant yang Tidak Berubah

Setiap level tetap tunduk pada aturan berikut:

- Preserve/Compress/Rephrase/Infer: keputusan, status, risiko, keterbatasan, dan ketidakpastian material dipertahankan; inferensi baru dilarang.
- Detail lebih banyak tidak boleh dipakai untuk menciptakan kesan kepastian atau kelengkapan yang tidak didukung sumber.
- Terminologi internal Sigma, nama artefak, role, state, gate, command, dan istilah state-machine tetap tidak boleh muncul dalam keluaran.
- Dokumen artefak formal tidak boleh ditulis ulang di tempat oleh skill ini. Humanize tetap menghasilkan atau memperbarui dokumen terpisah yang ditujukan bagi pembaca manusia.

### 3.3 Definisi Level

| Level | Pembaca utama | Detail yang disertakan | Detail yang biasanya dihilangkan |
| :--- | :--- | :--- | :--- |
| `LOW` | Pengguna umum, stakeholder nonteknis, atau pembaca yang hanya perlu memahami hasil | Tujuan, hasil, cara pakai, dampak, keputusan yang memengaruhi pembaca, risiko atau batasan yang perlu ditindaklanjuti | Nama komponen, struktur internal, algoritma, interface, dan mekanisme implementasi yang tidak mengubah keputusan pembaca |
| `BALANCE` | Stakeholder lintas fungsi, product/operations, atau pembaca dengan pemahaman teknis ringan | Hasil, alasan teknis utama, alur kerja ringkas, komponen penting pada tingkat konseptual, trade-off, risiko, dan bukti verifikasi yang relevan | Detail kode, konfigurasi tingkat rendah, dan uraian implementasi yang tidak diperlukan untuk memahami keputusan atau dampak |
| `HIGH` | Pengembang, arsitek, dan reviewer teknis | Arsitektur, alur data atau kontrol, interface, dependensi, asumsi, keputusan teknis, trade-off, failure mode, batasan, dan bukti verifikasi | Detail sumber yang tidak material terhadap pemahaman, review, atau keputusan teknis; istilah internal Sigma tetap dilarang |

`HIGH` tidak berarti menyalin seluruh sumber. Kompresi masih diterapkan terhadap pengulangan, metadata mekanis, dan rincian yang tidak material. Sebaliknya, `LOW` tidak boleh menghapus risiko, keterbatasan, atau keputusan yang perlu dipahami pembaca.

### 3.4 Pengecualian Per Bagian

Satu dokumen dapat memakai level utama dan pengecualian per bagian bila Director menyatakannya secara eksplisit. Contoh: ringkasan utama `LOW` dengan appendix teknis `HIGH`.

AI tidak boleh menciptakan pengecualian ini berdasarkan asumsi sendiri. Jika target pembaca atau kebutuhan detail tidak jelas, level default tetap `BALANCE` sampai Director mengubahnya.

## 4. Cakupan Implementasi

### 4.1 Berkas Normatif

Aturan level teknis ditambahkan ke seluruh implementation vehicle skill berikut, dengan isi normatif yang setara:

| Target | Berkas |
| :--- | :--- |
| Claude Code | `setup/targets/claude_code/humanize.md` |
| Codex | `setup/targets/codex/humanize/SKILL.md` |
| Reasonix | `setup/targets/reasonix/humanize.md` |
| Antigravity | `setup/targets/antigravity/sigma-humanize/SKILL.md` |

Perubahan harus memperbarui bagian Activation, Target Audience & Purpose, dan Writing Rules atau section baru `Technical Detail Level`. Terminologi dan frontmatter khusus tiap target dipertahankan.

### 4.2 Distribusi

Mapping `humanize` pada `src/commands/setup.ts` sudah terdaftar untuk Claude Code, Codex, Reasonix, dan Antigravity. Implementasi harus memverifikasi bahwa `sigma setup install` dan `sigma setup update` mendistribusikan versi baru tanpa perubahan mapping yang tidak diperlukan.

Skill yang sedang aktif di lingkungan operator dapat berasal dari lokasi deployment lokal. Pembaruan source repository dan pembaruan deployment adalah dua langkah terpisah. Rencana ini tidak mengasumsikan bahwa mengubah satu berkas source langsung mengubah semua skill yang sudah terpasang.

### 4.3 Di Luar Cakupan

Perubahan ini tidak mengubah:

- command `intent humanize`, `exec humanize`, atau `close humanize`;
- template proyeksi human dan Fidelity Ledger;
- mekanisme terminology scanner, fidelity coverage, gate lifecycle, atau Notion push;
- aturan otorisasi, lifecycle, dan artefak formal;
- Git workflow proyek.

Perubahan pipeline baru hanya dipertimbangkan bila Director kemudian meminta agar level teknis dicatat sebagai metadata atau dipaksa oleh CLI. Kebutuhan tersebut belum ditetapkan dan tidak termasuk implementasi awal.

## 5. Rencana Eksekusi

### Fase 1 — Tambahkan Kontrak Level pada Skill Kanonis

1. Tambahkan sintaks aktivasi dengan level opsional.
2. Tambahkan aturan default `BALANCE`.
3. Tambahkan definisi operasional `LOW`, `BALANCE`, dan `HIGH`.
4. Tambahkan aturan persistensi level dalam rangkaian revisi.
5. Tegaskan bahwa larangan terminologi Sigma berlaku pada seluruh level.
6. Tegaskan bahwa level tidak dapat mengalahkan invariant anti-inferensi dan preservasi ketidakpastian.

### Fase 2 — Sinkronkan Semua Target Skill

1. Port aturan normatif yang sama ke empat target yang didukung.
2. Adaptasikan hanya sintaks aktivasi dan struktur frontmatter yang memang berbeda per target.
3. Bandingkan isi normatif antar-target untuk mencegah satu target memiliki definisi level yang berbeda.

### Fase 3 — Verifikasi Distribusi dan Regresi

1. Verifikasi mapping setup masih memuat seluruh target skill.
2. Jalankan setup/update pada lingkungan uji atau periksa artefak deployment yang dihasilkan, tanpa menimpa konfigurasi personal secara tidak sengaja.
3. Pastikan perubahan tidak mengubah command Humanize, template, scanner, atau gate yang sudah ada.

## 6. Test Contract

### 6.1 Pemeriksaan Otomatis

Tambahkan regression test statis yang memeriksa seluruh target skill memuat:

- tiga nilai kanonis `LOW`, `BALANCE`, dan `HIGH`;
- default `BALANCE` bila level tidak disebutkan;
- aturan perubahan level hanya melalui instruksi eksplisit Director;
- larangan terminologi Sigma pada semua level;
- invariant Preserve/Compress/Rephrase/Infer.

Test juga harus memastikan mapping `humanize` di setup masih merujuk ke berkas target yang benar.

### 6.2 Pemeriksaan Manual Berbasis Contoh

Gunakan satu sumber fakta yang sama untuk membuat tiga contoh keluaran. Review harus membuktikan:

| Pemeriksaan | LOW | BALANCE | HIGH |
| :--- | :--- | :--- | :--- |
| Fakta, risiko, dan ketidakpastian material tetap ada | Wajib | Wajib | Wajib |
| Kedalaman implementasi bertambah sesuai level | Minimum yang relevan | Konseptual | Mendalam dan relevan untuk review teknis |
| Terminologi Sigma tidak muncul | Wajib | Wajib | Wajib |
| Fakta atau kesimpulan baru tidak muncul | Wajib | Wajib | Wajib |

Jalankan `sigma scan --file <path>` pada setiap contoh keluaran sebagai bukti tambahan terhadap larangan terminologi sebelum file dibagikan atau dipublikasikan.

### 6.3 Regresi Sistem

Jalankan `npm run build` dan `npm test`. Semua test Humanize yang sudah ada harus tetap lulus karena command dan pipeline tidak berubah.

## 7. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
| :--- | :--- | :--- |
| `HIGH` ditafsirkan sebagai izin menambah fakta atau menyertakan seluruh detail sumber | Keluaran menjadi tidak setia atau sulit dibaca | Tegaskan anti-inferensi dan kompresi tetap berlaku pada semua level |
| `LOW` menghilangkan batasan atau risiko penting | Pembaca menerima gambaran yang menyesatkan | Jadikan preservasi risiko dan ketidakpastian sebagai invariant lintas level |
| Definisi level berbeda antar tool | Perilaku Humanize tidak konsisten | Tambahkan test parity terhadap seluruh target skill |
| Istilah internal muncul karena konteks teknis | Keluaran tidak aman untuk dibagikan | Pertahankan larangan absolut dan scan sebelum publikasi |
| Level berubah tanpa instruksi dalam rangkaian revisi | Dokumen berubah arah dan sulit direview | Simpan level aktif dalam konteks kerja dan ubah hanya atas instruksi eksplisit Director |

## 8. Kriteria Selesai

Implementasi dinyatakan selesai bila:

- seluruh target skill mendefinisikan tiga level secara konsisten;
- `BALANCE` tercatat sebagai default;
- aturan perubahan level dan larangan terminologi lintas level jelas;
- test parity baru lulus;
- `npm run build` dan `npm test` lulus;
- deployment hanya dilakukan setelah Director memberi instruksi eksplisit untuk memperbarui lingkungan aktif.

## 9. Keputusan yang Masih Terbuka

Tidak ada keputusan desain tambahan yang diperlukan untuk implementasi awal terkait pipeline, metadata, atau CLI. Rencana ini sengaja tidak menambahkan metadata level ke state proyek atau ke command CLI. Jika Director menginginkan level yang dapat dilacak dan divalidasi secara mekanis pada masa depan, itu harus dibuka sebagai cakupan terpisah.

Tiga celah spesifikasi ditemukan saat review pra-implementasi (2026-09-12) dan diselesaikan sebagai berikut:

1. **Penempatan konten dalam berkas skill.** Sintaks aktivasi level (`/humanize LOW|BALANCE|HIGH`) ditambahkan ke section `Activation` yang sudah ada. Definisi operasional tiga level, tabel pembaca/detail, dan aturan pengecualian per-bagian ditempatkan sebagai section baru "Technical Detail Level", setelah "Four Operations On Source Content" dan sebelum "Writing Rules" — karena level adalah parameter yang mengatur intensitas penerapan Writing Rules di bawahnya.
2. **Pemisahan dua jenis ambiguitas.** Section `Activation` sudah memiliki aturan "ask once" untuk ambiguitas target (file/section mana). Ditambahkan satu kalimat eksplisit yang memisahkan ambiguitas level dari ambiguitas target: level yang tidak disebut selalu default ke `BALANCE` tanpa bertanya; hanya ambiguitas target yang ditanyakan.
3. **Mekanisme test parity.** Tidak ada test existing yang membandingkan isi antar-target `setup/targets/*/humanize*`. Test baru ditulis di `test/humanize-detail-level-parity.test.ts` (terpisah dari `humanize-fase*.test.ts` yang menguji pipeline `sigma intent/exec/close humanize` yang berbeda). Mekanisme: cek keberadaan substring wajib per berkas (tiga label level, aturan default `BALANCE`, aturan larangan ubah level tanpa instruksi eksplisit, referensi larangan terminologi Sigma lintas level) — bukan diff literal antar-berkas, karena token aktivasi (`/humanize` vs `#humanize`) dan `name:` frontmatter (`humanize` vs `sigma-humanize`) sah berbeda antar-target.

## 10. Catatan Eksekusi

Atas instruksi Director (2026-09-12), Fase 1 dieksekusi terlebih dahulu **hanya untuk target Claude Code** (`setup/targets/claude_code/humanize.md`), pada level source repository proyek ini — bukan deployment global. Sinkronisasi ke Codex, Reasonix, dan Antigravity (Fase 2), penulisan test parity (Fase 3), serta setiap `sigma setup install`/`update` ditahan sampai Director meninjau hasil perubahan pada target Claude Code.

**Catatan tambahan (di luar cakupan plan ini):** Pada berkas Claude Code yang sama, Director juga meminta penegasan invariant baseline aktivasi `/humanize` yang tidak terkait level teknis — dicatat di sini untuk keterlacakan, bukan bagian dari kontrak level:

- `/humanize` tidak boleh aktif diam-diam atau menjadi mode selalu-aktif lintas file lain yang tidak ditunjuk Director dalam sesi yang sama.
- Aktivasi tidak boleh disimpan sebagai memori AI persisten lintas sesi.
- Sekali sebuah file spesifik diaktifkan `/humanize` dalam suatu sesi, revisi berikutnya terhadap file itu sendiri (dalam sesi yang sama) tetap otomatis memakai skill ini tanpa mengulang kata aktivasi — persistence ini terkunci pada file tersebut, tidak menyebar ke file lain.

Ditambahkan sebagai paragraf "Activation Scope" di section Activation, `setup/targets/claude_code/humanize.md`. Belum diporting ke tiga target lain — mengikuti staged rollout yang sama dengan kontrak level di atas.

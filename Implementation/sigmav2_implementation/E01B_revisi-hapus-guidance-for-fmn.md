# E01B - Revisi E01: hapus section Guidance for FMN dari INTENT schema 5

Tanggal: 7 Oktober 2026
Status: SELESAI dieksekusi 7 Oktober 2026 (W0-W5), belum di-commit (menunggu instruksi Director, D-4). Baseline 70 file / 922 test; setelah perubahan, satu build `tsc` bersih dan `npm test` 70 file / 923 test lulus (+1 test baru D-2). Grep: rujukan tersisa hanya di dokumen sejarah (E01, F00), E01B, E02, dan test D-2.
Urutan: E01B dikerjakan dan selesai (termasuk build dan `npm test`) **sebelum** E02 dimulai. E02 W1 tidak dijalankan sebelum E01B selesai.
Dasar: keputusan Director 7 Oktober 2026 ("Hapus guidance"), yang membuka kembali keputusan review INTENT no. 5 (F00 bagian 7) dan hasil E01 (commit 8d20c4b).

## 1. Cakupan

Dikerjakan: menghapus section Guidance for FMN dari INTENT schema 5 pada template, validator, test, dan ARC-RULE.
Tidak dikerjakan: Quality Standards di INTENT (tetap), perubahan lain pada INTENT schema 5, ARC skill dan memory (tidak memuat rujukan; terverifikasi), sinkronisasi ke `~/.sigma` dan proyek (F09), seluruh pekerjaan E02.

## 2. Alasan (keputusan Director)

Guidance for FMN berisi arahan ARC kepada FMN tentang fokus eksekusi. Fokus eksekusi adalah keputusan tahap implementasi, milik FMN. Tempat yang benar adalah ROADMAP (milik FMN): Overview, Core Process Flow, dan Planned Stage disusun FMN dengan merujuk INTENT yang terkunci, dan plan pertama selalu bersumber dari ROADMAP. Guidance for FMN menjadi kebocoran peran: ARC masuk ke tahap implementasi, dan karena FMN tunduk pada INTENT, arahan itu mengikat. Isi section tidak unik: lingkup dan contoh uji batas ada di Scope dan Director Summary, standar kualitas di Quality Standards, hal yang diwaspadai di Assumptions and Risks.

## 3. Fakta terverifikasi (grep seluruh repo, 7 Oktober 2026)

| Lokasi | Rujukan |
|---|---|
| [DIR-INTENT-TEMPLATE.md](../../Sigma/templates/DIR-INTENT-TEMPLATE.md) baris 166-177 (termasuk pemisah `---`) | marker `GUIDANCE_FOR_FMN`, heading, kalimat petunjuk, tabel Focus Area/Why It Matters/Watch-Out |
| [docCheck.ts](../../src/utils/docCheck.ts) baris 139 dan 154 | `INTENT_SPEC_V5`: daftar `requiredSections` dan `sectionOrder` |
| `dist/utils/docCheck.js` baris 69 dan 84 | hasil build; berubah hanya lewat `tsc` |
| [test/helpers.ts](../../test/helpers.ts) baris 527-528 | dokumen INTENT schema 5 yang valid untuk test |
| [test/doc-check-intent-schema5.test.ts](../../test/doc-check-intent-schema5.test.ts) baris 127 | nama test "Research between Guidance for FMN and AUD Notes" |
| [ARC-RULE.md](../../Sigma/rules/ARC-RULE.md) baris 239 | butir "Guidance for FMN" pada panduan isi INTENT |

- Tidak ada rujukan pada skill ARC, memory ARC, FMN-RULE, Protocol, atau INTENT schema 4.
- Dokumen sejarah yang menyebut section ini (E01 baris 35, F00 baris 134-135, E02 B-2) tidak ditulis ulang kecuali yang ditetapkan di W4.
- Schema 5 belum berlaku: `~/.sigma/templates` masih schema 4. Tidak ada INTENT schema 5 di proyek mana pun, sehingga penghapusan tidak memerlukan kompatibilitas mundur.
- Section `Research` berada di antara `GUIDANCE_FOR_FMN` dan `AUD_NOTES` pada urutan saat ini. Setelah penghapusan, `Research` berada di antara `FUNCTIONAL_REQUIREMENTS` dan `AUD_NOTES`.

## 4. Rincian pekerjaan

### W0 - Baseline
`npm test` pada working tree bersih sebelum perubahan (pembanding: 70 file, 922 test lulus pada 7 Oktober 2026).

### W1 - Template
Hapus section Guidance for FMN (marker, heading, petunjuk, tabel, pemisah). Section lain tidak berubah.

### W2 - Validator dan test
1. `docCheck.ts`: hapus `GUIDANCE_FOR_FMN` dari `requiredSections` dan `sectionOrder` pada `INTENT_SPEC_V5`.
2. `test/helpers.ts`: hapus section dari dokumen schema 5 yang valid.
3. `doc-check-intent-schema5.test.ts`: ubah nama test menjadi "Research between Functional Requirements and AUD Notes is ok and order-valid". Tambah satu test: dokumen schema 5 yang masih memuat marker `GUIDANCE_FOR_FMN` menghasilkan peringatan "Unknown section markers" (mekanisme yang ada), tanpa gagal.
4. Tidak ada build pada W2.

### W3 - ARC-RULE
1. Hapus butir "Guidance for FMN" (baris 239).
2. Periksa ulang seluruh ARC-RULE untuk sisa rujukan "FMN" yang mengarahkan eksekusi (grep), dan laporkan temuan tanpa mengubahnya di luar butir 1.

### W4 - Catatan dokumen
- F00 bagian 7: tambah catatan bahwa keputusan review INTENT no. 5 (bagian "Guidance for FMN berdiri sebagai section tersendiri") dibatalkan oleh E01B. Baris asli tidak dihapus.
- E02: perbarui B-2 (aturan Quality Standards bersyarat di FMN-RULE; kewajiban membaca Guidance for FMN dihapus) dan tambahkan penanda bahwa E02 W1 menunggu E01B selesai.

### W5 - Build dan uji
Satu `npm run build` (mengubah `dist/utils/docCheck.js` dan berkas build terkait; berdampak ke sigma-mcp seluruh host) dan satu `npm test`. Hasil dilaporkan apa adanya. Tidak ada commit tanpa instruksi Director.

## 5. Risiko

- Build mengubah perilaku sigma-mcp di seluruh host. Perubahannya terbatas pada daftar section INTENT schema 5, yang belum dipakai proyek mana pun.
- Dokumen sejarah (E01, F00 baris asli) masih menyebut Guidance for FMN. Catatan di W4 mencegah pembaca menganggapnya masih berlaku.
- Menghapus section menghilangkan satu tempat ARC menyampaikan peringatan khusus ke FMN. Jalur penggantinya: Assumptions and Risks (risiko), Priorities and Constraints (prioritas Director yang mengikat), dan pesan `sigma send` ARC ke FMN setelah ratify (sudah menjadi aturan ARC-RULE). Pesan itu bukan bagian dari INTENT yang disertifikasi, sehingga hal yang harus mengikat FMN tidak boleh hanya ada di pesan.

## 6. Keputusan terbuka

**D-1.** DIJAWAB (Director, 7 Oktober 2026): tidak ada kalimat tambahan di ARC-RULE. Alasan Director: permintaan spesifik tentang eksekusi disampaikan langsung ke FMN, tidak lewat ARC. Pesan `sigma send` ARC setelah ratify (ARC-RULE §Trigger 1) tetap berlaku untuk catatan kunci; hal yang harus mengikat FMN ditulis di Priorities and Constraints.
Jawaban: opsi (b)

**D-2.** Dokumen schema 5 yang masih memuat marker `GUIDANCE_FOR_FMN`: (a) peringatan "Unknown section markers" lewat mekanisme yang ada; (b) gagal validasi.
Rekomendasi: (a). Tidak ada dokumen seperti itu di lapangan, dan gagal validasi menambah aturan tanpa kebutuhan.
Jawaban: DISETUJUI (Director, 7 Oktober 2026): opsi (a).

**D-3.** Satu build di W5 (rekomendasi) atau tanpa build sekarang dan build digabung dengan E02 W6. Rekomendasi: build di W5, sehingga `dist/` sesuai `src/` saat E02 dimulai.
Jawaban: DISETUJUI (Director, 7 Oktober 2026): build di W5.

**D-4.** Commit E01B terpisah dari E02 dan dari F00/E02 dokumen, atas instruksi Director. Rekomendasi: satu commit E01B sebelum E02 W1.
Jawaban: DISETUJUI (Director, 7 Oktober 2026): satu commit E01B sebelum E02 W1, atas instruksi Director.

## 7. Kriteria selesai

1. INTENT schema 5 lolos validator tanpa section Guidance for FMN; INTENT schema 4 tetap lolos (test).
2. Grep `Guidance for FMN` dan `GUIDANCE_FOR_FMN` hanya menemukan dokumen sejarah dan catatan di W4.
3. `npm test` hijau setelah build tunggal; hasil dilaporkan apa adanya.
4. E02 B-2 diperbarui dan E02 W1 menunggu E01B.

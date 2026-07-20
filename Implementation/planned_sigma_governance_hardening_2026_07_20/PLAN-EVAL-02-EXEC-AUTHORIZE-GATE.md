# PLAN-EVAL-02 — `sigma exec authorize` Runtime Gate

**Sumber**: [../../Discussion/sigma-bug-report-20260720-131540.md](../../Discussion/sigma-bug-report-20260720-131540.md) §7.4/§8.4 (DEV menilai sendiri apakah frasa Director cukup untuk mulai implementasi), diperkuat diskusi soal soft vs hard invariant.
**Tanggal**: 2026-07-20
**Status**: DRAFT — **ringkas, belum final**. Ini pemecahan pertama dari diskusi, bukan rencana implementasi detail. Perlu ronde desain terpisah (skema data, interaksi dengan test suite chain yang sudah ada) sebelum eksekusi kode — beda dengan PLAN-EVAL-01 yang sudah cukup detail untuk langsung dieksekusi.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

Saat ini `DEV-RULE.md` §7 (baris 411-429) menggerbang mulainya implementasi
lewat **pencocokan frasa natural language**: DEV membaca ucapan Director
("Go ahead and implement", dst.) dan menilai sendiri apakah itu "cukup".
Laporan bug (§7.4 DEV, dikonfirmasi diskusi lanjutan) menunjukkan ini rapuh —
frasa Director yang tidak persis cocok daftar contoh ("approved for begin
implementation") dinilai sendiri oleh DEV tanpa konfirmasi balik.

**Keputusan arah** (dari diskusi Director + analisis ChatGPT, hasil filter
"kelas pekerjaan mana yang realistis sekarang"): pindahkan keputusan ini dari
penilaian diam-diam di kepala model menjadi **aksi CLI eksplisit yang
tercatat**, `sigma exec authorize`, yang menulis flag terstruktur ke chain
state. Ini dikategorikan "Runtime Extension" (numpang pola `active_version`/
`active_state` yang sudah ada di `chain.ts`), **bukan** "Runtime Foundation"
baru seperti session-scoped memory enforcement (lihat README §Group C poin 4
— itu ditolak karena Sigma CLI belum punya konsep sesi sama sekali).

**Batasan penting yang harus jujur diakui**: ini **tidak menghilangkan**
penilaian AI atas ucapan Director — DEV tetap yang memutuskan kapan
menjalankan `sigma exec authorize`. Nilai nyatanya: (a) momen penilaian itu
jadi eksplisit dan ter-log di `operations.jsonl`, bukan langkah diam-diam
yang langsung diikuti aksi ireversibel (tulis kode), dan (b) command bisa
mencetak balik apa yang DEV anggap sebagai ucapan otorisasi sebelum
melanjutkan, membuka celah koreksi sebelum file source disentuh.

---

## Scope (sketsa awal, perlu didetailkan)

### Perubahan skema (`src/engine/chain.ts`)

`ArtifactVersion` (baris 23-32) mendapat field opsional baru:

```ts
implementation_authorized_at?: string; // ISO timestamp, hanya untuk domain exec
```

Diletakkan di level `ArtifactVersion` (bukan `ArtifactTracker`) karena
otorisasi implementasi bersifat per-versi DEV-EXEC — versi DEV-EXEC baru
(mis. setelah revisi FMN) butuh otorisasi baru, bukan mewarisi otorisasi versi
sebelumnya secara otomatis. **Ini perlu dikonfirmasi ulang saat ronde desain**
— alternatif: taruh di level tracker kalau ternyata otorisasi dimaksudkan
bertahan lintas versi DRAFT yang sama.

### Command baru (`src/commands/exec.ts`)

`sigma exec authorize --note "<ringkasan ucapan Director>"` — menandai versi
DEV-EXEC aktif (harus berstatus DRAFT) sebagai authorized. Menolak jika:
- Tidak ada DEV-EXEC aktif berstatus DRAFT.
- Sudah pernah di-authorize untuk versi yang sama (idempotent-safe: cetak
  pesan "already authorized at <timestamp>", tidak error keras).

### Perubahan output command yang sudah ada

- `sigma exec status` / `sigma exec check` — tambahkan baris
  `Implementation Authorization: AUTHORIZED (<timestamp>) / NOT YET
  AUTHORIZED`.
- `sigma session bootstrap --role dev` — tambahkan status ini ke bagian
  "Role-Permitted Routine Actions"/"Current Stop Point" (`src/commands/session.ts`,
  fungsi `getRoleGuidance` kasus `'DEV'`, baris 64-77), supaya DEV yang
  bootstrap ulang tidak perlu menyimpulkan status otorisasi dari histori chat.

### Perubahan `Sigma/rules/DEV-RULE.md`

§7 (baris 411-429) — ganti gerbang dari murni "Sufficient authorization:
[daftar frasa]" jadi dua lapis:
1. DEV tetap menilai apakah ucapan Director cukup (daftar frasa contoh
   dipertahankan sebagai panduan penilaian).
2. Begitu DEV menilai cukup, DEV **wajib** menjalankan `sigma exec
   authorize` sebelum menulis file source apa pun — bukan langsung menulis
   kode setelah penilaian mental selesai. `sigma exec check` sebelum
   merekomendasikan lock (aturan yang sudah ada) juga harus melaporkan status
   otorisasi ini.

---

## Di luar scope (untuk ronde desain, bukan gugur)

- Apakah otorisasi harus expire/diminta ulang kalau ada jeda waktu lama
  antara `authorize` dan mulai coding — belum diputuskan, kandidat
  pertanyaan ronde desain.
- Interaksi dengan Trigger 1 (eskalasi mid-build ke FMN, lihat PLAN-EVAL-01
  §A.7) — apakah `implementation_authorized_at` perlu direset kalau FMN's
  response mengubah scope. Terhubung ke keputusan A.7 (re-otorisasi hanya
  kalau scope berubah) tapi belum dipetakan ke mekanisme teknis konkret.
- Pola yang sama berpotensi diperluas ke gerbang lain (mis. Gate 1.5 antara
  ARC/FMN) — sengaja tidak dibahas di sini, biar scope tetap sempit dulu.

---

## Risiko & mitigasi (awal)

- Perubahan skema `chain.ts` menyentuh validasi chain yang sudah cukup
  ketat (lihat pola validasi `active_version`/`active_state` pairing di
  baris 502-534) — field baru harus dipastikan tidak melanggar invariant
  chain yang sudah ada. Perlu ditinjau test `chain-engine.test.ts` yang ada
  sebelum implementasi.
- Menambah satu command wajib berarti menambah satu langkah manual DEV
  dibanding sekarang (yang cuma butuh mulai menulis kode setelah menilai
  ucapan Director). Ini trade-off yang disadari (biaya kecil, sekali per
  siklus build) demi jejak audit eksplisit — konsisten dengan pola `check`
  sebelum `lock` yang sudah diterima di Sigma.

## Langkah selanjutnya

Bukan untuk dieksekusi langsung. Diskusikan dulu dengan Director: (1) level
`ArtifactVersion` vs `ArtifactTracker` untuk field baru, (2) apakah re-run
`authorize` diperlukan pasca-eskalasi mid-build, sebelum dokumen ini
didetailkan ke level PLAN-EVAL-01 (rencana implementasi baris-per-baris).

# PLAN-EVAL-01 — `sigma report velocity`: Cadence Report from operations.jsonl

**Sumber**: Diskusi Professional Mode 2026-07-20 (bukan bug report) — Director bertanya apakah `operations.jsonl` bisa dimanfaatkan lebih dari sekadar logging pencatatan.
**Tanggal**: 2026-07-20
**Status**: DRAFT — sketsa awal untuk direview Director, belum final. Level detailnya setara PLAN-EVAL-02 di folder `planned_sigma_governance_hardening_2026_07_20` (bukan cukup detail untuk langsung dieksekusi) — ada beberapa keputusan desain terbuka di bawah.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

`Sigma/logs/operations.jsonl` sudah mencatat **setiap** command Sigma yang
pernah dijalankan (`{operation, timestamp, status, exit_code}`), otomatis,
lewat hook global di `src/cli.ts:74-76` — tidak ada command yang lolos tidak
tercatat. Saat ini satu-satunya konsumen adalah `sigma report logs`
(`src/commands/report.ts`), yang cuma memfilter dan menampilkan entri
mentah (filter `--status`/`--operation`/`--since`/`--until`/`--limit`).

**Ide**: entri-entri ini, kalau dipasangkan secara kronologis, membentuk
data mentah untuk laporan **kecepatan/kadensi siklus** — berapa lama waktu
antara DEV-EXEC dibuat sampai di-lock, antara FMN-PLAN dibuat sampai
di-lock, dst. Ini bisa memberi Director visibilitas soal di mana waktu
terbanyak terpakai (perencanaan vs eksekusi vs review) tanpa Director harus
menghitung manual dari histori chat atau `report logs` mentah.

**Prinsip desain yang saya pegang** (hasil pelajaran dari PLAN-EVAL-02 yang
ditolak Director di folder governance-hardening): fitur ini **murni
read-only/aditif**. Tidak menyentuh `chain.ts`, tidak menambah field baru
ke `ArtifactVersion`/`operations.jsonl`, tidak menambah langkah manual di
alur kerja role manapun. Kalau bermanfaat, biayanya cuma satu subcommand
baru di `report.ts` yang membaca ulang data yang sudah ada.

---

## Scope (sketsa awal, perlu didetailkan)

### Command baru

`sigma report velocity` — subcommand baru di `reportCommand()`
(`src/commands/report.ts:125-147`), pola yang sama dengan `report logs`
yang sudah ada (baca `operations.jsonl` lewat `readAllEntries()`, opsi
`--json` untuk output mentah).

Pasangan operasi yang dihitung durasinya (nama operasi persis string yang
ditulis `commandPath()` di `src/cli.ts:65-72`, mis. `"exec new"`,
`"exec lock"`):

| Pasangan (start → end) | Label | Makna |
|---|---|---|
| `intent new` → `intent lock` | DIR-INTENT drafting | Waktu ARC+Director menyusun & mengunci intent |
| `plan new` → `plan lock` | FMN-PLAN drafting | Waktu FMN menyusun & mengunci plan |
| `exec new` → `exec lock` | DEV-EXEC build | Waktu DEV mengerjakan implementasi sampai lock |
| `close new` → `close lock` | DIR-CLOSE finalization | Waktu penutupan siklus |

Algoritma pairing: two-pointer sederhana per pasangan — jalan kronologis,
setiap kemunculan operasi "start" (status `success`) dipasangkan dengan
kemunculan operasi "end" (status `success`) berikutnya yang belum
dipasangkan. Kalau ada `start` baru sebelum `end` sebelumnya muncul (mis.
`exec new` dua kali berturut-turut tanpa `exec lock` di antaranya — bisa
terjadi kalau exec pertama di-drop/diganti), pasangan pertama ditandai
`(abandoned)` bukan dihitung sebagai durasi valid.

Output contoh (format belum final):

```
=== Cycle Velocity ===

DIR-INTENT drafting   v1        2026-07-14 09:02 -> 2026-07-14 14:30   5h28m
FMN-PLAN drafting     v0.1      2026-07-14 14:35 -> 2026-07-15 08:10   17h35m
DEV-EXEC build        v0.1      2026-07-15 08:12 -> 2026-07-16 11:00   1d2h48m
DEV-EXEC build        v0.2      2026-07-17 09:00 -> (abandoned, no lock)
```

### Yang TIDAK diubah

- `src/utils/operationLog.ts` — `OperationLogEntry` schema tetap
  `{operation, timestamp, status, exit_code}`, tidak ditambah field.
- `src/engine/chain.ts` — tidak disentuh sama sekali.
- Tidak ada command existing yang perilakunya berubah; `report velocity`
  murni tambahan baru.

---

## Di luar scope (dicatat, bukan gugur)

- **Memperkaya schema `OperationLogEntry`** (menambah `chain_version`,
  args command, actor/role) — sengaja tidak diusulkan di sini. Ini akan
  membuka ulang percakapan biaya-vs-manfaat yang sama seperti
  PLAN-EVAL-02 (perubahan skema, lebih banyak permukaan test). Kalau
  laporan velocity ini terbukti berguna dan Director butuh presisi
  per-chain, itu jadi kandidat PLAN-EVAL terpisah nanti — bukan bagian
  dari draft murni-aditif ini.
- **Deteksi anomali / rubber-stamping** (mis. flag command `lock` yang
  jaraknya sangat dekat dengan `new` sebelumnya sebagai sinyal
  "terburu-buru") — ide yang sempat disebut di diskusi tapi sengaja tidak
  dimasukkan draft ini; berpotensi terasa menghakimi/false-positive tanpa
  konteks, dan Director belum diajak diskusi soal ambang batas yang masuk
  akal.
- **Bantuan rekonstruksi CSO/session** (memakai histori operations.jsonl
  untuk auto-ringkas "apa yang terjadi sejak checkpoint terakhir") — arah
  yang disebut di diskusi tapi beda scope (integrasi ke command `cso`,
  bukan `report`), butuh diskusi terpisah kalau Director tertarik.

---

## Keputusan desain terbuka (perlu diputuskan Director sebelum eksekusi)

1. **Ambiguitas multichain**: `operations.jsonl` adalah log satu file per
   proyek, **tidak** dipisah per chain (`progress-v<N>.json`). Kalau ada
   lebih dari satu chain yang pernah aktif bergantian (lihat
   `listChainVersions()` di `chain.ts:236-246`), pairing kronologis
   sederhana di atas bisa salah menghubungkan `exec new` dari chain A
   dengan `exec lock` dari chain B kalau keduanya sempat interleave.
   Pertanyaan: apakah asumsi "satu siklus dikerjakan sampai selesai
   sebelum pindah chain lain" cukup aman untuk penggunaan nyata proyek
   ini sekarang, atau perlu pengaman tambahan (mis. skip pairing kalau
   ada command `intent`/`project` domain lain di antaranya)?
2. **Cakupan pasangan operasi**: tabel di atas cuma 4 pasangan inti. Apakah
   perlu ditambah, misalnya `plan new` → `plan lock` untuk **setiap**
   FMN-PLAN termasuk yang di-supersede (bukan cuma yang akhirnya
   dieksekusi), atau cukup happy-path saja dulu?
3. **Level detail output**: tabel plain-text seperti contoh di atas,
   atau ikut pola `--json` seperti `report logs` sejak awal supaya bisa
   diproses lebih lanjut (mis. di-pipe ke tool lain)?

---

## Risiko & mitigasi (awal)

- Risiko utama sudah dijelaskan di poin 1 (ambiguitas multichain) —
  mitigasi paling murah: batasi `report velocity` v1 untuk hanya
  memproses entri operations.jsonl, dengan catatan eksplisit di output
  "durasi dihitung lintas seluruh proyek, tidak dipisah per chain" supaya
  Director tidak salah baca hasilnya sebagai per-chain-accurate.
- Karena murni read-only, risiko regresi ke fungsi Sigma lain praktis
  nol — tidak ada perubahan ke `chain.ts`, tidak ada perubahan gate/lock
  logic, tidak ada command lock yang terpengaruh.
- Test: perlu test baru di `test/report-logs.test.ts` (atau file baru
  `test/report-velocity.test.ts`, mengikuti pola `runCli()` yang sudah
  dipakai) — belum ditulis, bagian dari eksekusi kalau plan ini disetujui.

## Langkah selanjutnya

Menunggu review Director: terutama keputusan soal 3 pertanyaan desain
terbuka di atas, dan apakah ide ini secara umum dinilai cukup bernilai
untuk dieksekusi (vs sekadar bahan pertimbangan, sesuai instruksi Director
sebelumnya).

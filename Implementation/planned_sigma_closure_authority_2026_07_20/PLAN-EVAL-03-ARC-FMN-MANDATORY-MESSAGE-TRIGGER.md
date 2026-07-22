# PLAN-EVAL-03 — Mandatory Message Trigger: ARC → FMN

**Sumber**: [../../Discussion/closure-authority-and-arc-scoring-proposal-20260720.md](../../Discussion/closure-authority-and-arc-scoring-proposal-20260720.md) Section 5, keputusan #12 (Section 9).
**Tanggal**: 2026-07-20
**Status**: **EXECUTED (2026-07-21)**. Section baru "Trigger 2 — After a new plan+exec LOCKED pair enters the chain" ditambahkan ke `Sigma/rules/ARC-RULE.md` §Mandatory Message Triggers, beserta update cross-reference di §Closure Evaluation dan §ARC Satisfaction Score Methodology yang sebelumnya menunjuk ke plan ini sebagai "belum dieksekusi". Otorisasi eksplisit Director diberikan 2026-07-21.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.
**Dependency**: PLAN-EVAL-02 (band skor yang dilaporkan trigger ini didefinisikan di sana) — **EXECUTED**.

---

## Inti

Trigger pesan wajib **kelima** di Sigma (setelah 3 milik DEV + 1 milik AUD),
dan yang **kedua** milik ARC (`ARC-RULE.md` sudah punya Trigger 1 — "After
`sigma intent lock` succeeds", baris ~514-541). Konsisten dengan pola yang
sudah ada: Mandatory Message Trigger didefinisikan di rule file, **bukan**
CLI-enforced (tidak ada gate kode yang memaksa pesan terkirim).

---

## Scope perubahan file

Satu file: `Sigma/rules/ARC-RULE.md`, di bawah heading `## Mandatory Message
Triggers` (baris ~510) yang sudah ada, sebagai section baru "### Trigger 2 —
After a new plan+exec LOCKED pair enters the chain".

### Kondisi pemicu

Setiap ada pasangan plan+exec LOCKED baru dalam chain (bukan setiap
invokasi `sigma intent score` mentah-mentah). Ini idealnya juga jadi titik
ARC melakukan re-assessment skor.

**Kasus tepi yang wajib ditulis eksplisit di rule file** (bukan cuma
hipotetis — dibahas langsung di diskusi sumber): kalau evaluasi terakhir
sudah mencakup sampai pasangan plan+exec versi v1.5, lalu chain berkembang
ke v1.6, evaluasi baru di v1.6 itu sah dan memicu trigger ini. Kalau ARC
menilai ulang di v1.5 lagi (tanpa pasangan baru) — tetap sah, **tidak
dilarang CLI** — tapi berpotensi menghasilkan catatan skor berbeda untuk
versi yang sama. Kesimpulan yang harus tertulis di rule: idealnya minimal
ada satu pasangan plan+exec baru sejak evaluasi terakhir, tapi ini **soft
guidance**, bukan gerbang CLI yang memblokir apa pun.

### Isi pesan minimal (wajib tertulis di rule sebagai checklist)

1. Skor saat ini, ditampilkan sebagai **band** (`OUTPUT_INCOMPLETE` /
   `SATISFIED_NEEDS_REVIEW` / `SATISFIED_RECOMMENDED` — lihat PLAN-EVAL-02
   §1.2 `arcScoreBand()`), bukan angka mentah sebagai sinyal utama.
2. Versi pasangan plan+exec LOCKED terakhir yang jadi dasar penilaian —
   dengan asumsi cakupan evaluasi selalu **kumulatif** dari versi paling
   awal chain sampai pasangan itu, bukan cuma delta terbaru.
3. Highlight apa yang kurang berdasarkan `DIR-INTENT` — **evaluasi
   retrospektif, bukan checklist prospektif**. Larangan ini adalah larangan
   yang sama seperti di `ARC-RULE.md` §metodologi skor (PLAN-EVAL-02 §8) —
   cross-reference, jangan duplikasi teks penuh, cukup rujuk section itu.
4. Alasan pemberian skor tersebut.

### Parameter `sigma send`

```
sigma send --from arc --to fmn --type CHECK --action REVIEW \
  --subject "..." --message "..." --related-artifact "DIR-INTENT <version>"
```

- `--type CHECK`: isinya laporan status/penilaian, bukan pertanyaan
  (`QUESTION`) atau risiko (`RISK`).
- `--action REVIEW`: FMN diharapkan meninjau, bukan sekadar menerima info
  (`FYI`).

Ditetapkan eksplisit di rule file (bukan diserahkan ke tebakan ARC dari
`--help`) — supaya tidak berulang gap yang sudah tercatat di
`Discussion/sigma-bug-report-20260720-131540.md` §8.5, tempat DEV-RULE tidak
pernah eksplisit menyebut nilai `--action` untuk trigger miliknya sendiri.

### Kewajiban balas FMN

FMN **tidak wajib membalas** pesan trigger ini bebas berdiskusi/klarifikasi.
Kalau FMN ingin lebih dari sekadar diskusi bebas — yaitu betul-betul ingin
ARC menilai ulang skornya secara formal — jalurnya adalah mekanisme Petition
(PLAN-EVAL-04), bukan sekadar balasan pesan biasa. Baris ini wajib ditulis
di rule file supaya FMN instance lain tidak salah paham menganggap balasan
bebas cukup untuk memaksa re-evaluasi.

---

## Yang **tidak berubah**

- Pola Mandatory Message Trigger yang sudah ada (rule-level, bukan
  CLI-enforced) — trigger ini konsisten dengan 4 trigger lain yang sudah
  berjalan, tidak memperkenalkan mekanisme enforcement baru.
- `sigma send`/`sigma inbox` sebagai mekanisme — tidak ada flag/command baru
  yang dibutuhkan, semua parameter (`--type`, `--action`, dst.) sudah ada di
  `src/config.ts` (`VALID_MESSAGE_TYPES`, `VALID_ACTIONS`).

## Langkah selanjutnya

**Selesai.** Otorisasi eksplisit Director diberikan 2026-07-21 untuk mulai
edit `ARC-RULE.md`, setelah PLAN-EVAL-02 EXECUTED (2026-07-20). Empat titik
implementasi yang tidak eksplisit di draf awal dokumen ini didiskusikan dan
diputuskan Director sebelum eksekusi: (1) update cross-reference basi di
baris ~435/471 `ARC-RULE.md` yang sebelumnya menunjuk plan ini sebagai
"belum dieksekusi" — dilakukan; (2) `--message-file` (bukan `--message`)
untuk body multi-baris Trigger 2, mengikuti pola Trigger 1 — dipakai; (3)
template subject baku `"ARC Satisfaction Score recorded — {BAND}
(DIR-INTENT-v{X})"` — dipakai; (4) update status header dokumen ini + README
folder setelah eksekusi, mengikuti konvensi PLAN-EVAL-01/02 — dilakukan.
Lihat `README.md` di folder ini untuk status keseluruhan dan urutan eksekusi
PLAN-EVAL-04 selanjutnya (menunggu review Director sebelum dilanjutkan).

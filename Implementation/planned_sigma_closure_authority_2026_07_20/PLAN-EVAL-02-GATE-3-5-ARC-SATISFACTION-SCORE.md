# PLAN-EVAL-02 — Gate 3.5: ARC Satisfaction Score

**Sumber**: [../../Discussion/closure-authority-and-arc-scoring-proposal-20260720.md](../../Discussion/closure-authority-and-arc-scoring-proposal-20260720.md) Section 4, keputusan #2–#14, #16 (Section 9).
**Tanggal**: 2026-07-20
**Status**: DRAFT — belum dieksekusi, menunggu otorisasi eksplisit Director.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

Skor ARC (0-100, bertingkat: 0-50 output, 50-100 proses) jadi prasyarat baru
sebelum `sigma close new` bisa jalan — **bukan** gerbang `close lock` (yang
tetap 100% verdict checkbox Director, tidak berubah). Skor tidak final, bisa
dinilai ulang seiring PLAN/EXEC baru masuk chain.

Ambang: `< 50` → gerbang tertutup. `50-79` → gerbang terbuka, ARC tidak
merekomendasikan, Director bisa lanjut `close lock` via instruksi eksplisit
biasa (tanpa mekanisme override baru). `≥ 80` → ARC merekomendasikan
penutupan. **Tidak ada mekanisme override untuk skor < 50** — chain boleh
dibiarkan tidak tertutup selamanya (katup pelepas: multi-chain-version yang
sudah ada).

---

## 1. Schema — `src/engine/chain.ts`

### 1.1 Lokasi field: `SingleIntentState`, bukan `ArtifactVersion`

Skor mencakup **seluruh riwayat plan dalam satu chain intent version**
(bukan per-versi plan/exec individual), dan cakupannya identik dengan
cakupan `intent-history.md` (satu baris per chain). `SingleIntentState`
(chain.ts:147-161) sudah menyimpan `title`/`focus` dengan alasan persis sama
("PLAN-EVAL-06 — rendered into Sigma/design/intent-history.md") — pola yang
sama dipakai di sini.

Field baru ditambahkan ke `SingleIntentState`:

```ts
export interface SingleIntentState {
  version: string;
  state: IntentState;
  file?: string;
  created_at: string;
  updated_at: string;
  locked_at?: string;
  supersede_reason?: string;
  title?: string;
  focus?: string;
  arc_score?: number;          // 0-100, raw — internal ARC reasoning number
  arc_score_notes?: string;    // free-text rationale, same sanitization as title/focus
  arc_score_updated_at?: string; // ISO timestamp of last `sigma intent score`
}
```

### 1.2 Helper functions baru (chain.ts)

```ts
export function arcScoreBand(score: number): 'OUTPUT_INCOMPLETE' | 'SATISFIED_NEEDS_REVIEW' | 'SATISFIED_RECOMMENDED' {
  if (score < 50) return 'OUTPUT_INCOMPLETE';
  if (score < 80) return 'SATISFIED_NEEDS_REVIEW';
  return 'SATISFIED_RECOMMENDED';
}

export function hasGate35Score(chain: ChainState): boolean {
  return (chain.intent.arc_score ?? -1) >= 50;
}

export function recordArcScore(chain: ChainState, score: number, notes: string): void {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new Error('ARC score must be an integer between 0 and 100');
  }
  if (/[|\n\r]/.test(notes)) {
    throw new Error('--notes cannot contain "|" or a newline (breaks the intent-history.md table and its recovery parser)');
  }
  if (chain.intent.state !== 'LOCKED') {
    throw new Error('ARC score can only be recorded against a LOCKED DIR-INTENT');
  }
  chain.intent.arc_score = score;
  chain.intent.arc_score_notes = notes;
  chain.intent.arc_score_updated_at = new Date().toISOString();
  chain.updated_at = chain.intent.arc_score_updated_at;
}
```

`recordArcScore` mengikuti persis pola sanitasi `assertRequiredIntentMetadata`
(`src/commands/intent.ts:50-59`) — presiden yang sudah ada di file yang sama,
bukan aturan baru.

**Validasi tambahan yang perlu diverifikasi saat implementasi**: apakah
`validateChainSemantics` (chain.ts:574-616) perlu invariant baru terkait
`arc_score` (mis. tidak boleh ada tanpa `intent.state === 'LOCKED'`). Draf
ini mengasumsikan validasi cukup di `recordArcScore` (guard di titik tulis),
konsisten dengan pola field opsional lain di `SingleIntentState` yang tidak
punya invariant terpisah di `validateChainSemantics`.

---

## 2. Command baru — `sigma intent score <n> --notes "..."`

Ditambahkan di `src/commands/intent.ts`, domain `intent` (bukan `plan` atau
role-based) — lihat rasional lengkap di dokumen sumber §4 "Penyimpanan skor
dan command CLI": `intent-history.md` sudah dimiliki domain `intent`, skor
menjawab "seberapa terpenuhi INTENT", dan taksonomi CLI Sigma berbasis jenis
artifact bukan role.

```
sigma intent score <n> --notes "<rationale>" [--v <version>]
```

- `<n>`: integer 0-100, required positional.
- `--notes`: required, sanitasi sama dengan `--title`/`--focus` (tolak `|`
  dan newline).
- `--v <version>`: opsional, default ke chain aktif — mengikuti pola
  `close check`/`intent check` yang sudah ada (bukan pola baru).
- Approval-class secara mekanisme CLI (tidak boleh jalan tanpa sinyal
  eksplisit Director), tapi dengan **catatan semantik berbeda** dari
  approval biasa: yang disetujui Director adalah tindakan **mencatat**
  (commit), bukan **kelayakan isi skornya** — itu sudah dibahas lewat
  percakapan sebelumnya. CLI sendiri tidak (dan tidak bisa) menegakkan
  perbedaan ini secara teknis — sama seperti `close lock`/`plan lock` juga
  tidak menegakkan bahasa otorisasi secara kode, hanya didokumentasikan di
  rule file (lihat Section 4 di bawah).
- Setelah menulis: panggil `renderIntentHistoryFile(projectRoot)` — trigger
  baru, mengikuti pola `intent.ts:139,189,214` (lock/supersede/activate).
- Output: cetak band + angka mentah + notes, mis.:
  ```
  ARC Score recorded: SATISFIED_NEEDS_REVIEW (62)
  Notes: <notes>
  Gate 3.5 (close new): OPEN
  ```

**Open item (dicatat, belum diselesaikan di plan ini)**: daftar frasa
otorisasi-commit yang dianggap cukup ("catat", "simpan skornya", "record
it") vs bahasa Approval biasa — dokumen sumber eksplisit menyebut ini belum
dirumuskan (Section 10 poin 4). Perlu dirumuskan Director sebelum
`ARC-RULE.md` bagian ini ditulis final.

---

## 3. `src/utils/intentHistory.ts` — dua kolom baru

`generateIntentHistoryContent()` (baris 17-37) diubah:

```
| Version | Title | Focus | Status | Reason | Score | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
```

Rows:
```ts
const score = chain.intent.arc_score !== undefined
  ? `${arcScoreBand(chain.intent.arc_score)} (${chain.intent.arc_score})`
  : '—';
const notes = chain.intent.arc_score_notes ?? '—';
return `| ${version} | ${title} | ${focus} | ${state} | ${reason} | ${score} | ${notes} |`;
```

Band ditampilkan **duluan**, angka mentah sebagai detail sekunder dalam
kurung — sesuai keputusan audit AUD (mitigasi ilusi presisi + Goodhart's
Law, dokumen sumber §4 "Representasi skor: Band, bukan angka mentah").

**Kebijakan riwayat**: tabel ini menyimpan **nilai terkini saja** — tertimpa
tiap kali `sigma intent score` dijalankan ulang. Riwayat lengkap penilaian
sudah otomatis terekam di `Sigma/logs/operations.jsonl` (setiap invokasi CLI
tercatat di sana by design) — tidak diduplikasi di sini. `sigma intent score
--history` (command terpisah untuk melihat tren) eksplisit ditunda ke
`PLAN-EVAL` lanjutan (README §Yang sengaja tidak masuk).

---

## 4. `src/engine/reconstruct.ts` — update parser

`readIntentHistoryMetadata()` (baris 167-183):

```ts
const cells = line.split('|').map(c => c.trim());
if (cells.length < 6) continue; // ganti jadi: if (cells.length < 8) continue;
```

Tabel sekarang punya 7 kolom data (Version, Title, Focus, Status, Reason,
Score, Notes) + 2 sel kosong dari leading/trailing `|` pada split — total 9
elemen array, ambang minimum jadi 8 (longgar, konsisten dengan margin yang
sudah ada di kode asli antara "5 kolom data" dan ambang `< 6`).
**Verifikasi angka pasti perlu dilakukan langsung terhadap output
`split('|')` nyata saat implementasi** — draf ini menandai arah perubahan
(ambang harus naik mengikuti 2 kolom baru), bukan angka final tanpa
verifikasi.

Destructuring `const [, version, title, focus] = cells;` (baris 175) **tidak
perlu diubah** — title/focus recovery tidak butuh kolom skor.

Komentar header file (`intentHistory.ts:6-11`) yang mendeskripsikan bentuk
tabel juga perlu diperbarui untuk menyebut 7 kolom, bukan 5.

---

## 5. Gate definition — `Sigma/SIGMA_PROTOCOL.md` §7

Tambahkan section baru setelah "Gate 3 — BUILD Evidence" (baris ~375-382),
mengikuti format identik gate yang sudah ada:

```
### Gate 3.5 — ARC Satisfaction Score

| | |
| :--- | :--- |
| Pre-condition | `chain.intent.arc_score` recorded and >= 50 (OUTPUT_INCOMPLETE threshold) |
| CLI error | `Gate 3.5 blocked: ARC Satisfaction Score must be >= 50 before DIR-CLOSE can be created. Run: sigma intent score <n> --notes "..."` |
```

**Perbedaan eksplisit dari Gate 1/1.5/2/3 yang perlu dicatat di teks**:
Gate 3.5 **tidak** menggerbangi `close lock` (final authority Director tetap
utuh) — hanya `close new`. Tidak ada mekanisme `sigma override` untuk gate
ini di bawah 50 (berbeda dari Gate 1/1.5/2/3 yang semuanya bisa di-override)
— keputusan eksplisit Director, chain boleh dibiarkan tidak tertutup
selamanya.

---

## 6. `src/commands/close.ts` — `close new` action

Setelah pengecekan `hasCleanGate3Chain` yang sudah ada (baris 56-60),
tambahkan:

```ts
if (!hasGate35Score(chain)) {
  throw new Error(
    'GATE 3.5 BLOCKED: ARC Satisfaction Score must be >= 50 before DIR-CLOSE can be created. ' +
    'Run: sigma intent score <n> --notes "..."'
  );
}
```

Setelah draft berhasil dibuat, tambahkan cetakan advisory non-blocking kalau
band saat ini `SATISFIED_NEEDS_REVIEW`:

```
Note: ARC Satisfaction Score is SATISFIED_NEEDS_REVIEW (62) — ARC does not
yet recommend closure. Director may still proceed via close lock through
explicit authorization.
```

Ini murni cetakan informatif, tidak mengubah alur/tidak ada gate tambahan —
konsisten dengan keputusan "gerbang terbuka tapi tidak direkomendasikan"
(dokumen sumber §4, tabel ambang batas).

---

## 7. `Sigma/SIGMA_PROTOCOL.md` §16A — Command Authority Classes

Tabel "Command Authority Classes" (baris ~501-509): tambahkan `intent score`
ke baris Approval-class, dengan **catatan kaki eksplisit** yang membedakannya
dari command approval lain — bahasa yang disetujui adalah "commit the score"
bukan "approve the score's content" (keputusan revisi dokumen sumber §4,
poin #11 Section 9 — ini menggantikan gagasan awal "kelas otorisasi-commit"
sebagai kelas keempat, yang ditolak karena risiko proliferasi kelas
otorisasi).

---

## 8. `Sigma/rules/ARC-RULE.md` — metodologi skor (section baru)

Bagian konten/metodologi (bukan CLI mechanics, yang sudah dicakup di atas)
perlu ditulis sebagai section baru di `ARC-RULE.md`, minimal mencakup:

- Skala bertingkat 0-50 output / 50-100 proses, dan definisi "output
  satisfied" vs "process satisfied" persis seperti dokumen sumber §4.
- **Larangan checklist prospektif**: ARC boleh menjelaskan evaluasi
  retrospektif ("kenapa sekarang 72"), **tidak boleh** memberi arahan
  prospektif ("lakukan ini supaya jadi 80") — mitigasi Goodhart's Law hasil
  audit AUD putaran kedua.
- Kalimat baku yang diminta AUD, dikutip verbatim di rule file: *"Score is
  a compressed representation of ARC's evaluation against the locked
  intent — never the target itself."*
- Cakupan evaluasi: seluruh riwayat plan dalam satu chain intent version,
  bukan cuma rantai bersih Gate 3.
- Hak baca ARC saat dipicu frasa "evaluasi project ini" / "Evaluate this
  project" — otonomi penuh atas riwayat plan/exec chain **tanpa** otorisasi
  per-command, mencabut larangan default `ARC-RULE.md` khusus konteks ini
  (cross-ref PLAN-EVAL-01 poin 1a).

---

## Yang **tidak berubah**

- `close lock` tetap 100% verdict checkbox Director sebagai satu-satunya
  gerbang — Gate 3.5 tidak menyentuhnya sama sekali.
- Tidak ada command `sigma override` baru untuk Gate 3.5 — keputusan
  eksplisit, bukan kelalaian.

## Risiko implementasi

- Field baru di `SingleIntentState` adalah perubahan schema — perlu
  ditinjau terhadap `test/chain-engine.test.ts` yang ada untuk memastikan
  tidak melanggar invariant chain yang sudah ketat (pola yang sama seperti
  yang dicatat di `PLAN-EVAL-02-EXEC-AUTHORIZE-GATE.md` folder governance
  hardening, walau di sana command akhirnya tidak jadi dibangun — di sini
  perubahan schema justru inti dari fitur, bukan opsional).
- Ambang `cells.length` di `reconstruct.ts` (Section 4 di atas) butuh
  verifikasi langsung terhadap perilaku `String.split('|')` sebelum
  diimplementasikan sebagai angka final.

## Langkah selanjutnya

Bukan untuk dieksekusi langsung. Menunggu: (1) Director merumuskan daftar
frasa otorisasi-commit (open item di atas), (2) otorisasi eksplisit Director
untuk mulai edit schema/kode/rule file.

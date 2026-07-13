# PLAN-EVAL-04 — Pelonggaran Guardrail AUD Findings & Penghapusan Command Family `appendAuditFindings`

**Sumber**: `Discussion/sigma-system-evaluation-2026-07-14.md` (Topik 2, Topik 3)
**Tanggal**: 2026-07-14
**Status**: DRAFT FOR REVIEW
**Urutan eksekusi**: 4 dari 8 (lihat `README.md` di folder ini)
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN, tidak punya otoritas lock/gate Sigma.

---

## Objective

Menggabungkan dua topik yang secara eksplisit beririsan: pelonggaran guardrail
penulisan section "AUD Findings" (Topik 2) dan penghapusan 4 command
`appendAuditFindings` (Topik 3). Guardrail baru di template harus tersedia
lebih dulu sebelum satu-satunya jalur lama (command CLI) dihapus, supaya tidak
ada gap di mana Director kehilangan cara sah mengisi section ini.

---

## Bagian A — Pelonggaran Guardrail "AUD Findings"

### Latar Belakang

- Section "AUD Findings" di DIR-INTENT dan FMN-PLAN cenderung kosong atau
  cepat basi — root cause: AUD yang dipakai Director biasanya AI pasif
  eksternal (Claude web, ChatGPT web), hasil auditnya di-copy-paste manual
  oleh Director, bukan role agentic ber-CLI.
- `FMN-PLAN-TEMPLATE.md` Section 7 ([FMN-PLAN-TEMPLATE.md:108-109](../../Sigma/templates/FMN-PLAN-TEMPLATE.md#L108-L109)) melarang eksplisit tanpa pengecualian: *"FMN and DEV must not write in this section."*
- `appendAuditFindings()` ([artifacts.ts:22-26](../../src/utils/artifacts.ts#L22-L26)) menghasilkan blok generik identik untuk DIR-INTENT dan FMN-PLAN — **tanpa field Verdict/checkbox sama sekali**. Checkbox verdict terstruktur (PASS/PASS_WITH_RISK/REVISE/REJECT_RECOMMENDED/PROMOTE_TO_HEAVIER_PROCESS/OTHER) hanya ada di template statis awal DIR-INTENT Section 12.2 — ronde audit berikutnya via CLI tidak membawa checkbox ini, kemungkinan akar nyata kenapa "audit lama tercatat, ronde baru tidak".

### Keputusan (dari sesi evaluasi)

1. Guardrail "FMN and DEV must not write in this section" **dilonggarkan**
   menjadi: **ARC dan FMN boleh** mengisi/menulis section AUD Findings (di
   DIR-INTENT maupun FMN-PLAN), dengan sumber sah salah satu dari: (a) pesan
   `sigma message`/mailbox langsung dari AUD, atau (b) Director menyampaikan
   hasil audit di sesi chat.
2. **DEV tetap tidak diberi akses** — cakupan pelonggaran hanya ARC dan FMN.
3. Konten narasi (Findings/Major Findings) **boleh berupa interpretasi**
   ARC/FMN terhadap hasil audit — tidak wajib verbatim copy-paste.
4. **Verdict tidak boleh diubah** oleh ARC/FMN — harus persis seperti yang
   disampaikan AUD. Guardrail tertulis di template, bukan validasi teknis baru.
5. Format checkbox verdict **disamakan** antara DIR-INTENT dan FMN-PLAN —
   FMN-PLAN mengikuti struktur checkbox yang sudah ada di DIR-INTENT Section
   12.2.
6. Perbaikan checkbox verdict berlaku di **dua tempat**: template statis awal,
   dan fungsi `appendAuditFindings()` — supaya setiap ronde audit baru
   konsisten menyertakan checkbox verdict yang sama.

### Task Breakdown — Bagian A

- [ ] Update `Sigma/templates/FMN-PLAN-TEMPLATE.md` Section 7: tambahkan struktur checkbox verdict identik dengan DIR-INTENT Section 12.2; revisi kalimat guardrail dari larangan total menjadi carve-out ARC/FMN.
- [ ] Update `Sigma/templates/DIR-INTENT-TEMPLATE.md` Section 12: tambahkan kalimat guardrail eksplisit (checkbox verdict tidak boleh diubah ARC, narasi boleh interpretasi).
- [ ] Update `appendAuditFindings()` di `src/utils/artifacts.ts` agar domain-aware / menyertakan blok checkbox verdict yang sama pada setiap append (dikerjakan di sini walau fungsinya akan dihapus di Bagian B — lihat catatan dependency di bawah untuk urutan yang benar).
- [ ] Update `Sigma/rules/FMN-RULE.md` dan `Sigma/rules/ARC-RULE.md`: revisi bagian yang menyebut larangan menulis AUD Findings, tambahkan aturan sumber sah (mailbox AUD langsung / relay Director di chat) dan batas "boleh interpretasi, tidak boleh ubah verdict".

**Catatan urutan internal**: karena command family di Bagian B akan dihapus,
langkah "update `appendAuditFindings()`" di atas sebenarnya opsional secara
teknis (fungsinya akan mati juga) — tapi tetap dikerjakan **jika** Director
ingin ada jeda rilis di mana command lama masih aktif dengan checkbox yang
benar sebelum dihapus. Jika tidak perlu jeda, boleh langsung lompat ke Bagian
B setelah template selesai direvisi.

---

## Bagian B — Penghapusan Command Family `appendAuditFindings`

### Latar Belakang

Empat command identik mekanismenya, semua memanggil `appendAuditFindings()`
yang sama ([artifacts.ts:22-26](../../src/utils/artifacts.ts#L22-L26)) — murni
append teks, tidak menyentuh lock/gate state (`assertProgressCanMutate` hanya
cek mutability):

| Command | File | Artefak target |
| :--- | :--- | :--- |
| `sigma intent review` | [intent.ts:75](../../src/commands/intent.ts#L75) | DIR-INTENT |
| `sigma plan audit` | [plan.ts:151](../../src/commands/plan.ts#L151) | FMN-PLAN |
| `sigma exec audit` | [exec.ts:124](../../src/commands/exec.ts#L124) | DEV-EXEC |
| `sigma close audit` | [close.ts:120](../../src/commands/close.ts#L120) | DIR-CLOSE |

**Penilaian risiko**: rendah — tidak berdampak ke gate chain/lock integrity.
Nilai yang hilang hanya kenyamanan (auto header + timestamp), sudah
tergantikan oleh Bagian A (ARC/FMN boleh menulis section langsung).

### Keputusan

Hapus **keempat command** sekaligus — bukan hanya yang dibahas awal (`intent
review`, `plan audit`) — untuk menjaga konsistensi keluarga command, karena
mekanismenya identik dan sama-sama redundan setelah Bagian A.

### Task Breakdown — Bagian B

- [ ] Hapus subcommand `review` di `src/commands/intent.ts`.
- [ ] Hapus subcommand `audit` di `src/commands/plan.ts`.
- [ ] Hapus subcommand `audit` di `src/commands/exec.ts`.
- [ ] Hapus subcommand `audit` di `src/commands/close.ts`.
- [ ] Hapus fungsi `appendAuditFindings()` di `src/utils/artifacts.ts` (dead code setelah ke-4 caller dihapus).
- [ ] Update test `test/command-helper-regression.test.ts:32` — menguji `intent review` secara eksplisit, perlu dihapus/disesuaikan.
- [ ] Update `README.md` — hapus baris tabel command (`plan audit`, `exec audit`, `close audit`). Catatan: `intent review` tidak terdaftar di tabel README, hanya di SIGMA_PROTOCOL.
- [ ] Update `Sigma/SIGMA_PROTOCOL.md` — hapus tabel "Invocation commands" terkait ke-4 command ini, tinjau apakah kelas "Advisory" di tabel "Command Authority Classes" masih relevan dipertahankan sebagai kategori jika isinya kosong setelah penghapusan.
- [ ] Review manual `Sigma/rules/ARC-RULE.md`, `AUD-RULE.md`, `FMN-RULE.md` — pastikan tidak ada instruksi role yang masih mengarahkan pemakaian command yang sudah dihapus.
- [ ] Review `Sigma/role-memory/aud-memory.json` — hapus referensi ke command yang sudah dihapus jika ada.

---

## Dependency Catatan

- Bagian A harus selesai (minimal revisi template) sebelum Bagian B
  dieksekusi — supaya tidak ada gap di mana Director kehilangan jalur sah
  mengisi AUD Findings.
- Setelah Bagian B selesai, **satu-satunya jalur** mengisi AUD Findings adalah
  menulis manual ke file oleh ARC/FMN sesuai guardrail baru Bagian A.

---

## Risiko

- Jika Bagian B dikerjakan sebelum Bagian A tuntas, Director kehilangan
  kedua jalur (command lama dihapus, guardrail baru belum ada) — urutan di
  atas wajib diikuti.
- Perubahan `ARC-RULE.md`/`FMN-RULE.md` perlu ditinjau agar tidak ada instruksi
  yang saling kontradiksi (mis. rule lama masih bilang "jangan tulis section
  ini" di satu tempat, sementara bagian lain sudah bilang boleh).

---

## Draft Acceptance Criteria

- [ ] `FMN-PLAN-TEMPLATE.md` dan `DIR-INTENT-TEMPLATE.md` punya struktur checkbox verdict yang identik.
- [ ] `FMN-RULE.md`/`ARC-RULE.md` mengizinkan ARC/FMN menulis AUD Findings dengan sumber sah yang jelas, DEV tetap tidak diizinkan.
- [ ] `sigma intent review`, `sigma plan audit`, `sigma exec audit`, `sigma close audit` tidak lagi terdaftar di CLI.
- [ ] `appendAuditFindings()` tidak lagi ada di `src/utils/artifacts.ts` (atau, jika Bagian A dipertahankan dulu untuk satu rilis, sudah menyertakan checkbox verdict yang benar sebelum akhirnya dihapus).
- [ ] `npm test` lulus tanpa modifikasi di luar test yang memang sengaja disesuaikan di tahap ini.
- [ ] README.md/SIGMA_PROTOCOL.md tidak lagi menyebut ke-4 command yang dihapus.

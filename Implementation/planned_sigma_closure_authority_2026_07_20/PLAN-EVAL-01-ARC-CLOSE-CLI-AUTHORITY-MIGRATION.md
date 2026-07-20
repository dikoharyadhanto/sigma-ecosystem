# PLAN-EVAL-01 — Migrasi Wewenang Operasional CLI `close`: FMN → ARC

**Sumber**: [../../Discussion/closure-authority-and-arc-scoring-proposal-20260720.md](../../Discussion/closure-authority-and-arc-scoring-proposal-20260720.md) Section 3, keputusan #1 (Section 9).
**Tanggal**: 2026-07-20
**Status**: **EXECUTED (2026-07-20)** — lihat "Resolusi" di bawah untuk rincian file yang benar-benar diubah dan penyesuaian yang terjadi saat eksekusi.
**Catatan**: Plan implementasi biasa, disusun Professional Mode. Bukan FMN-PLAN Sigma, tidak punya otoritas lock/gate Sigma.

---

## Inti

Model otorisasi per-command **tidak berubah** dari yang berlaku untuk FMN
hari ini — hanya pemegangnya yang pindah:

| Command | Kelas | Siapa jalankan (baru) |
| :--- | :--- | :--- |
| `sigma close check` | Read-only | ARC — boleh jalan sendiri |
| `sigma close new` | Draft/Operational | ARC — dalam batas role, dengan syarat Gate 3.5 (lihat PLAN-EVAL-02) |
| `sigma close lock` | Approval | ARC — hanya setelah otorisasi eksplisit Director |

Ini murni migrasi **teks rule file** — tidak ada perubahan skema
`chain.ts`, tidak ada perubahan kode `src/commands/close.ts`. Command
`close.ts` sudah agnostik terhadap "role" secara teknis (siapa pun yang
menjalankan CLI dari terminal yang sama bisa run command-nya) — pembatasan
"hanya FMN yang boleh" murni ditegakkan di level rule file/perilaku AI, bukan
di kode. Migrasi ini karena itu murni migrasi **teks**, bukan kode.

---

## Scope perubahan file

### 1. `Sigma/rules/ARC-RULE.md`

**a. Baris ~405 (§Role Activation)** — kalimat saat ini:

> "ARC MUST NOT run `sigma session bootstrap`, inspect `progress-v<N>.json`,
> inspect roadmap/plan/exec/close artifacts, scan code, or read historical
> artifacts by default — see §CLI Operation Policy: these are capability,
> not default activation steps."

Ini melarang ARC menyentuh artifact close **sama sekali sebagai default** —
bertentangan langsung dengan wewenang baru. Perlu ditulis ulang, bukan
sekadar ditambah baris pengecualian, karena kalimat ini adalah kalimat
default-activation (DESIGN-phase framing), sementara wewenang closure baru
berlaku di konteks aktivasi yang berbeda (BUILD/CLOSE-phase evaluation).

**Revisi (2026-07-20, hasil diskusi Director)**: tidak dibutuhkan mekanisme
pencocokan frasa sama sekali. Berbeda dari DEV (yang menilai sendiri ucapan
Director lalu langsung menulis kode — makanya butuh daftar frasa otorisasi
eksplisit di DEV-RULE.md §7), pola ARC yang sudah berlaku hari ini
(`ARC-RULE.md:403`, dikonfirmasi `Sigma/role-memory/arc-memory.json`
baris 21: *"When ARC is called, stop immediately and ask whether the
Director wants to open a new DIR-INTENT"*) adalah **selalu berhenti dan
bertanya dulu**, tidak pernah bertindak dari kesan/tebakan pola kalimat.
Karena itu tidak ada aksi diam-diam yang perlu digerbangi kata kunci — yang
perlu berubah bukan "cara ARC mengenali konteks", tapi **isi pertanyaan
default ARC saat aktivasi**, yang sekarang perlu diperluas dari satu opsi
jadi dua:

- Default activation (Director bilang "You are my Architect") → ARC tidak
  baca apa pun, langsung bertanya: *"Do you want to open a new DIR-INTENT,
  or evaluate an existing locked chain toward closure?"*
- Kalau Director menjawab ingin evaluasi closure → **jawaban itu sendiri**
  yang jadi sinyal (bukan pencocokan pola kalimat spontan) — ARC baru boleh
  menjalankan `sigma close check` (read-only, bebas) dan membaca artifact
  plan/exec/close sesuai hak baca yang didefinisikan di PLAN-EVAL-02.

**b. §Role Activation — perluas pertanyaan default, bukan tambah cabang
deteksi.** Instruksi saat ini ("stop first and ask whether the Director
wants to open a new DIR-INTENT") murni framing DESIGN-phase satu-opsi.
Rewrite jadi satu pertanyaan dua-opsi seperti di atas. Tidak ada cabang
"jika terdeteksi konteks X" — ARC tetap konsisten dengan doktrin umumnya
sendiri (memory baris 12: *"Restate the Director's request in your own
words when scope, intent, approval, or next action could be
misunderstood"*): bertanya eksplisit, bukan menyimpulkan sepihak.

Ini juga menghapus risiko kelas yang sama seperti insiden halusinasi FMN
yang dirujuk di dokumen sumber §10 poin 8 (`Discussion/sigma-bug-report-
20260720-131540.md` §13.2/§14) — insiden itu terjadi karena sebuah role
langsung bertindak dari kesan sendiri terhadap ucapan Director, bukan
bertanya lebih dulu. Jalur "ARC selalu bertanya" secara struktural tidak
punya celah yang sama.

**Efek ikutan ke PLAN-EVAL-02** (dicatat di sini, bukan diubah — supaya
dokumen itu tetap fokus saat direview terpisah): open item PLAN-EVAL-02
soal "daftar frasa 'evaluasi project ini' / 'Evaluate this project'" untuk
hak baca otonom kemungkinan juga tidak perlu jadi daftar frasa spontan —
begitu Director menjawab pertanyaan ARC di atas dengan intensi evaluasi,
itu sudah cukup sebagai trigger. Akan ditinjau ulang saat PLAN-EVAL-02
dibahas.

**c. §Role (baris 3-14) dan identitas ARC secara umum** — perlu ditulis
ulang sebagian agar ARC didefinisikan sebagai **role dua-fase**: DESIGN
(menyusun DIR-INTENT) + CLOSE (mengevaluasi pemenuhan DIR-INTENT di
closure) — bookend, bukan role satu-fase yang "berakhir" begitu DIR-INTENT
LOCKED.

**d. §CLI Operation Policy (baris 449-493)** — ARC-RULE.md sudah punya
section ini (untuk command intent), tapi tidak menyebut domain `close` sama
sekali. Tambahkan ke tabel "Commands ARC may execute without Director
approval when role-appropriate": `sigma close check`. Tambahkan ke tabel
"Commands that require explicit Director approval": `sigma close lock`.
`sigma close new` masuk kategori Draft/Operational — perlu baris sendiri
mengikuti pola FMN (bukan approval, tapi bersyarat Gate 3.5 — cross-ref ke
PLAN-EVAL-02).

**e. §Interaction With Other Roles (baris 349-376)** — subsection "With
FMN" (baris 361-368 dari grep sebelumnya) perlu tambahan: ARC sekarang
membaca riwayat FMN-PLAN/DEV-EXEC FMN untuk evaluasi closure — jelaskan
batasnya (evaluasi terhadap kontrak intent, bukan menilai kualitas teknis
FMN sebagai pekerja).

### 2. `Sigma/rules/FMN-RULE.md`

**a. §CLI Operation Policy (baris 443-495)** — hapus dua baris dari tabel:
- Baris ~456: `| sigma close check | Read-only |`
- Baris ~470: `| sigma close lock | Approval |`

FMN-RULE.md §443-445 juga menyebut umum "FMN operates primarily in the
Draft/Operational command authority class. With explicit Director approval,
FMN may execute Approval-class lock commands." — kalimat ini tetap benar
secara umum (plan lock, exec lock masih FMN), tidak perlu diubah, hanya
baris tabel spesifik `close` yang dihapus.

**b. §Interaction With Other Roles** — subsection "With ARC" (baris
313-322) perlu tambahan kalimat: closure sekarang wewenang ARC, bukan FMN;
FMN tidak lagi mengharapkan otorisasi `close` dari Director untuk dirinya
sendiri.

**c. Audit menyeluruh FMN-RULE.md untuk referensi `close` lain** yang mungkin
tersisa di luar dua section di atas (mis. Escalation Path, Mandatory Message
Triggers) — belum diverifikasi baris-per-baris di draf ini, perlu pengecekan
saat detail implementasi.

### 3. `Sigma/SIGMA_PROTOCOL.md`

**a. §4.1 ARC (baris 110-118)** — kalimat penutup baris 118: *"ARC's work
ends when DIR-INTENT is LOCKED."* — ini salah begitu wewenang baru berlaku.
Rewrite jadi dua-fase, konsisten dengan §Role rewrite di ARC-RULE.md poin
1c di atas.

**b. §4.3 FMN (baris 146-165)** — perlu diverifikasi apakah ada kalimat
yang menyebut FMN berwenang atas closure secara implisit/eksplisit di
deskripsi role ini; hapus/ubah jika ada.

**c. §13 Folder-to-Phase Mapping (baris 392-404)** — perlu diverifikasi
apakah folder `Sigma/close/` dipetakan ke role tertentu di tabel ini; update
ke ARC jika ada pemetaan role eksplisit.

**d. §16 CLI Command Surface (baris 457-484)** — perlu diverifikasi apakah
tabel ini mencantumkan kolom "role" untuk command `close *`; update jika ada.

**Catatan implementasi**: poin b–d di section ini butuh pembacaan penuh
`SIGMA_PROTOCOL.md` baris 74-489 sebelum eksekusi (draf ini baru
mengonfirmasi §4.1 secara langsung lewat grep; tiga poin lain teridentifikasi
sebagai **kemungkinan** titik drift, bukan dikonfirmasi ada).

### 4. `CLAUDE.md` (global `C:\Users\dikoh\.claude\CLAUDE.md` dan project `i:\Works\Project\sigma-ecosystem\CLAUDE.md`)

**Governance Role Activation** section, baris:
> "ARC: stop first and ask whether the Director wants to open a new
> DIR-INTENT."

Perlu cabang baru mengikuti pola yang sama seperti ARC-RULE.md poin 1b:
"ARC: default aktivasi tetap tanya soal DIR-INTENT baru; jika Director
memberi konteks evaluasi closure eksplisit, ARC masuk mode evaluasi (lihat
ARC-RULE.md §Role Activation)." Kedua file (global + project) perlu diedit
konsisten — project CLAUDE.md adalah salinan yang sedikit disesuaikan dari
global, keduanya perlu tetap sinkron secara makna.

### 5. `Sigma/role-memory/arc-memory.json`

**Ditambahkan (2026-07-20, hasil diskusi Director).** Role memory adalah
reminder-file ringkas yang mencerminkan `ARC-RULE.md` (per header file
sendiri: `"source_rule": "Sigma/rules/ARC-RULE.md"`) — bukan artifact
governance yang di-lock, tapi tetap perlu disinkronkan begitu §1a/§1b
dieksekusi, supaya tidak menyesatkan ARC instance yang memuat memory ini di
awal sesi dengan instruksi yang sudah usang.

`role_specific` baris 21 dan 22 adalah **pasangan** (baris 21 = pertanyaan
default saat aktivasi, baris 22 = batas baca yang mengikuti jawaban
pertanyaan itu) — keduanya harus direvisi **bersamaan**, tidak salah satu
saja, supaya tidak timpang (baris 22 mengizinkan baca "saat evaluasi",
tapi baris 21 tidak pernah menyebut opsi evaluasi sebagai jalur masuk).

**Baris 21** — dari:
> "When ARC is called, stop immediately and ask whether the Director wants
> to open a new DIR-INTENT."

menjadi:
> "When ARC is called, stop immediately and ask whether the Director wants
> to open a new DIR-INTENT or evaluate an existing locked chain toward
> closure."

**Baris 22** — dari:
> "Do not run session bootstrap, inspect progress, or read roadmap, plan,
> exec, or code unless explicitly asked."

menjadi:
> "Do not run session bootstrap, inspect progress, or read roadmap, plan,
> exec, or code unless explicitly asked or when the Director has confirmed
> ARC is evaluating an existing chain toward closure."

Kalimat baris 22 sengaja dipertajam dari usulan awal ("...or when
evaluating project") menjadi "...when the Director has confirmed ARC is
evaluating..." — supaya tidak membuka celah ARC menyimpulkan sendiri kapan
ia sedang "mengevaluasi" dari kesan/pola kalimat. Ini menjaga konsistensi
dengan prinsip inti §1a/§1b: ARC bertanya dan menunggu jawaban eksplisit,
tidak pernah menebak dari bahasa Director.

**Baris baru 23 & 24 (2026-07-20, hasil diskusi Director).** Dua bullet
baru ditambahkan ke `role_specific`, mendeskripsikan prosedur konkret
evaluasi closure — bukan sekadar "boleh baca" (baris 22), tapi urutan
langkah nyata dari investigasi sampai pelaporan. Dipecah jadi dua bullet
oleh gerbang approval eksplisit di antaranya, supaya membaca-dan-melapor
tidak pernah diam-diam berlanjut ke penulisan skor tanpa Director
mengizinkan secara eksplisit (konsisten dengan Approval-class `sigma intent
score` di PLAN-EVAL-02 §2):

**Baris 23** (investigasi → lapor → minta izin; belum menulis apa pun):
> "When the Director confirms ARC is evaluating an existing chain toward
> closure, ARC should: run read-only sigma commands (status/check) to
> investigate the chain's current progress; read the intent document,
> ROADMAP, every plan+exec pair LOCKED within that chain's intent version
> (not just the latest), the most recent LOCKED plan+exec result, and the
> relevant source code as evidence for the score. After reviewing, give the
> evaluation report to Director first and ask approval for running sigma
> intent score."

**Baris 24** (setelah approval → tulis skor → lapor FMN → konfirmasi ke
Director):
> "When Director gives explicit approval to record the result into the
> sigma system, run sigma intent score (see PLAN-EVAL-02), send FMN the
> Mandatory Message Trigger report (PLAN-EVAL-03), then report the
> evaluation summary to the Director in conversation."

Command persis yang disebut "`sigma intent score`" di baris 24 masih tunduk
pada nama final yang ditetapkan PLAN-EVAL-02 — kalau nama/flag command
berubah saat detail implementasi, baris ini ikut disesuaikan, bukan
diperlakukan sebagai nama yang sudah dikunci.

**Catatan cakupan**: file ini tidak masuk tabel "CLI-Managed Files — Do Not
Edit Directly" di CLAUDE.md (yang hanya mencakup `progress-v<N>.json`,
`SIGMA-REGISTRY.json`, `SIGMA-OPERATION-REGISTRY.json`, `operations.jsonl`)
— secara teknis boleh diedit langsung tanpa command CLI. Tapi karena isinya
cerminan `ARC-RULE.md`, perubahan ini tetap bagian dari eksekusi
PLAN-EVAL-01 (harus sinkron dengan rewrite §1a/§1b), **bukan** tindakan
terpisah yang dieksekusi lebih dulu di luar gerbang otorisasi — disepakati
Director untuk ditunda sampai eksekusi PLAN-EVAL-01 diotorisasi bersama
(2026-07-20).

---

## Yang **tidak berubah**

- Kepemilikan **isi** `DIR-CLOSE` tetap 100% Director — ARC (dan siapa pun)
  tetap tidak berwenang menulis isinya. Ini soal siapa menjalankan **CLI**,
  bukan siapa menulis **dokumen**.
- Peran AUD terhadap audit `DIR-CLOSE` (kalau diberi akses Director) tidak
  berubah — orthogonal terhadap migrasi ini.
- Peran DEV terhadap closure tetap tidak ada sama sekali.
- Model otorisasi command (read-only bebas, draft/operational dalam batas
  role, approval butuh Director eksplisit) — pola yang sudah berlaku di
  Sigma untuk semua domain, tidak berubah, hanya pemegangnya untuk domain
  `close` yang pindah.

---

## Risiko implementasi

- **Drift referensi tersembunyi**: `SIGMA_PROTOCOL.md` adalah dokumen ~660
  baris; poin 3b–3d di atas butuh audit teks penuh, bukan asumsi dari grep
  parsial yang dilakukan saat menyusun plan ini. Rekomendasi: sebelum
  eksekusi, jalankan pencarian menyeluruh `close` di seluruh `SIGMA_PROTOCOL.md`
  dan `FMN-RULE.md`, bukan hanya section yang sudah teridentifikasi di sini.
- **Sinkronisasi dua CLAUDE.md**: global dan project punya isi yang mirip
  tapi tidak identik (project punya baris tambahan spesifik sigma-ecosystem).
  Perubahan harus diverifikasi konsisten secara makna di keduanya, bukan
  disalin mentah satu ke yang lain.

## Langkah selanjutnya

Tidak ada open item lagi yang menunggu keputusan Director untuk bagian ini
(daftar frasa aktivasi yang sebelumnya diminta sudah tidak relevan — lihat
revisi §1a/1b di atas). Bukan untuk dieksekusi langsung — menunggu
otorisasi eksplisit Director untuk mulai edit rule file. Direkomendasikan
dieksekusi bersamaan dengan PLAN-EVAL-02 (bukan terpisah jauh waktu) supaya
ARC-RULE.md tidak sempat berada di state "boleh close tapi belum ada gate
skor" untuk waktu lama.

---

## Resolusi (2026-07-20)

Dieksekusi atas otorisasi eksplisit Director. File yang benar-benar diubah:

1. **`Sigma/rules/ARC-RULE.md`** — §Role (dua-fase), §Key Rules #2 (klarifikasi
   operasi CLI vs otorship DIR-CLOSE), §Interaction With Other Roles → With
   FMN, §Role Activation (pertanyaan dua-opsi), **section baru §Closure
   Evaluation** (prosedur 3 langkah: investigasi → lapor+minta izin →
   catat+notifikasi, dengan forward-reference eksplisit ke PLAN-EVAL-02/03/04
   yang ditandai "belum dieksekusi"), §CLI Operation Policy (baris `close
   check`/`close new`/`close lock` ditambahkan), §Final Doctrine (satu baris
   penutup dua-fase).
2. **`Sigma/rules/FMN-RULE.md`** — §Interaction With Other Roles → With ARC
   (pointer closure ke ARC), §CLI Operation Policy (baris `close check`/
   `close lock` dihapus dari kedua tabel). **Temuan tambahan saat eksekusi**
   (tidak tercatat di draf awal poin 2c): paragraf "Before recommending
   lock..." di §CLI Operation Policy masih menyebut `sigma close check` di
   daftar check command — diperbaiki jadi hanya `sigma plan check`/`sigma
   exec check`.
3. **`Sigma/SIGMA_PROTOCOL.md`** — §4.1 ARC (tabel Phase + deskripsi
   dua-fase + "Cannot operate in BUILD phase" menggantikan "BUILD or CLOSE
   phase"), footer version note v0.6 ditambahkan. **Poin 3b–3d (§4.3, §13,
   §16) diverifikasi penuh saat eksekusi — tidak ada drift ditemukan**:
   ketiga bagian itu tidak memuat kolom/klaim role-spesifik untuk domain
   `close`, jadi tidak perlu diubah. Risiko "audit teks penuh" di dokumen
   ini sekarang selesai, bukan lagi risiko terbuka.
4. **`CLAUDE.md`** (global `C:\Users\dikoh\.claude\CLAUDE.md` dan project
   `i:\Works\Project\sigma-ecosystem\CLAUDE.md`) — baris aktivasi ARC di
   §Governance Role Activation diperluas jadi dua-opsi, konsisten di kedua
   file.
5. **`Sigma/role-memory/arc-memory.json`** — baris 21–22 direvisi, baris
   23–24 baru ditambahkan (persis seperti disepakati), `memory_updated_at`
   dimutakhirkan ke 2026-07-20. Divalidasi sebagai JSON yang sah setelah
   diedit.

**Koreksi kritis (2026-07-20, atas koreksi Director)**: edit pertama ke
lima file di atas hanya menyentuh **salinan yang sudah ter-deploy**
(`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`,
`~/.reasonix/skills/arc.md`, dan dua `CLAUDE.md` project) — bukan **sumber
master** yang dipakai `sigma setup install`/`sigma setup update` dan
`sigma project start`. Director mengoreksi ini. Sumber master yang benar
adalah `setup/targets/` di root package (dibaca langsung oleh
`src/commands/setup.ts` lewat `PACKAGE_ROOT`, bukan file yang dikompilasi
ke `dist/` — perubahan berlaku langsung tanpa build). Disinkronkan:

- `setup/targets/bridge/{CLAUDE.md,GEMINI.md,AGENTS.md}` — sumber untuk
  bridge file project (dideploy `sigma project start`/`--overwrite-bridge`,
  lewat staging `~/.sigma/bridge/`). `DEEPSEEK.md` dan `REASONIX.md` di
  folder yang sama diverifikasi **tidak** punya baris/section setara —
  tidak diubah, konsisten dengan versi project yang sudah diverifikasi.
- `setup/targets/claude_code/arc.md`, `setup/targets/codex/arc/SKILL.md`,
  `setup/targets/reasonix/arc.md`, `setup/targets/antigravity/sigma-arc/SKILL.md`
  — empat varian skill ARC yang dideploy `sigma setup install`/`update` ke
  `~/.claude/commands/`, `~/.codex/skills/`, `~/.reasonix/skills/`,
  `~/.gemini/config/skills/` — isinya identik satu sama lain (kecuali
  `claude_code/arc.md` yang punya dua subsection tambahan), jadi diedit
  dengan pola persis sama: §Scope and Authority (baris "Does not inspect
  runtime state...") dan §Role Activation langkah 2 direvisi jadi
  pertanyaan dua-opsi.

**Temuan tambahan saat verifikasi arsitektur deployment**:
`C:\Users\dikoh\.gemini\agents\arc.md` (yang disebut sebagai temuan
terbuka di bagian "Tidak diubah" di bawah) ternyata **bukan** dideploy dari
`setup/targets/antigravity/sigma-arc/SKILL.md` sama sekali — path
deploy Antigravity yang sebenarnya adalah `~/.gemini/config/skills/`
(`paths.antigravitySkills`), bukan `~/.gemini/agents/`. File di
`~/.gemini/agents/arc.md` tampaknya artefak dari mekanisme/versi lain di
luar `sigma setup`, konsisten dengan alasan sebelumnya untuk tidak
menyentuhnya sepihak.

**Perluasan cakupan (2026-07-20, atas instruksi Director)**: draf awal
section 4 hanya menyebut dua `CLAUDE.md`. Director meminta memastikan
master AI rule file lain ikut disinkronkan. Ditemukan dan disinkronkan:

- `AGENTS.md` (project, Codex) dan `C:\Users\dikoh\.codex\AGENTS.md`
  (global) — pola baris identik dengan `CLAUDE.md`, diedit sama persis.
- `GEMINI.md` (project) dan `C:\Users\dikoh\.gemini\GEMINI.md` (global) —
  sama persis.
- `C:\Users\dikoh\.reasonix\skills\arc.md` — struktur berbeda (numbered
  steps, bukan bullet list per-role), disesuaikan: step 2 §Role Activation
  dan satu baris §Scope and Authority.

**Tidak diubah, dengan alasan eksplisit**:

- `DEEPSEEK.md` (project) — tidak punya baris/section yang setara sama
  sekali; filenya eksplisit menyatakan "DeepSeek does NOT inherit from
  CLAUDE.md, GEMINI.md, or AGENTS.md unless explicitly requested" — desain
  standalone yang disengaja, bukan celah yang perlu ditambal.
- `C:\Users\dikoh\.gemini\agents\arc.md` — varian skill Gemini/Antigravity
  yang lain, memakai "Bootstrap Protocol (4 Steps)" yang selalu langsung
  menjalankan `sigma session bootstrap`, **tidak** punya langkah "stop dan
  tanya" sama sekali (berbeda filosofi dari `Sigma/rules/ARC-RULE.md`).
  Ini bukan celah sinkronisasi kecil — memaksa tambahan langkah "stop
  first" ke file ini berarti mengubah desain perilakunya, bukan sekadar
  menyalin baris. **Dilaporkan ke Director sebagai temuan terbuka, tidak
  dieksekusi sepihak.**
- Tidak ditemukan file `RESONIX.md` di mana pun (project maupun global) —
  yang ada hanya `.reasonix/skills/arc.md` di atas.

**Penyesuaian yang terjadi saat eksekusi (bukan penyimpangan dari plan,
murni detail realisasi)**: karena PLAN-EVAL-02/03/04 belum dieksekusi,
§Closure Evaluation di `ARC-RULE.md` dan bullet baris 24 di `arc-memory.json`
secara eksplisit menandai `sigma intent score` dan Mandatory Message Trigger
FMN sebagai **belum diimplementasikan** — ARC diinstruksikan melaporkan
skor ke Director lewat percakapan saja sampai command/trigger itu ada,
bukan mengarang command pengganti atau mengedit `progress-v<N>.json`
manual. Tidak ada perubahan kode (`chain.ts`, `close.ts`) — sesuai rencana,
migrasi ini murni teks rule file.

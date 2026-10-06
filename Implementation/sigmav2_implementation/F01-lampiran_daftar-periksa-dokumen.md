# Lampiran F01 - Daftar periksa dokumen untuk review Director

Tanggal: 6 Oktober 2026
Status: bahan review. Ini bukan pengembangan F01 (F01 tetap DITAHAN sesuai [F00](F00_indeks-dan-register.md)). Daftar ini hanya memetakan dokumen dan lokasinya agar Director dapat memberi feedback per dokumen.
Basis: repo master `main` pada 7549f4b dan salinan di I:/Works/Project/KLHK_JasaLingkunganHidup (selanjutnya KLHK). Jumlah baris adalah ukuran saat diperiksa, bukan nilai mutu.

Cara pakai: centang kolom Cek setelah Anda membaca, tulis feedback pada kolom Feedback. Prioritas baca diusulkan di bagian 9.

Catatan hasil pembandingan hash master dan KLHK (hanya menunjukkan isi berbeda, bukan arah drift maupun mana yang benar):

- **Berbeda:** SIGMA_PROTOCOL.md, ARC-RULE.md, AUD-RULE.md, FMN-RULE.md, DIR-INTENT-TEMPLATE.md, FMN-PLAN-TEMPLATE.md, ROADMAP-TEMPLATE.md.
- **Identik:** SIGMA_CONSTITUTION.md, DEV-RULE.md, terminology, 9 template lainnya, 4 role-memory, dua registry JSON.
- Ini memperluas temuan sebelumnya (hanya AUD-RULE) menjadi tujuh dokumen.

## 1. Constitution dan Protocol

**DITAHAN (keputusan Director, 6 Oktober 2026):** Constitution dan Protocol direview belakangan, tidak termasuk tahap review sekarang. Review AI lain atas Constitution di `artifact_sigma_review_director.md` dibiarkan apa adanya sampai ada instruksi. Perubahan apa pun pada Constitution tetap tunduk pada Article VIII (deklarasi amandemen eksplisit Director).

| Cek | Dokumen | Lokasi master | Baris | Catatan titik periksa | Feedback |
|---|---|---|---|---|---|
| [ ] | SIGMA_CONSTITUTION | [Sigma/SIGMA_CONSTITUTION.md](../../Sigma/SIGMA_CONSTITUTION.md) | 199 | Prinsip dan batas otoritas; identik dengan KLHK | |
| [ ] | SIGMA_PROTOCOL | [Sigma/SIGMA_PROTOCOL.md](../../Sigma/SIGMA_PROTOCOL.md) | 780 | Spesifikasi referensi; bagian keterbacaan Director vs dokumen padat; **berbeda dari KLHK** | |

## 2. Role rules

| Cek | Dokumen | Lokasi master | Baris | Catatan titik periksa | Feedback |
|---|---|---|---|---|---|
| [ ] | ARC-RULE | [Sigma/rules/ARC-RULE.md](../../Sigma/rules/ARC-RULE.md) | 814 | Batas dua revisi per section, aturan tier, **berbeda dari KLHK** | |
| [ ] | FMN-RULE | [Sigma/rules/FMN-RULE.md](../../Sigma/rules/FMN-RULE.md) | 631 | Pengisian ringkasan Director menjelang lock, batas dua revisi, **berbeda dari KLHK** | |
| [ ] | DEV-RULE | [Sigma/rules/DEV-RULE.md](../../Sigma/rules/DEV-RULE.md) | 785 | Kewenangan riset dan prosedur yang diulang di template EXEC; identik dengan KLHK | |
| [ ] | AUD-RULE | [Sigma/rules/AUD-RULE.md](../../Sigma/rules/AUD-RULE.md) | 1270 | Critic Mode dan pemeriksaan tag tier (baris 488-515 master), isolasi evidence; **berbeda dari KLHK** | |
| [ ] | Terminologi default | [Sigma/rules/sigma_terminology.default.json](../../Sigma/rules/sigma_terminology.default.json) | 27 | Istilah baku; identik dengan KLHK | |

## 3. Template artefak

| Cek | Dokumen | Lokasi master | Baris | Catatan titik periksa | Feedback |
|---|---|---|---|---|---|
| [ ] | DIR-INTENT-TEMPLATE | [Sigma/templates/DIR-INTENT-TEMPLATE.md](../../Sigma/templates/DIR-INTENT-TEMPLATE.md) | 553 | Contoh dan petunjuk di dalam isi, tier, ringkasan; **berbeda dari KLHK** | |
| [ ] | FMN-PLAN-TEMPLATE | [Sigma/templates/FMN-PLAN-TEMPLATE.md](../../Sigma/templates/FMN-PLAN-TEMPLATE.md) | 287 | Prasyarat bercampur penjelasan semantik (28-101), ringkasan Director di akhir (269-284); **berbeda dari KLHK** | |
| [ ] | DEV-EXEC-TEMPLATE | [Sigma/templates/DEV-EXEC-TEMPLATE.md](../../Sigma/templates/DEV-EXEC-TEMPLATE.md) | 470 | Prosedur riset dan batas otoritas yang diulang (60-84) | |
| [ ] | DIR-CLOSE-TEMPLATE | [Sigma/templates/DIR-CLOSE-TEMPLATE.md](../../Sigma/templates/DIR-CLOSE-TEMPLATE.md) | 296 | Struktur CLOSE | |
| [ ] | ROADMAP-TEMPLATE | [Sigma/templates/ROADMAP-TEMPLATE.md](../../Sigma/templates/ROADMAP-TEMPLATE.md) | 84 | **Berbeda dari KLHK** | |
| [ ] | MSG-TEMPLATE | [Sigma/templates/MSG-TEMPLATE.md](../../Sigma/templates/MSG-TEMPLATE.md) | 38 | Terkait mailbox per intent (F03) | |
| [ ] | MEMO-TEMPLATE | [Sigma/templates/MEMO-TEMPLATE.md](../../Sigma/templates/MEMO-TEMPLATE.md) | 39 | Terkait mailbox per intent (F03) | |
| [ ] | REFERENCE-LIST-TEMPLATE | [Sigma/templates/REFERENCE-LIST-TEMPLATE.md](../../Sigma/templates/REFERENCE-LIST-TEMPLATE.md) | 42 | Pola daftar yang ditiru `sigma notes` (F06) | |
| [ ] | DIR-INTENT-HUMAN-TEMPLATE | [Sigma/templates/DIR-INTENT-HUMAN-TEMPLATE.md](../../Sigma/templates/DIR-INTENT-HUMAN-TEMPLATE.md) | 92 | Proyeksi HUMAN; keputusan D-13 (penghapusan) belum diotorisasi penerapannya | |
| [ ] | DIR-CLOSE-HUMAN-TEMPLATE | [Sigma/templates/DIR-CLOSE-HUMAN-TEMPLATE.md](../../Sigma/templates/DIR-CLOSE-HUMAN-TEMPLATE.md) | 102 | Proyeksi HUMAN (D-13) | |
| [ ] | PLAN-EXEC-HUMAN-TEMPLATE | [Sigma/templates/PLAN-EXEC-HUMAN-TEMPLATE.md](../../Sigma/templates/PLAN-EXEC-HUMAN-TEMPLATE.md) | 120 | Proyeksi HUMAN (D-13) | |
| [ ] | HUMAN-FIDELITY-LEDGER-TEMPLATE | [Sigma/templates/HUMAN-FIDELITY-LEDGER-TEMPLATE.md](../../Sigma/templates/HUMAN-FIDELITY-LEDGER-TEMPLATE.md) | 31 | Fidelity Ledger (D-13) | |

## 4. Role memory

Seluruhnya identik antara master dan KLHK. `source_rule_version` tercatat unversioned pada sampel yang diperiksa sebelumnya (AUD, FMN, DEV).

| Cek | Dokumen | Lokasi master | Baris | Catatan titik periksa | Feedback |
|---|---|---|---|---|---|
| [ ] | ARC memory | [Sigma/role-memory/arc-memory.json](../../Sigma/role-memory/arc-memory.json) | 39 | Pengingat umum dan khusus role; apakah menambah kewajiban baru | |
| [ ] | FMN memory | [Sigma/role-memory/fmn-memory.json](../../Sigma/role-memory/fmn-memory.json) | 36 | Sama | |
| [ ] | DEV memory | [Sigma/role-memory/dev-memory.json](../../Sigma/role-memory/dev-memory.json) | 36 | Sama | |
| [ ] | AUD memory | [Sigma/role-memory/aud-memory.json](../../Sigma/role-memory/aud-memory.json) | 34 | Tidak memuat pemeriksaan item-tier | |
| [ ] | Pembaca/penulis memory (kode) | [src/engine/roleMemory.ts](../../src/engine/roleMemory.ts), [src/commands/memory.ts](../../src/commands/memory.ts) | - | Cara memory dimuat ke sesi AI | |

## 5. Skill dan pintu masuk per target

Skill sama dalam sembilan nama (arc, fmn, dev, aud, report, sigma-test, humanize, write-memo, read-memo) dan disalin ke empat target. Hash antar target berbeda sehingga tidak boleh dianggap sinkron. Perbedaan hash belum dibandingkan isinya.

| Cek | Target | Lokasi master | Lokasi terpasang | Catatan |
|---|---|---|---|---|
| [ ] | Claude Code (9 file) | [setup/targets/claude_code/](../../setup/targets/claude_code/) | `~/.claude/commands/` | arc 128, aud 151, dev 124, fmn 124, humanize 178, read-memo 76, report 135, sigma-test 158, write-memo 92 baris |
| [ ] | Codex (9 skill + openai.yaml) | [setup/targets/codex/](../../setup/targets/codex/) | `~/.codex/skills/` | arc 122, aud 149, dev 118, fmn 118; skill aktivasi AUD menyebut memory dan rules tetapi tidak eksplisit memuat rules |
| [ ] | Reasonix (9 file) | [setup/targets/reasonix/](../../setup/targets/reasonix/) | `~/.reasonix/skills/` | Hash arc/aud/dev/fmn sama dengan Codex; humanize/read-memo/report/write-memo sama dengan Claude Code; sigma-test berbeda dari keduanya |
| [ ] | Antigravity (9 skill + plugin.json) | [setup/targets/antigravity/](../../setup/targets/antigravity/) | `~/.gemini/config/skills/` | Baris sama dengan Codex; hash belum dibandingkan |
| [ ] | Cursor | [setup/targets/cursor/SIGMA.mdc](../../setup/targets/cursor/SIGMA.mdc) | `~/.cursor/rules/` | 42 baris |

Tiga jenis dokumen terkait skill yang perlu dinilai per target: (a) apakah langkah aktivasi memuat rules role, (b) apakah isi skill menambah kewajiban yang tidak ada di rules, (c) apakah fungsi report, humanize, sigma-test, write-memo, dan read-memo konsisten antar target.

## 6. Bridge dan hook

| Cek | Dokumen | Lokasi master | Baris | Catatan |
|---|---|---|---|---|
| [ ] | Bridge AGENTS | [setup/targets/bridge/AGENTS.md](../../setup/targets/bridge/AGENTS.md) | 155 | Pintu masuk Codex dan agen umum |
| [ ] | Bridge CLAUDE | [setup/targets/bridge/CLAUDE.md](../../setup/targets/bridge/CLAUDE.md) | 155 | Pintu masuk Claude Code |
| [ ] | Bridge GEMINI | [setup/targets/bridge/GEMINI.md](../../setup/targets/bridge/GEMINI.md) | 155 | Pintu masuk Antigravity |
| [ ] | Bridge DEEPSEEK | [setup/targets/bridge/DEEPSEEK.md](../../setup/targets/bridge/DEEPSEEK.md) | 84 | Lebih pendek dari tiga bridge di atas |
| [ ] | Bridge REASONIX | [setup/targets/bridge/REASONIX.md](../../setup/targets/bridge/REASONIX.md) | 77 | Lebih pendek |
| [ ] | Hook protect-sigma | [setup/targets/hooks/protect-sigma.js](../../setup/targets/hooks/protect-sigma.js) | 23 | Proteksi file Sigma; dipasang ke `~/.claude/settings.json` |

## 7. Registry, orientasi, dan teks runtime di source

Teks yang dibaca AI saat orientasi, help, dan pesan error sebenarnya berada di kode. Ini bagian dari "memory yang memengaruhi perilaku AI".

| Cek | Dokumen/kode | Lokasi | Catatan titik periksa |
|---|---|---|---|
| [ ] | Registry dokumen | [Sigma/SIGMA-REGISTRY.json](../../Sigma/SIGMA-REGISTRY.json) | 338 baris; menghubungkan dokumen |
| [ ] | Registry operasi | [Sigma/SIGMA-OPERATION-REGISTRY.json](../../Sigma/SIGMA-OPERATION-REGISTRY.json) | 2354 baris; menghubungkan operasi |
| [ ] | Bootstrap view | [src/session/bootstrapView.ts](../../src/session/bootstrapView.ts) | Data bersama bootstrap CLI dan orientasi MCP |
| [ ] | Orientasi MCP | [src/mcp/tools/orientation.ts](../../src/mcp/tools/orientation.ts) | Warning runtime |
| [ ] | Tampilan sesi CLI | [src/commands/session.ts](../../src/commands/session.ts) | Active Chain, bootstrap |
| [ ] | Help command | [src/cli.ts](../../src/cli.ts) | Deskripsi command dan opsi; drift help `intent new` terhadap `Sigma/design/intent-history.md` sudah tercatat |
| [ ] | Validator dokumen | [src/utils/docCheck.ts](../../src/utils/docCheck.ts) | Struktur template yang dipaksa; berpengaruh pada setiap perubahan template |
| [ ] | Distribusi | [src/commands/setup.ts](../../src/commands/setup.ts), [src/commands/project.ts](../../src/commands/project.ts) | Cara master disalin ke host dan proyek |
| [ ] | README | [README.md](../../README.md) | 808 baris |
| [ ] | Changelog | [CHANGELOG.md](../../CHANGELOG.md) | Riwayat perubahan aturan |

## 8. Salinan di proyek (lokasi aktual yang dibaca AI saat bekerja)

Master disalin ke setiap proyek terdaftar. Perbedaan master dan salinan proyek adalah inti pertanyaan konsistensi.

| Cek | Lokasi | Catatan |
|---|---|---|
| [ ] | `<proyek>/Sigma/SIGMA_CONSTITUTION.md`, `SIGMA_PROTOCOL.md` | Salinan Protocol KLHK berbeda dari master |
| [ ] | `<proyek>/Sigma/rules/` | KLHK: ARC, AUD, FMN berbeda; DEV identik |
| [ ] | `<proyek>/Sigma/templates/` | KLHK: INTENT, PLAN, ROADMAP berbeda |
| [ ] | `<proyek>/Sigma/role-memory/` | KLHK: identik dengan master |
| [ ] | [KLHK Sigma/](file:///I:/Works/Project/KLHK_JasaLingkunganHidup/Sigma) | Satu-satunya salinan proyek yang saya bandingkan. Proyek terdaftar lain belum diperiksa |

## 9. Urutan baca yang diusulkan

1. DIR-INTENT-TEMPLATE, FMN-PLAN-TEMPLATE, DEV-EXEC-TEMPLATE (dokumen yang Anda baca langsung saat menyetujui pekerjaan), disertai versi KLHK yang berbeda.
2. ARC-RULE, FMN-RULE, DEV-RULE, AUD-RULE.
3. Role memory (empat file pendek), lalu skill dan bridge satu target dahulu (usulan: Claude Code dan Codex).
4. Registry, teks runtime, dan salinan target lain.
5. DITAHAN, belakangan: SIGMA_CONSTITUTION dan SIGMA_PROTOCOL.

## 10. Hal yang belum diperiksa

- Isi perbedaan antara master dan salinan KLHK, serta siapa yang lebih baru.
- Proyek terdaftar selain KLHK.
- Salinan terpasang di `~/.claude/commands/`, `~/.codex/skills/`, `~/.reasonix/skills/`, `~/.gemini/config/skills/`, `~/.cursor/rules/`; hash terhadap master belum dibandingkan.
- Kemungkinan dokumen lain yang memengaruhi AI di luar daftar ini (misalnya CLAUDE.md atau AGENTS.md di tiap proyek).

# RESULT-IMPL: Gitignore Jejak Sigma, Guardrail Lintas-Mesin, Portabilitas

**Tanggal:** 2026-10-20
**Rencana:** `PLAN-IMPL-SIGMA-GITIGNORE-IDENTITY-AND-PORTABILITY-20261020.md`
**Status:** Terimplementasi, belum di-commit. Build bersih, `vitest`: 98 file / 1586 test lulus (baseline sebelum kerja: 96 file / 1543 test). Ditambah putaran keputusan Director (§6).

## 1. Hasil per Work Package

| WP | Hasil | Berkas utama |
|:--|:--|:--|
| WP-1 | `git.gitignore_sigma` (default `true`) di `project.config.json` dan `.sigma-identity.json`; `sigma config set gitignore on\|off` (alias `activate/deactivate/true/false/1/0`); `config show` menampilkan mode. `sigma_applied` dan `logs_created_at` pindah ke `Sigma/activate_status.json` (pembaca fallback ke salinan lama di identity; stempel berikutnya menghapus salinan lama sekali). `writeActivateStatus` kini mempertahankan field lain. | `engine/projectConfig.ts`, `commands/config.ts`, `engine/chain.ts`, `services/assetConsistency.ts`, `commands/project.ts`, `services/gitignoreService.ts` |
| WP-2 | Blok `# >>> sigma-managed >>>` persis sesuai §2.3 rencana; `/dev/` tidak pernah di-ignore. `untrackSigmaFilesFromGitIndex` memakai `git rm -r --cached` saja; tidak ada penghapusan file, tidak ada commit. | `utils/gitignore.ts` |
| WP-3 | `inspectProjectRegistrationState` + `assertSigmaFilesPresentOrThrow`; hook `preAction` global (semua perintah kecuali `setup`), guard langsung di `runStart/runRegister/runSync`, dan `resolveBinding` (server `sigma-mcp` dan `sigma-control` menolak start). Pesan Inggris persis sesuai Invarian 4. | `utils/fs.ts`, `cli.ts`, `commands/project.ts`, `mcp/binding.ts` |
| WP-4 | Mode snapshot lokal `Sigma/revisions/INTENT-v<N>/{base.md, amd-<NNN>.md, ledger.json}`. Lihat §3. | `engine/intentSnapshot.ts`, `engine/intentGit.ts`, `services/intent{Baseline,Amendment}Service.ts`, `commands/intent.ts`, tool MCP |
| WP-5 | Hash aset teks melipat CRLF→LF (file LF berhash sama seperti sebelumnya, jadi stempel lama tetap valid). Path `.mcp.json`/`opencode.json` yang menunjuk root lain di-refresh, dan marker `dev/.sigma-workspace.json` yang hilang dibangun ulang dari record identity, sebelum operasi yang mengubah state. | `services/portabilityHeal.ts`, `utils/mcpConfig.ts`, `cli.ts` |
| WP-6 | `test/gitignore-portability.test.ts` (25 test), `test/intent-snapshot-mode.test.ts` (15 test); 7 berkas test lama diperbarui; registry 91 operasi (`config_set_gitignore`), manifes kapabilitas dan matriks MCP diregenerasi. | `test/*`, `Sigma/SIGMA-OPERATION-REGISTRY.json` |

README dan CHANGELOG (Unreleased) sudah diperbarui.

## 2. Verifikasi Invarian

1. **Zero deletion:** test membuktikan isi file Sigma di disk identik sebelum/sesudah `gitignore on` + `git rm --cached`.
2. **Hanya identity yang dilacak:** `git ls-files` setelah `project start` + `git add -A` hanya memuat `.gitignore` dan `.sigma-identity.json`.
3. **`dev/`:** `git check-ignore` memastikan `dev/src/index.ts` dan `dev/README.md` tidak ter-ignore, sedangkan `dev/.sigma-workspace.json` dan `dev/CHANGE-RECORD.md` ter-ignore; `dev/src/index.ts` tidak ikut `git rm --cached`.
4. **Guardrail:** klon yang hanya berisi identity menolak 10 perintah (termasuk `project start`, `start --reinit`, `register`, `sync`), dari subdirektori juga, dan tidak membuat file apa pun; `setup` tidak diblokir.
5. **Index cleanup:** 8 file Sigma terlacak terlepas dari index; penghapusan hanya ter-stage.
6. **Siklus off → push → pull:** proyek hasil klon langsung bisa dipakai; `.mcp.json` diperbaiki saat operasi mutasi; perintah read-only tidak menulis.

## 3. Keputusan Desain yang Saya Ambil (rencana tidak merinci) — mohon dikonfirmasi

- **WP-4 hibrida, bukan penggantian total.** Mode snapshot dipakai bila INTENT tidak dilacak Git (atau tidak ada Git) dan chain belum punya baseline Git; mode Git tetap persis seperti sebelumnya bila chain sudah punya `git_baseline` atau INTENT terlacak dan `--commit` diberikan. `baseline adopt` tanpa `--commit` ⇒ snapshot. Alasan: rantai lama dan test F05 lama tetap valid, dan bukti tag Git tidak dibuang diam-diam. Konsekuensi: proyek tanpa Git kini **bisa** menjalankan amandemen.
- **Snapshot ditulis di fase 2 (dalam transaksi berjurnal)**, bukan di fase verifikasi, agar percobaan yang ditinggalkan tidak meninggalkan file yatim (berbeda dengan tag Git).
- **Kondisi blokir** saya persempit menjadi: identity terdaftar **dan folder `Sigma/` tidak ada**. Rencana menulis "`Sigma/` atau `activate_status.json` tidak ditemukan"; kondisi harfiah itu akan memblokir `doctor --reconstruct`/`project register` pada proyek rusak di mesin asli (fungsi identity yang terdokumentasi di `engine/reconstruct`). Proyek dengan `Sigma/` tetapi tanpa manifest tetap bisa diperbaiki.
- **Auto-refresh dibatasi ke operasi mutasi.** `session bootstrap` dan perintah read-only lain sengaja tidak menulis (doktrin read-only yang sudah ada).
- **`project sync` tidak menerapkan gitignore pada proyek yang belum pernah memilih**; hanya ON eksplisit yang ditegaskan ulang. Proyek lama yang tidak punya blok `git` ditampilkan `ON [default]` dengan petunjuk menjalankan `sigma config set gitignore on`. Alasan: sync tidak boleh diam-diam mengubah index Git proyek yang sudah berjalan (mis. KLHK).
- **`config_set_gitignore`** saya klasifikasikan `cli_only / deferred` (W3), sama seperti saudara-saudaranya di domain `config`. Perubahan index Git dari MCP belum diputuskan.

## 4. Belum Dikerjakan / Perlu Keputusan Director

1. **Dokumen tata kelola belum saya ubah** (wewenang Director): `Sigma/rules/ARC-RULE.md` §Amendment Request dan `Sigma/SIGMA_PROTOCOL.md` §7.4 masih menyatakan alur hanya-Git dan kalimat "A project without a local Git repository cannot run an amendment", yang kini tidak benar. Usulan: ganti kalimat itu dengan "In snapshot mode (the INTENT is not tracked by Git) the baseline and each amendment are stored under `Sigma/revisions/INTENT-v<N>/` and `--commit` is omitted; the Director's review of the diff and the file hash is unchanged." Agen yang mengikuti teks lama akan mendapat pesan error yang jelas (`--commit is not used`), bukan kegagalan senyap.
2. **Mode lama MCP tanpa root (discovery)** tidak memakai guardrail; konfigurasi yang ditulis `project start/sync` selalu terikat root sehingga tercakup. Konfigurasi sangat lama tanpa root tetap perlu `project sync`.
3. **Rantai lama dengan baseline Git yang kemudian di-gitignore** tetap mode Git dan akan gagal di `intent_tracked`; peralihan ke snapshot untuk rantai itu sengaja tidak otomatis. Opsi: perintah eksplisit `baseline adopt --director-confirm --switch-to-snapshot` (belum ada).
4. `SCHEMA_VERSION` tetap `1.2.0` (field baru opsional). Biner lama yang membaca rantai ber-`snapshot_baseline` menganggapnya tanpa baseline.
5. Rencana menyebut `setup/SIGMA-OPERATION-REGISTRY.json`; berkas itu tidak ada, registry hanya satu (`Sigma/SIGMA-OPERATION-REGISTRY.json`).
6. Tidak dilakukan: commit, instalasi global ulang (`setup update`), sinkronisasi proyek lain (KLHK dll.). `dist/` sudah dibangun ulang.

## 5. Catatan di Luar Lingkup

Selama sesi, `setup/targets/bridge/{AGENTS,CLAUDE,DEEPSEEK,GEMINI}.md` berubah di disk (baris "Default implementation workflow: Plan → Build"). Perubahan itu **bukan** dari kerja ini (tidak ada kode saya yang menulis ke sana; ada proses Claude lain yang berjalan) dan tidak saya sentuh. Periksa sebelum commit agar tidak ikut terbawa tanpa sengaja.

## 6. Keputusan Director (setelah review Gemini) dan tindak lanjutnya

| Keputusan | Tindak lanjut |
|:--|:--|
| A — perbarui dokumen tata kelola: **disetujui** | `Sigma/rules/ARC-RULE.md` (diagram alur, "Latest INTENT first", "Commit and record", "Tag distribution", dua baris tabel Operation Policy) dan `Sigma/SIGMA_PROTOCOL.md` §7.4 kini menjelaskan mode Git dan mode snapshot; kalimat "a project without a local Git repository cannot run an amendment" dihapus. `source_rule_version` di `Sigma/role-memory/arc-memory.json` diperbarui mengikuti hash baru `ARC-RULE.md` (diwajibkan `test/f01-asset-consistency.test.ts`). Proyek dan host menerima teks baru lewat `sigma setup update` lalu `sigma project sync`; itu belum dijalankan. |
| B — opsi (i): hanya peringatan | `sigma config set gitignore on` mendaftar chain RATIFIED yang masih punya `git_baseline` sementara INTENT-nya tidak lagi dilacak, beserta perintah `sigma intent baseline adopt --v <chain> --director-confirm`. Tidak ada perubahan otomatis. Diverifikasi: perintah itu memang mengalihkan chain ke snapshot dan `baseline check` lulus sesudahnya (koreksi atas §4 butir 3 dan §3 laporan awal: opsi `--switch-to-snapshot` tidak diperlukan). |
| Peringatan pull — **disetujui** | Output `config set gitignore on` (saat ada file yang dilepas dari index) memperingatkan bahwa `git pull` di klon lain menghapus file Sigma terlacak dari disk klon itu. Test mereproduksi efeknya dengan Git sungguhan. README dan CHANGELOG memuat peringatan yang sama. |
| C — pertahankan perilaku sekarang | Tidak ada perubahan: `sync` hanya menegaskan ON eksplisit. |

Peringatan dan pemberitahuan chain keluar lewat `warn()` (stdout), konsisten dengan utilitas keluaran yang ada.

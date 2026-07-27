# Bug Report — `smol-toml` missing dari `node_modules`, CLI `sigma` gagal start

- **Tanggal ditemukan:** 2026-07-27
- **Ditemukan di:** sesi Claude Code, project `KLHK_JasaLingkunganHidup`, saat menjalankan `sigma --version`
- **Severity:** Blocker — seluruh CLI `sigma` tidak bisa dijalankan sama sekali (bukan cuma satu subcommand)

## Gejala

```
$ sigma --version
node:internal/modules/cjs/loader:1459
  throw err;
  ^

Error: Cannot find module 'smol-toml'
Require stack:
- /home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/dist/utils/mcpConfig.js
- /home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/dist/commands/setup.js
- /home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/dist/cli.js
- /home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem/bin/sigma.js
    at Module._resolveFilename (node:internal/modules/cjs/loader:1456:15)
    ...
Node.js v24.14.0
```

Karena crash terjadi di level `require()` sebelum `cli.js` sempat parse argumen, **setiap** invocation `sigma` gagal (`sigma --version`, `sigma setup install`, dsb) — bukan hanya perintah tertentu.

## Root cause

1. `package.json` mendaftarkan `smol-toml@^1.7.0` sebagai `dependencies` (dipakai oleh `dist/utils/mcpConfig.js` untuk baca/tulis config TOML Codex).
2. Dependency ini ditambahkan di commit `78975d3` — *"feat(mcp): implement MCP config management for Codex and Antigravity"* (2026-07-22) — bersamaan dengan fitur MCP config baru untuk Codex/Antigravity.
3. Setelah commit itu, `npm install` **tidak pernah dijalankan ulang** di checkout lokal (`/home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem`). Bukti: `stat` menunjukkan `package.json` termodifikasi setelah `node_modules`:
   ```
   1785134039 package.json   (lebih baru)
   1779019880 node_modules   (lebih lama)
   ```
4. `node_modules` di checkout ini hanya berisi 94 folder — jelas tidak lengkap untuk dependency tree sebesar ini (`@modelcontextprotocol/sdk`, `zod`, `commander`, `inquirer`, dst).
5. Binary global `sigma` bukan hasil `npm install -g sigma-ecosystem` dari registry, melainkan **symlink** ke checkout lokal ini (`npm ls -g` → `sigma-ecosystem@0.10.0 -> ./../../../../../Documents/Works/Projects/sigma-ecosystem`, kemungkinan lewat `npm link`). Jadi resolusi dependency global sepenuhnya bergantung pada `node_modules` checkout lokal ini, yang sudah stale.

## Environment

- Node: `v24.14.0`
- npm: `11.11.0`
- OS: Linux (Fedora, kernel 7.1.3-200.fc44.x86_64)
- Install method: `npm link` (dev symlink), bukan `npm install -g sigma-ecosystem` dari registry

## Dampak

- Setiap project yang memakai `sigma` CLI lewat symlink dev ini (termasuk `KLHK_JasaLingkunganHidup`) tidak bisa menjalankan perintah Sigma apa pun sampai dependency di-sync ulang.
- Untuk end user yang install murni via `npm install -g sigma-ecosystem` dari npm registry, bug ini **kemungkinan tidak muncul** — `npm install` dari registry akan resolve seluruh `dependencies` di `package.json` termasuk `smol-toml` secara otomatis dalam satu langkah. Bug ini spesifik ke workflow dev lokal (`npm link` + lupa `npm install` ulang setelah pull/tambah dependency).

## Kenapa tidak bisa "diotomatisasi saat `sigma setup install`"

Sempat muncul pertanyaan apakah `npm install` bisa dipicu otomatis dari dalam `sigma setup install`. Ini tidak mungkin untuk kasus ini secara teknis: crash terjadi di tahap `require()` module Node — sebelum `cli.js` sempat dispatch ke command apa pun, termasuk `setup install`. Proses `sigma` sudah mati duluan sebelum logic `setup install` sempat jalan. Titik otomatisasi yang realistis ada di luar proses CLI itu sendiri, contoh:

- **Git hook** (`post-merge` / `post-checkout`) di repo `sigma-ecosystem` yang menjalankan `npm install` otomatis kalau `package.json` atau `package-lock.json` berubah setelah `git pull`/`checkout`.
- **CI check**: job yang memverifikasi `package-lock.json` sinkron dengan `package.json` (`npm ci` di CI akan gagal loud kalau lockfile tidak sinkron — beda dengan lokal yang silent).
- Kebiasaan dev: selalu `npm install` setelah pull kalau `package.json` berubah (bisa dicek dengan `git diff --stat HEAD@{1} -- package.json`).

## Immediate fix (belum dieksekusi — menunggu keputusan)

```bash
cd /home/dikoharyadhanto/Documents/Works/Projects/sigma-ecosystem
npm install
```

## Saran perbaikan jangka panjang

- Tambahkan git hook `post-merge`/`post-checkout` di repo ini yang auto-run `npm install` saat `package.json`/`package-lock.json` berubah.
- Tambahkan `npm ci --dry-run` (atau setara) sebagai step CI untuk mendeteksi lockfile drift sebelum merge.
- Pertimbangkan dokumentasi singkat di `README.md`/`CONTRIBUTING` bagian dev setup: "setelah `git pull`, selalu jalankan `npm install` sebelum test CLI lokal via `npm link`."

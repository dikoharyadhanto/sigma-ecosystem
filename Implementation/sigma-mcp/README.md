# Sigma MCP Implementation

Folder ini menyimpan desain, laporan implementasi, dan bukti pengujian antarmuka MCP inti Sigma untuk seluruh client AI. Otoritas governance tetap pada Director.

## Status implementasi

| Area | Bukti dan status tercatat |
|---|---|
| Stage 0, Stage A / Gate 0.5, Stage B1 | PASS; laporan Batch 1 bagian 16-17 menutup temuan review dan memverifikasi binding, kontrak, kompatibilitas artefak lama, serta query tanpa mutasi. |
| Stage B2 query expansion | PASS WITH RECORDED TEST DEBT; laporan query batch bagian 11 menerima perbaikan boundary. |
| Stage E bounded writes | Selesai dalam scope keputusan Director; follow-up bagian 7-8 menutup record evidence dan shared inbox archive service. |
| Stage D/F governance transitions | Kode dan test tersedia; capability matrix masih mencatat batch W2 menunggu review independen/Director. Integrasi ke main tidak mengubah status penerimaan tersebut. |

## Antarmuka

- Query server: 23 tool di src/mcp/index.ts.
- Control server: 32 tool di src/mcp/control/index.ts; terpisah dari query dan tidak didaftarkan otomatis oleh setup.
- Transisi governance mengikuti prepare, persetujuan lokal Director, lalu commit. MCP tidak menyediakan tool untuk membuat persetujuan sendiri.
- Pengiriman pesan dan pembacaan inbox/memo tetap melalui CLI/skill. Integrity check dan inbox archive memiliki primitive MCP terbatas.
- Operasi privileged, aktivasi intent lintas-chain, serta perubahan host/global tidak ditambahkan sebagai efek integrasi ini.

## Integrasi main - 6 Oktober 2026

Perubahan inti diambil dari hermes-integration pada 9de8f22, dengan common base 5d6d771. Pembaruan main d4555a3 pada protokol, rules, template, Planned Stage, validasi, dan test roadmap dipertahankan. Folder Implementation/hermes, Discussion, setup, serta konfigurasi integrasi Hermes tidak termasuk perubahan.

Laporan lama di folder ini merupakan bukti historis; label status pada ringkasan awal harus dibaca bersama hasil review dan koreksi di bagian akhir setiap laporan. Bukti consumer historis tidak mengaktifkan atau menambahkan integrasi consumer tersebut.

Fixture gate05-runtime-smoke.mjs yang memakai baseline lab consumer khusus tetap berada pada branch sumber; tidak diintegrasikan ke main. Script smoke Stage C/D dan stress transaksi bersifat project-disposable dan termasuk inti Sigma.

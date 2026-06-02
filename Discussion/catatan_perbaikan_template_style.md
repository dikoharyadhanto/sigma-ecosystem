# Catatan Perbaikan Template Style Sigma

**File**: `catatan_perbaikan_template_style.md`  
**Purpose**: Catatan desain untuk perbaikan style dan struktur template Markdown Sigma.  
**Status**: Draft keputusan hasil diskusi.  
**Scope**: Template style, marker, dan validasi struktur Markdown.  
**Out of Scope**: Penambahan isi template baru seperti Evidence Matrix, Depends On, Evidence Gates, atau section baru yang membuat template lebih berat.

---

## 1. Latar Belakang

Sigma sangat intensif menggunakan dokumen Markdown seperti:

- `DIR-INTENT`
- `ROADMAP`
- `FMN-PLAN`
- `DEV-EXEC`
- `DIR-CLOSE`

Template sekarang sudah cukup disiplin secara isi. Contohnya:

- FMN-PLAN sudah memiliki Acceptance Criteria, Test Contract, Post-Build Test Result, FMN Findings, AUD Findings, dan Director Observation section.
- DEV-EXEC sudah memiliki Source Plan Alignment, Implementation Approach, Developer Verification, Git / Change Evidence, Deviations, Issues, Known Limitations, dan Completion Statement.

Karena itu, arah perbaikan **bukan menambah konten template**, tetapi membuat template lebih stabil untuk AI dan CLI.

Masalah utama yang ingin diperbaiki:

- AI/CLI masih mengandalkan heading atau nomor section.
- Nomor section bisa berubah saat template berkembang.
- Cross-reference berbasis `Section N` bisa patah.
- AI dapat menghapus atau mengubah section penting saat full rewrite.
- CLI belum punya anchor stabil untuk validasi atau update section.
- Template perlu lebih machine-stable tanpa menjadi lebih berat bagi manusia.

---

## 2. Keputusan Utama

Perbaikan yang diterima:

```text
Template markers + document lint/check.
```

Perbaikan yang tidak diambil untuk saat ini:

```text
- Evidence Matrix wajib
- Depends On / task dependency formal
- Evidence Gates formal
- Section baru untuk AC evidence
- Penambahan tabel/struktur baru yang memperberat FMN-PLAN atau DEV-EXEC
```

Intinya:

```text
Perkuat struktur, bukan tambah beban isi.
```

---

## 3. Template Marker

Template marker adalah penanda tersembunyi di Markdown yang digunakan CLI/AI untuk mengenali dokumen dan section secara stabil.

Marker menggunakan HTML comment agar tidak mengganggu pembaca manusia:

```md
<!-- SIGMA:DOC type=FMN_PLAN schema=1 -->
# FMN-PLAN

<!-- SIGMA:FMN_PLAN:SECTION:ACCEPTANCE_CRITERIA -->
## 3. Acceptance Criteria
```

Markdown renderer tidak menampilkan comment tersebut, tetapi CLI dapat membacanya.

---

## 4. Jenis Marker

### 4.1 Document Marker untuk H1

H1 diberi marker dokumen, bukan marker section.

Contoh:

```md
<!-- SIGMA:DOC type=FMN_PLAN schema=1 -->
# FMN-PLAN
```

Fungsi document marker:

- memastikan jenis dokumen benar;
- mencegah file salah template diproses;
- memastikan marker section sesuai artifact type;
- membantu CLI memberi warning jika command memproses dokumen yang salah.

Contoh validasi:

```text
Command expected DEV_EXEC, but document marker says FMN_PLAN.
```

### 4.2 Section Marker untuk H2 Utama

H2 utama diberi marker section.

Contoh:

```md
<!-- SIGMA:FMN_PLAN:SECTION:DEV_HANDOFF -->
## 6. DEV Handoff Instructions
```

Fungsi section marker:

- menjadi anchor stabil;
- tidak bergantung nomor section;
- tidak bergantung perubahan judul;
- membantu CLI mengambil atau memvalidasi section;
- membantu future section-aware editing.

### 4.3 H3/H4 Tidak Perlu Marker Secara Default

H3/H4 tidak perlu marker kecuali benar-benar menjadi target operasi mesin.

Prinsip:

```text
Marker hanya untuk section yang perlu dikenali, divalidasi, diedit, atau direferensikan secara stabil oleh Sigma.
```

---

## 5. Tidak Semua Heading Perlu Marker

Tidak perlu memberi marker pada setiap heading.

Yang diberi marker:

```text
- H1 document identity
- H2 structural sections
- section penting yang punya role ownership, lifecycle rule, atau validasi CLI
```

Yang tidak diberi marker:

```text
- subheading biasa
- notes
- examples
- rationale
- open questions
- detail naratif
```

Alasan:

- marker yang terlalu banyak menjadi noise;
- AI lebih mudah menghapus/merusak marker;
- validator menjadi lebih kompleks;
- maintenance template lebih berat;
- marker yang tidak dipakai mesin tidak memberi value.

---

## 6. Format Marker yang Disarankan

### 6.1 Document Marker

```md
<!-- SIGMA:DOC type=FMN_PLAN schema=1 -->
# FMN-PLAN
```

Artifact type yang disarankan:

```text
DIR_INTENT
ROADMAP
FMN_PLAN
DEV_EXEC
DIR_CLOSE
```

### 6.2 Section Marker

```md
<!-- SIGMA:<ARTIFACT_TYPE>:SECTION:<SECTION_ID> -->
## N. Section Title
```

Contoh:

```md
<!-- SIGMA:FMN_PLAN:SECTION:ACCEPTANCE_CRITERIA -->
## 3. Acceptance Criteria
```

```md
<!-- SIGMA:DEV_EXEC:SECTION:GIT_EVIDENCE -->
## 9. Git / Change Evidence
```

---

## 7. Marker dengan Attribute Opsional

Untuk section dengan lifecycle/mutation rule, marker dapat diberi attribute.

Contoh:

```md
<!-- SIGMA:FMN_PLAN:SECTION:DIRECTOR_OBSERVATION_TESTING_REPORT mode=append_only_after_plan_lock -->
## 10. Director Observation Testing Report
```

```md
<!-- SIGMA:FMN_PLAN:SECTION:DIRECTOR_FOLLOW_UP_DECISION_NOTES mode=always_writable -->
## 11. Director Follow-Up Decision Notes
```

Attribute yang mungkin berguna:

```text
mode=locked_after_plan_lock
mode=append_only_after_plan_lock
mode=always_writable
owner=FMN
owner=DEV
owner=DIRECTOR
owner=AUD
```

Catatan: attribute tidak wajib untuk semua marker. Pakai hanya jika memberi value langsung pada validasi CLI.

---

## 8. Contoh FMN-PLAN Marker Minimal

```md
<!-- SIGMA:DOC type=FMN_PLAN schema=1 -->
# FMN-PLAN

<!-- SIGMA:FMN_PLAN:SECTION:SOURCE_ALIGNMENT mode=locked_after_plan_lock -->
## 1. Source Alignment

<!-- SIGMA:FMN_PLAN:SECTION:WORK_ORDER_TASK_PLAN mode=locked_after_plan_lock -->
## 2. Work Order / Task Plan

<!-- SIGMA:FMN_PLAN:SECTION:ACCEPTANCE_CRITERIA mode=locked_after_plan_lock -->
## 3. Acceptance Criteria

<!-- SIGMA:FMN_PLAN:SECTION:IMPLEMENTATION_CONSTRAINTS mode=locked_after_plan_lock -->
## 4. Implementation Constraints

<!-- SIGMA:FMN_PLAN:SECTION:PRE_BUILD_TEST_CONTRACT mode=locked_after_plan_lock -->
## 5. Pre-Build Test Contract

<!-- SIGMA:FMN_PLAN:SECTION:DEV_HANDOFF_INSTRUCTIONS mode=locked_after_plan_lock -->
## 6. DEV Handoff Instructions

<!-- SIGMA:FMN_PLAN:SECTION:POST_BUILD_TEST_RESULT mode=locked_after_plan_lock -->
## 7. Post-Build Test Result

<!-- SIGMA:FMN_PLAN:SECTION:FMN_FINDINGS_ADVISORY mode=locked_after_plan_lock -->
## 8. FMN Findings & Advisory Recommendation

<!-- SIGMA:FMN_PLAN:SECTION:AUD_FINDINGS mode=locked_after_plan_lock -->
## 9. AUD Findings — Advisory, Optional

<!-- SIGMA:FMN_PLAN:SECTION:DIRECTOR_OBSERVATION_TESTING_REPORT mode=append_only_after_plan_lock -->
## 10. Director Observation Testing Report

<!-- SIGMA:FMN_PLAN:SECTION:DIRECTOR_FOLLOW_UP_DECISION_NOTES mode=always_writable -->
## 11. Director Follow-Up Decision Notes
```

---

## 9. Contoh DEV-EXEC Marker Minimal

```md
<!-- SIGMA:DOC type=DEV_EXEC schema=1 -->
# DEV-EXEC

<!-- SIGMA:DEV_EXEC:SECTION:SOURCE_PLAN_ALIGNMENT -->
## 1. Source Plan Alignment

<!-- SIGMA:DEV_EXEC:SECTION:IMPLEMENTATION_APPROACH -->
## 2. Implementation Approach

<!-- SIGMA:DEV_EXEC:SECTION:FILES_COMPONENTS_TO_CHANGE -->
## 3. Files / Components To Change

<!-- SIGMA:DEV_EXEC:SECTION:KEY_TECHNICAL_DECISIONS -->
## 4. Key Technical Decisions

<!-- SIGMA:DEV_EXEC:SECTION:IMPLEMENTATION_WALKTHROUGH -->
## 5. Implementation Walkthrough

<!-- SIGMA:DEV_EXEC:SECTION:DEVIATIONS_FROM_PLAN -->
## 6. Deviations From FMN-PLAN

<!-- SIGMA:DEV_EXEC:SECTION:DEPENDENCY_ENVIRONMENT_CHANGES -->
## 7. Dependency / Environment Changes

<!-- SIGMA:DEV_EXEC:SECTION:DEVELOPER_VERIFICATION -->
## 8. Developer Verification

<!-- SIGMA:DEV_EXEC:SECTION:GIT_CHANGE_EVIDENCE -->
## 9. Git / Change Evidence

<!-- SIGMA:DEV_EXEC:SECTION:ISSUES_ENCOUNTERED -->
## 10. Issues Encountered

<!-- SIGMA:DEV_EXEC:SECTION:KNOWN_LIMITATIONS_TECH_DEBT -->
## 11. Known Limitations / Technical Debt

<!-- SIGMA:DEV_EXEC:SECTION:DEV_COMPLETION_STATEMENT -->
## 12. DEV Completion Statement
```

---

## 10. Cross-Reference Style

Sigma documents should avoid numeric section references.

Avoid:

```text
See Section 8.
As stated in Section 10.
```

Prefer:

```text
See DEV Handoff Instructions.
See Director Observation Testing Report.
See AC-003.
See TC-002.
```

Reason:

```text
Section numbers can shift. Section titles, IDs, and markers are more stable.
```

If numeric references are used, CLI may warn during document check or lock preflight.

---

## 11. Template Lint / Check

Tambahkan command validasi mekanis.

Pilihan command:

```bash
sigma plan check
sigma exec check
```

atau:

```bash
sigma doc check
```

Validasi yang disarankan:

- document marker exists;
- document marker type matches command context;
- required section markers exist;
- duplicate markers do not exist;
- unknown markers produce warning;
- H2 heading exists after each section marker;
- required section order is valid if order matters;
- mutable mode markers are consistent with lock rules;
- numeric `Section N` references produce warning if target heading is missing;
- SIGMA markers were not removed or renamed.

Cek ini mekanis, bukan AI review.

---

## 12. Lock-Time Validation

Saat `sigma plan lock` atau `sigma exec lock`, CLI bisa menjalankan validation ringan.

Untuk marker wajib:

```text
Missing required marker should block lock.
Duplicate required marker should block lock.
Unknown marker should warn.
Numeric section reference mismatch should warn, not block.
```

Rationale:

- marker wajib hilang berarti struktur template rusak;
- duplicate marker membuat section identity ambigu;
- numeric reference mismatch tidak selalu fatal, tapi perlu diketahui.

---

## 13. Jangan Mengubah Isi Template Besar-besaran

Perbaikan ini tidak bertujuan menambah isi baru.

Yang tidak diambil:

```text
- mandatory AC Evidence Matrix
- formal task dependency / Depends On
- Evidence Gates section
- extra test section
- extra audit table
```

Reason:

```text
Template sekarang sudah cukup disiplin secara isi. Perbaikan yang dibutuhkan adalah machine stability, bukan content expansion.
```

---

## 14. Migration Strategy

### 14.1 Plan Baru

Marker diterapkan pada template baru saja.

### 14.2 Dokumen Lama

Dokumen lama tidak wajib dimigrasikan kecuali akan diproses oleh command baru yang membutuhkan marker.

Pilihan migration:

```bash
sigma template migrate-markers --file <path>
```

atau:

```bash
sigma plan migrate-markers --v <version>
sigma exec migrate-markers --v <version>
```

Migration harus hati-hati:

- backup file lama;
- insert marker sebelum heading yang cocok;
- jangan mengubah isi section;
- report marker yang tidak bisa dipasang otomatis.

---

## 15. Risiko

### 15.1 AI menghapus marker saat full rewrite

Solusi:

```text
Lock/check command memvalidasi marker wajib.
Skill/rule mengingatkan: do not remove SIGMA markers.
```

### 15.2 Marker terlalu banyak

Solusi:

```text
Marker hanya H1 dan H2 structural sections.
```

### 15.3 Template terlihat teknis

Solusi:

```text
Gunakan HTML comment agar marker tersembunyi saat rendered.
```

### 15.4 Marker menjadi source of truth baru

Solusi:

```text
Marker hanya structural identity.
Runtime truth tetap progress.json dan Sigma CLI.
Semantic content tetap artifact body.
```

---

## 16. Final Recommendation

Implementasi yang disarankan:

1. Tambahkan H1 document marker di setiap artifact template.
2. Tambahkan H2 section marker untuk structural sections utama.
3. Tambahkan attribute `mode` hanya untuk section yang punya mutability rule.
4. Tambahkan `sigma plan check` dan `sigma exec check`.
5. Jalankan marker validation saat lock.
6. Hindari numeric section references di template baru.
7. Jangan menambah content-heavy section baru.

---

## 17. Final Principle

```text
Markers stabilize structure.
Lint protects integrity.
Templates stay lightweight.
AI writes content; CLI protects shape.
```

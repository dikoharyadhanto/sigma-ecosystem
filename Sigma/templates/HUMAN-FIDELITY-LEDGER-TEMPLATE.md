<!-- INTERNAL — never published, never pushed to Notion, never scanned for terminology. Generated alongside every *-HUMAN document as <same-filename>.fidelity.md. See PLAN-IMPL-SIGMA-HUMANIZE-OPERATION-20260816 §2.3 (CR-02, CR-05) / §7.4 (Draft v2 — coverage mechanism fixed for source tables that have no ID column). -->

> This file exists to make fidelity reviewable instead of self-declared. It is the only place internal artifact IDs, table names, and governance vocabulary are allowed to appear in the humanize output — none of that may leak into the published document this file accompanies.
>
> **Coverage rule, two modes.** Some source tables have a formal ID column (`CON-007`, `TASK-001`, ...) — reference those directly in Source Reference. Other source tables have no ID column at all (this is the normal case for DIR-CLOSE, and applies to some tables even in DIR-INTENT/FMN-PLAN/DEV-EXEC) — for those, reference each row as `<Table Name> #<row number>`, e.g. `Known Limitations #2`. Every row in every material source table must be accounted for one way or the other. A table with zero ID'd rows is not a table with nothing to check — `checkFidelityCoverage()` counts its rows and requires a matching count of Ledger entries referencing that table name. An empty coverage requirement is a red flag, not a pass.
> **Preserve rule**: any item classified Preserve must be quoted verbatim from the source in the Verbatim Source Text column — not paraphrased, not summarized. If the wording in the published document differs from this quote, that is expected (the published version is written for a general reader); what must not differ is the substance.

# Source Fidelity Ledger — [Document Title] [version]

Source document(s): [...]
Published document: [...]

| Source Reference | Classification | Verbatim Source Text (Preserve only) | Note (Compress/Omit) |
| :--- | :--- | :--- | :--- |
| [e.g. `CON-007` or `Known Limitations #2`] | Preserve / Compress / Omit | [exact quote if Preserve, else blank] | [one line: why compressed, or why omitted] |

---

## Coverage Check

- [ ] Every ID'd row in the source appears exactly once above.
- [ ] Every un-ID'd source table's row count matches the number of Ledger entries referencing that table name — not just "some rows," all of them.
- [ ] Every row classified Preserve has a non-empty verbatim quote.
- [ ] Every row classified Omit has a stated reason — "not relevant to a human reader" is acceptable, silence is not.
- [ ] If a source table has zero rows to report (e.g. no deviations occurred), state that explicitly here rather than leaving the table absent from this Ledger — an empty source table and an unchecked source table must not look the same.

## Reviewer Note

> Optional. Anything a human reviewer should know before trusting this ledger that isn't captured in the table above.

[...]

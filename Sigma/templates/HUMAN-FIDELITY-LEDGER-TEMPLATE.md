<!-- INTERNAL — never published, never pushed to Notion, never scanned for terminology. Generated alongside every *-HUMAN document as <same-filename>.fidelity.md. See PLAN-IMPL-SIGMA-HUMANIZE-OPERATION-20260816 §2.3 (CR-02, CR-05) / §7.4. -->

> This file exists to make fidelity reviewable instead of self-declared. It is the only place internal artifact IDs, section references, and governance vocabulary are allowed to appear in the humanize output — none of that may leak into the published document this file accompanies.
>
> **Coverage rule**: every ID from a structured source table (constraint, risk, requirement, assumption IDs — whatever format the source uses) must appear exactly once below, regardless of how it was treated. An ID with no row here is a gap, not a silent Compress/Omit — `checkFidelityCoverage()` treats it as a failure before push is allowed.
> **Preserve rule**: any item classified Preserve must be quoted verbatim from the source in the Verbatim Source Text column — not paraphrased, not summarized. If the wording in the published document differs from this quote, that is expected (the published version is written for a general reader); what must not differ is the substance.

# Source Fidelity Ledger — [Document Title] [version]

Source document(s): [...]
Published document: [...]

| Source ID | Classification | Verbatim Source Text (Preserve only) | Note (Compress/Omit) |
| :--- | :--- | :--- | :--- |
| [e.g. CON-007] | Preserve / Compress / Omit | [exact quote if Preserve, else blank] | [one line: why compressed, or why omitted] |

---

## Coverage Check

- [ ] Every structured ID in the source appears exactly once above.
- [ ] Every row classified Preserve has a non-empty verbatim quote.
- [ ] Every row classified Omit has a stated reason — "not relevant to a human reader" is acceptable, silence is not.

## Reviewer Note

> Optional. Anything a human reviewer should know before trusting this ledger that isn't captured in the table above.

[...]

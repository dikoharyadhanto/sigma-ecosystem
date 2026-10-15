> **DRAF UNTUK PERSETUJUAN, bukan template yang berlaku.**
> Berkas ini mengusulkan `Sigma/templates/PRODUCT-REVIEW-TEMPLATE.md` (artefak baru, schema 1). Badan template di bawah garis adalah teks akhir yang diusulkan (bahasa Inggris). Dasar: keputusan Director 15 Oktober 2026 pada `DISKUSI_SIGMA_CLOSURE_PRODUCT_REVIEW_SKORING_2026-10-15.md`, Bagian 3F dan 3G.
> Penamaan berkas artefak (konvensi tanpa prefiks): `Sigma/review/PRODUCT-REVIEW-vN.md`, versi mengikuti versi INTENT.

---

<!-- SIGMA:DOC type=PRODUCT_REVIEW schema=1 -->
# PRODUCT-REVIEW

> Review of the final product against the standards of the RATIFIED INTENT. One per INTENT. Created when the Director states that the final product is ready. ARC, AUD, and the Director each give one verdict; `sigma close new` reads the three verdicts from this document.
> Lock state is managed by Sigma CLI. Do not record it here.

> **How this document works.**
>
> - Each round opens with FMN's request (Review Request), written by ARC from FMN's message. Then the verdict order: ARC first, then AUD (unless skipped), then the Director. Every party assesses in round 1, whatever the others concluded.
> - ARC, AUD, and the Director review independently, each from its own viewpoint and with its own method. No party judges another's review: none states agreement, disagreement, or doubt about it. AUD may use the ARC section as baseline information.
> - ARC assesses the consistency of the final product with the written standards of the INTENT, with freer exploration and verification. AUD assesses as an independent user who sees the product and responds on its own, within the access the Director provides. The Director assesses as the project owner, the main intent against the reality of the product; the judgment may be subjective and may be given without notes.
> - Only `PASS` and `PASS_WITH_RISK` are accepted. A verdict of `PASS` or `PASS_WITH_RISK` is permanent: it is not changed and not reviewed again.
> - A party whose verdict is `REVISE` or `REJECT_RECOMMENDED` reviews again in the next round, after FMN's corrections. Only that party assesses in later rounds.
> - Findings are append-only: add a `<Party> - Round <N>` block; never edit a prior block. Only the verdict checkbox changes.
> - Reopening a permanent verdict is the Director's decision, made outside this document by asking FMN for a correction.
>
> **Verdict meanings.**
>
> | Verdict | Meaning |
> |:--- |:--- |
> | PASS | The product meets the standards. No action. |
> | PASS_WITH_RISK | Acceptable; the listed risks are known and left as they are. Before CLOSE is created the Director is asked whether to proceed or to return to FMN to address them. The verdict does not change either way. |
> | REVISE | Corrections are required and the product is reviewed again. |
> | REJECT_RECOMMENDED | The product should not be accepted as it stands; the flaw is not a matter of small corrections. |

---

<!-- SIGMA:PRODUCT_REVIEW:SECTION:PRODUCT_UNDER_REVIEW -->
## Product Under Review

### Product

[Form and location of the final product, as stated by the Director.]

### INTENT Assessed

[INTENT version and revision this review is made against.]

### Director Statement (verbatim)

[The Director's statement that the final product is ready.]

---

<!-- SIGMA:PRODUCT_REVIEW:SECTION:REVIEW_REQUEST -->
## Review Request

> Written by ARC from FMN's message sent with `sigma send`, as the opening of each round. FMN sends it only after the Director approves a review. FMN states why now is the right time to review the final product and, in later rounds, what was corrected in response to the latest verdicts. These are FMN's claims, not evidence: ARC, AUD, and the Director assess the product independently. DEV must not write here.

### Findings

> Append-only. Add an `FMN - Round <N>` block per round; never edit a prior block. Round 1 gives the justification and the basis for review. An open Gate 3 is not a justification by itself. Later rounds state the corrections made in response to the required corrections of the latest verdicts, item by item, with PLAN and EXEC references.

FMN - Round 1:

Justification: [Why this is the right time for a final product review: the final product exists in a reviewable form, and what makes it so.]

Basis for review: [LOCKED PLAN and EXEC pairs and evidence references that support the claim.]

Standards believed met: [Desired Outcome and Acceptance / REQ-nnn / Quality dimension, by ID or name.]

Known gaps and limitations: [items, or none]

---

<!-- SIGMA:PRODUCT_REVIEW:SECTION:ARC_REVIEW -->
## ARC Review

> Written by ARC. ARC tests the final product against each assessable standard of the INTENT and chooses the method. The standards come from Desired Outcome and Acceptance, each Core Requirement, each Quality Standards dimension that is not N/A, and Project Failure. Refer to a standard by ID or name; do not restate it. Any evidence may be used, including process evidence, when it determines whether the result is valid. Evidence that cannot be obtained is recorded as not verified.

### Verdict

> Pick one.

- [ ] PASS
- [ ] PASS_WITH_RISK
- [ ] REVISE
- [ ] REJECT_RECOMMENDED

### Findings

> Append-only. Add an `ARC - Round <N>` block per round. The status column is informative and is not read by the CLI.

ARC - Round 1:

| Standard | Method | Result | Status |
|:-------- |:------ |:------ |:------ |
| [Desired Outcome and Acceptance / REQ-nnn / Quality dimension / Project Failure] | [...] | [...] | Satisfied / Partially / Not satisfied / Not verified |

Not verified: [items, or none]

Risks left as they are (for PASS_WITH_RISK): [items, or none]

Required corrections: [numbered items for FMN, or none]

---

<!-- SIGMA:PRODUCT_REVIEW:SECTION:AUD_REVIEW -->
## AUD Review

> Advisory content written by ARC from an AUD message, or from audit results the Director relays. DEV must not write here. Transcribe the verdict and the findings exactly as AUD stated them; ARC adds no comment or interpretation. AUD may use the ARC section as baseline information but does not state agreement, disagreement, or doubt about it. Verdict meanings and selection criteria are in AUD-RULE.

### Verdict

> Pick one. If none fit, tick OTHER and describe; OTHER is not an accepted verdict.

- [ ] PASS
- [ ] PASS_WITH_RISK
- [ ] REVISE
- [ ] REJECT_RECOMMENDED
- [ ] OTHER: [describe]
- [ ] SKIP_FOR_AUDIT - Director explicitly approved skipping audit for this review

**Director Instruction (verbatim)** *(required only if SKIP_FOR_AUDIT is checked; the Director's exact words)*: [...]

### Findings

> Append-only. Add an `AUD - Round <N>` block per round; never edit a prior round.

AUD - Round 1:

1. [...]

Risks left as they are (for PASS_WITH_RISK): [items, or none]

Required corrections: [numbered items for FMN, or none]

---

<!-- SIGMA:PRODUCT_REVIEW:SECTION:DIRECTOR_REVIEW -->
## Director Review

> Written by ARC from the Director's statement in conversation. ARC transcribes the verdict as the Director stated it and does not alter it. The Director's instruction may be the verdict alone; notes are not required.

### Verdict

> Pick one.

- [ ] PASS
- [ ] PASS_WITH_RISK
- [ ] REVISE
- [ ] REJECT_RECOMMENDED

**Director Instruction (verbatim)** *(the Director's exact words)*: [...]

### Notes

> Optional. Notes ARC writes from what the Director conveyed in conversation. Append-only per round.

Director - Round 1:

[...]

Risks left as they are (for PASS_WITH_RISK, optional): [items]

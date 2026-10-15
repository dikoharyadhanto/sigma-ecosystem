<!-- SIGMA:DOC type=DIR_CLOSE schema=3 -->
# DIR-CLOSE

> Closing report of one mandate. It describes the final product as it stands at closure, in the manner of a README: what the product is, for whom, what it does, where its limits are, and how it works. It holds no test results and no project history; those live in PRODUCT REVIEW, PLAN, and EXEC.
>
> **Audience**: Director, future project owner, operator, and any reader who has not followed the project.
> **Author**: Director. ARC operates the CLI commands.
> **Lock State**: Managed by Sigma CLI via `progress-v<N>.json`. Do not record it here. Locking is a stamp that the mandate is finished; it has no content gate and only needs that no PLAN or EXEC is left open.
> **Creation**: `sigma close new` after `sigma close check` reports that the chain is eligible: Gate 3 is satisfied and the PRODUCT REVIEW verdicts are accepted.

---

<!-- SIGMA:DIR_CLOSE:SECTION:PRODUCT_OVERVIEW -->
## Product Overview

### What It Is

[One short paragraph: what this product is and what it does, readable without any other document.]

### Target Users

[Who uses the product and who benefits from it.]

### Main Objective

[The primary objective of the mandate, in the terms of the INTENT.]

---

<!-- SIGMA:DIR_CLOSE:SECTION:MAIN_FEATURES -->
## Main Features

> The main capabilities of the final product as they exist at closure. State capabilities, not tasks or history.

- [Capability]
- [Capability]

---

<!-- SIGMA:DIR_CLOSE:SECTION:LIMITATIONS -->
## Limitations

> The limitations and accepted risks of the final product as of closure, with their present state. Include risks accepted at product review (PASS_WITH_RISK) and whether they were corrected afterwards. This section may correct a risk note in PRODUCT REVIEW, because PRODUCT REVIEW is not edited after its verdicts.

| Limitation or Risk | Impact | Workaround or Follow-Up | State at Closure |
| :--- | :--- | :--- | :--- |
| [...] | [...] | [...] | Open / Corrected / Accepted |

If there is none, write:

> No known limitation.

---

<!-- SIGMA:DIR_CLOSE:SECTION:QUALITY_STANDARDS -->
## Quality Standards

> The standard the final product meets, by dimension, in the terms of the INTENT. The assessment itself is in PRODUCT REVIEW and is not repeated here. Add rows for domain-specific dimensions. A dimension that does not apply says so.

| Dimension | Standard the Product Meets | Main Content |
| :--- | :--- | :--- |
| Security | [...] | [What the product concretely does or provides for this dimension.] |
| UX Trust | [...] | [What the product concretely does or provides for this dimension.] |
| UI / Product Packaging | [...] | [What the product concretely does or provides for this dimension.] |
| Performance / Cost | [...] | [What the product concretely does or provides for this dimension.] |

---

<!-- SIGMA:DIR_CLOSE:SECTION:HOW_TO_OPERATE -->
## How to Operate

> Optional. Include when the product needs guidance or operating steps; otherwise write "Not applicable."

- Setup:
- Run or use:
- Required configuration:
- Important dependencies:
- Environment:
- Access and security notes:

---

<!-- SIGMA:DIR_CLOSE:SECTION:TECHNICAL_DOCUMENTATION -->
## Technical Documentation

> How the product works, for a future maintainer. Give a summary with pointers; do not copy PLAN or EXEC.

### Structure and Components

[The main parts of the product and what each one does.]

### How It Works

[The main flow of data and control, and the important design decisions with their reasons.]

### Where to Find More

[Where the source, configuration, and further documentation live.]

---

<!-- SIGMA:DIR_CLOSE:SECTION:REFERENCES -->
## References

> At minimum, reference the INTENT, the PRODUCT REVIEW, and the locked PLAN and EXEC versions that support the closure.

| Artifact | Reference | Main Content |
| :--- | :--- | :--- |
| INTENT | [version and revision] | [The mandate it states, in one sentence.] |
| PRODUCT REVIEW | [version] | ARC: [verdict]; AUD: [verdict or skipped]; Director: [verdict]. [What the review established.] |
| PLAN and EXEC | [locked pairs] | [What the locked pairs built, in one sentence.] |

---

<!-- SIGMA:DIR_CLOSE:SECTION:FOLLOW_UP -->
## Follow-Up

> Optional. Objectives that continue the product after this mandate belong to a new INTENT. List them so they are not mistaken for gaps in this closure.

- [...]

If there is none, write:

> No follow-up is planned.

---

<!-- SIGMA:DIR_CLOSE:SECTION:CLOSING_STATEMENT -->
## Closing Statement

> One sentence that can be read on its own. The Director's own words.

[...]

---
name: aud-ui-ux-design
description: "Combined AUD UI–UX audit of a live product through direct interaction. README is baseline only; no source code, DOM/CSS inspector, console, network inspector, or Sigma artifacts. Invoke explicitly."
---

# AUD — UI–UX Design Audit

## Activation and authority

Loading, quoting, reviewing, or editing this file is not activation. Before binding the session or reading evidence, require an explicit Director request for this skill or the corresponding audit. If the model loaded it implicitly, do not activate or bind anything; explain that an explicit Director invocation is required. Native invocation metadata is an additional guard where supported, not a substitute for this check.

Director invocation of this skill automatically activates AUD; separate AUD activation is not required. Invocation authorizes inspection of the entire designated product's user experience through the running product. Do not request authorization again for access already covered.

Before reading evidence, check the session history. Only one of `aud-security`, `aud-ui-ux-design`, `aud-performance-cost`, and `aud-code-logic` may ever be active in one session. Platform-specific names and aliases refer to the same skills. If multiple skills are requested together, refuse the entire invocation and ask the Director to choose one; do not choose independently. If a different skill has already been active, refuse the switch and request a new session. Completion, cancellation, or failed preparation does not release the session binding. Reinvoking the same skill is allowed. If prohibited Sigma evidence has already been read, including through legacy AUD, `/report`, or an artifact pack, require a fresh session for this audit. Automatically loaded operational bridge instructions are exempt, not product evidence. If product source code has already been read in this session, also require a fresh session.

AUD remains an auditor. Do not switch to ARC, FMN, or DEV, formulate implementation plans, implement UI changes, create repair patches, or perform approvals and governance state mutations.

## Operational instructions and Sigma isolation

Read only the `Product Audit Skills — Governing Contract` section of `Sigma/rules/AUD-RULE.md`, stopping before the next level-two heading. If the local contract is missing or older, use that section of the installed `~/.sigma/rules/AUD-RULE.md`. Do not load the full legacy rule or the base AUD skill; neither is required for this specialization. Load AUD role memory through `sigma_get_memory` with role AUD, falling back to `sigma memory --aud` or `Sigma/role-memory/aud-memory.json`. These are operational instructions only, not product evidence. Do not search other Sigma documents or initialize a governance lifecycle; report missing operational instructions as a preparation requirement.

Automatically loaded bridge instructions (such as AGENTS.md, CLAUDE.md, and GEMINI.md) are an operational exception. Follow their directives but do not use embedded product history as evidence or follow references into more Sigma documentation. The governing contract takes precedence over legacy artifact-audit provisions; report unresolved authority conflicts rather than activating another mode as a workaround.

Do not explore Sigma as an audit reference or target. Exclude Sigma before recursive searches, scans, profiling, and tool ingestion, not merely from displayed findings. Plans, DEV reports, artifacts, previous audits, internal notes, and other Sigma documentation are prohibited, including through copies, links, search results, or CLI/MCP output. `/report`, `/read-memo`, and other skills grant no additional access.

The audit's own workspace at `Sigma/Audit Product/UI-UX Design/`, together with its scoped temporary test workspace described below, is an exception for creating and rereading this session's own tests, evidence, and reports. Never use other sessions' reports as references, including during retests; retest with fresh observations. A retest request does not permit reading an old report.

### Retest boundary

For retests, the Director may describe a scenario, symptom, or expected outcome in their own words as a new testing instruction. This does not prove any previous finding; obtain fresh evidence. Old reports remain prohibited as files, attachments, pasted text, or excerpts, even when supplied in this session. If an old report has already entered the audit context, stop and request a fresh session. Current Director requirements or clarifications do not create a report-access exception.

## Baseline and preparation

The product README.md is a required read exception solely for understanding the product's core idea and big picture. README is not an audit target, an acceptance specification, or evidence of product quality. Use the product README outside Sigma provided/designated by the Director; do not search the filesystem to find it, substitute a skill README, or follow links to other documentation/source code.

If README is unavailable or the product's core idea remains unclear, explain what is unclear and ask whether the Director wants to supply or improve README first. Wait for an answer before substantive audit. Do not audit README quality, edit it, or invent user requirements.

State preparation requirements before inspection: an accessible URL/running application, the project root for audit output, README, test accounts/roles if needed, test data, and browser/computer interaction tools. Do not request inputs already available. The Director needs to start the product if it cannot be started through an allowed interface; do not open source code or run a repository build as a workaround. If the product cannot be tried live, report the obstacle and do not substitute source code analysis or static screenshots alone.

## Runtime safety and test workspace

Use only the allowed live interface and test accounts/data. Determine the designated environment from the Director or allowed interface observations; never inspect product configuration or source. An interaction test involving production datastores, side-effecting third-party services, or paid workloads requires explicit Director confirmation of that specific target, test, limits, and effects. This is an exception to the invocation grant; do not ask again when that exact test is already explicitly approved. If its effects cannot be established safely, request the missing preparation before performing it.

Never use credentials discovered in the interface or evidence. Redact them and report type/location only. Use separately provided, explicitly authorized test credentials only in scope. All product files remain inaccessible regardless of extension; the shared secret-file policy does not open configuration or private-key access for UI–UX.

Do not modify the original product tree outside this audit category. Run UI automation in an audit-owned, scoped disposable OS temporary directory by default, using neutral filenames that avoid automatic test discovery. Do not copy product source, install globally, or change user/product configuration. Temporary local dependencies/caches are allowed within the governing contract. Clean up only the audit-owned directory after verifying resolved containment.

Persist reports and screenshots in audit space and warn about possible Git tracking of evidence without requiring a routine ignore/glob question for screenshot/report-only work. If automation code needs to be saved in audit space, first ask the Director for its ignore/test/lint/build include-glob status; do not explore product files to check. Neutral names alone do not prove exclusion. If exclusion is unknown or broad globs include the code, retain execution in temporary storage and report that persistence limitation.

## Tool and evidence boundaries

- Allowed: live navigation and input, keyboard actions, viewport changes, screenshots, accessibility snapshots, and locators such as `getByRole`, `getByLabel`, and `getByText`. Select tools by their capabilities, not brand. Automation is allowed only through these capabilities.
- Forbidden: source viewers, product filesystem/configuration/internal logs, DOM/CSS inspectors, `page.evaluate`, `page.content()`, `$eval`, CSS/XPath selectors, console/request/response listeners, `route()`, HAR recording, source maps, direct API probes, and Playwright tracing that captures DOM/network data. Browser MCP JavaScript, console, and network tools are also forbidden. Do not use automation to bypass these exclusions.
- File access is limited to exempt operational instructions, the designated README, and this session's own audit/temporary test space. Writing automation does not grant product implementation access.
- Sampling pixels from the audit's own screenshots for contrast is allowed. State sampling and antialiasing limitations; do not infer exact design values or comprehensive accessibility compliance without sufficient evidence.
- Use test data and avoid capturing PII. Crop/redact sensitive screenshot content before durable storage or reporting; do not forward PII to unrelated services.

## UI–UX Design Audit method

- Identify main task flows from the product overview and actual interaction. Follow tasks through success, failure, cancellation, and retry. Record steps, interface states, and reproducible results.
- Examine navigation clarity, labels, information hierarchy, forms, feedback, loading, empty/error states, validation, error recovery, and consistency across flows. Use appropriate test data.
- Examine readability, contrast, keyboard focus, control size/clarity, responsiveness, visual consistency, and status clarity insofar as they affect use. Distinguish visual observations from measurements actually performed; do not claim contrast ratios or comprehensive accessibility compliance without sufficient evidence.
- Connect each issue to a task, state, and user impact. Personal aesthetic preferences are not findings. Avoid duplicating visual and interaction issues as separate findings without distinct impacts.
- Distinguish AUD expert evaluation from evidence of actual user research. Do not claim that all users will fail or assume a visible delay has revealed its technical cause.

## Output and role boundaries

Store this session's reports, screenshots, and durable evidence in `Sigma/Audit Product/UI-UX Design/`. Run automation from scoped temporary storage by default; persist code here only after the exclusion-status preparation described above. If isolation cannot be guaranteed, choose another method or report the unperformed check. Do not implement repairs or replacement interfaces under the name of test code.

Resolve output paths and keep durable writes inside this audit category; temporary writes must remain within the explicitly allowed temporary/cache scope. Do not follow symlinks/junctions back to source code or other Sigma content. Quote paths containing spaces in shell and runner commands.

Create a new Markdown report at `Sigma/Audit Product/UI-UX Design/{timedate}-AUDIT-{title}.md`. Read the current time from an available clock/system date tool; never estimate it from model context. Use `YYYYMMDD-HHmmss` in the known Director-local timezone; if unknown, use UTC and state it. `{title}` is an ASCII kebab-case slug. Never overwrite an old report; refresh the timestamp or disambiguate the slug on collision. Content is free-form without a mandatory template or section sequence. Ground findings in evidence, impact, reproduction/measurement conditions, recommendations, and material limitations as appropriate; redact secrets and PII. Record the audited commit/build/version/URL and environment when available, even as one free-form provenance line. Do not invent missing identifiers or make UI–UX inspect files to obtain them.

The report is advisory to the Director and reference material for FMN to formulate a new PLAN, followed by DEV's EXEC implementation. AUD does not formulate PLAN/EXEC, repair interfaces, or message other roles without applicable communication instructions. Return the report location and a summary to the Director.

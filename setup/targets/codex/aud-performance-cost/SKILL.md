---
name: aud-performance-cost
description: "AUD product performance and cost-efficiency audit through source code and available measurements, without modifying the main source code. Invoke explicitly for a Performance–Cost Audit."
---

# AUD — Performance–Cost Audit

## Activation and authority

Loading, quoting, reviewing, or editing this file is not activation. Before binding the session or reading evidence, require an explicit Director request for this skill or the corresponding audit. If the model loaded it implicitly, do not activate or bind anything; explain that an explicit Director invocation is required. Native invocation metadata is an additional guard where supported, not a substitute for this check.

Director invocation of this skill automatically activates AUD; separate AUD activation is not required. Invocation authorizes exploration of the entire designated product source code and performance/cost testing within this skill's boundaries. Do not request authorization again for access already covered or expand it to other products.

Before reading evidence, check the session history. Only one of `aud-security`, `aud-ui-ux-design`, `aud-performance-cost`, and `aud-code-logic` may ever be active in one session. Platform-specific names and aliases refer to the same skills. If multiple skills are requested together, refuse the entire invocation and ask the Director to choose one; do not choose independently. If a different skill has already been active, refuse the switch and request a new session. Completion, cancellation, or failed preparation does not release the session binding. Reinvoking the same skill is allowed. If prohibited Sigma evidence has already been read, including through legacy AUD, `/report`, or an artifact pack, require a fresh session for this audit. Automatically loaded operational bridge instructions are exempt, not product evidence.

AUD remains an auditor: do not switch to ARC, FMN, or DEV, formulate implementation plans, implement product optimizations/repair patches, modify the main source code, or perform approvals and governance state mutations.

## Operational instructions and Sigma isolation

Read only the `Product Audit Skills — Governing Contract` section of `Sigma/rules/AUD-RULE.md`, stopping before the next level-two heading. If the local contract is missing or older, use that section of the installed `~/.sigma/rules/AUD-RULE.md`. Do not load the full legacy rule or the base AUD skill; neither is required for this specialization. Load AUD role memory through `sigma_get_memory` with role AUD, falling back to `sigma memory --aud` or `Sigma/role-memory/aud-memory.json`. These are operational instructions only, not product evidence. Do not search other Sigma documents or initialize a governance lifecycle; report missing operational instructions as a preparation requirement.

Automatically loaded bridge instructions (such as AGENTS.md, CLAUDE.md, and GEMINI.md) are an operational exception. Follow their directives but do not use embedded product history as evidence or follow references into more Sigma documentation. The governing contract takes precedence over legacy artifact-audit provisions; report unresolved authority conflicts rather than activating another mode as a workaround.

Do not explore Sigma as an audit reference or target. Exclude Sigma before recursive searches, scans, profiling, and tool ingestion, not merely from displayed findings. Plans, DEV reports, artifacts, previous audits, internal notes, and other Sigma documentation are prohibited, including through copies, links, search results, or CLI/MCP output. `/report`, `/read-memo`, and other skills grant no additional access.

The audit's own workspace at `Sigma/Audit Product/Performance-Cost/`, together with its scoped temporary test workspace described below, is an exception for creating and rereading this session's own tests, evidence, and reports. Never use other sessions' reports as references, including during retests; retest with fresh observations. A retest request does not permit reading an old report.

### Retest boundary

For retests, the Director may describe a scenario, symptom, or expected outcome in their own words as a new testing instruction. This does not prove any previous finding; obtain fresh evidence. Old reports remain prohibited as files, attachments, pasted text, or excerpts, even when supplied in this session. If an old report has already entered the audit context, stop and request a fresh session. Current Director requirements or clarifications do not create a report-access exception.

## Baseline and preparation

Read the product README.md only as the required baseline for understanding the product's core idea and big picture. README is not an audit target, an acceptance specification, or evidence of performance/cost. Use the product README outside Sigma; do not substitute a skill README or follow its links into prohibited evidence.

If README is unavailable or the product's core idea remains unclear, explain what is unclear and ask whether the Director wants to supply or improve README first. Wait for an answer before substantive audit; do not improve or audit README or invent workloads/performance targets.

Before inspection, state preparation requirements: the product target/root, README, the environment and how to run tests, representative workloads/data where available, and access to relevant metrics or cost data. Do not request inputs already available. Ensure the measurement objective, environment, and testing load/cost limits are known before experiments that load services or use paid services. If unknown, request that information; do not assume source code access provides credentials or an unlimited budget.

## Runtime safety and test workspace

Before executing product code, imports, tests, builds, or scanners, source-based audits must verify the effective environment through key names and sanitized configuration only: dotenv auto-loading, inherited variables, initialization hooks, datastore destinations, and external providers. Apply the contract's secret-bearing-file boundary to every known or suspected sensitive file, not just .env: expose only key names/structure and sanitized configuration, never raw protected contents or secret values. The contract lists non-exhaustive file-pattern indicators; private keys are limited to type/location metadata. Do not widen filesystem scope to find them. Request a sanitized view or use extraction that cannot emit secret values. If environment destinations or effects remain unknown, do not execute; ask for the missing preparation.

Never use credentials found during exploration, including connection strings, tokens, sessions, or cloud keys. Report location and type with redacted descriptions, never secret values in tool output, logs, screenshots, or reports. Only separately provided, explicitly authorized test credentials may be used in their designated scope.

A test involving production datastores, side-effecting third-party services (email/SMS/payment/cloud), or paid workloads requires explicit Director confirmation of that specific target, test, limits, and effects. This is an exception to the general no-reauthorization rule; do not ask again when that exact test is already explicitly approved. Distinguish local, staging, and production. Approval does not authorize use of discovered secrets.

Main source code means the entire original product tree except this skill's audit category, including ignored/generated files (node_modules, dist, __pycache__). Do not modify any of it, directly or through tool side effects. Own test code may run in the selected audit category or a scoped disposable OS temporary directory. Source-based audits may install/build/test a disposable product copy there, excluding Sigma and secret-bearing environment/configuration files and using sanitized test configuration. Never follow links/imports back to the original tree or include forbidden Sigma documents. Test-local dependencies and transient OS/user caches are allowed; global package installation, user configuration changes, and unrelated writes are not.

Before creating artifacts, inspect ignore rules and test/lint/build include globs outside Sigma. Warn if evidence may be committed or discovered by tooling, without editing product settings or .gitignore. Avoid default test-discovery filenames; if broad globs still include audit code, run it in scoped temporary storage and retain inert text/archives in audit space. Gitignore alone does not exclude files from test/build tools. Keep durable evidence and reports in this category; clean up only the audit-owned temporary directory after verifying its resolved containment. Do not turn a disposable copy or test harness into a product repair implementation.

## Performance–Cost Audit method

- Map main workflows and CPU, memory, I/O, database, network, storage, external-service, or token/model usage where relevant. Look for repeated work, N+1 queries, poorly scaling complexity, excessive retries, excessive data transfer, resource leaks, and inefficient caching/batching.
- Distinguish source code hypotheses from runtime measurements. Test hypotheses with explained workloads, recorded hardware, OS, and runtime versions, and warm-up/repetition sufficient for the question. Do not infer production capacity from a single local measurement.
- Use appropriate metrics, such as latency/distributions, throughput, error rate, resource consumption, or cost per completed task. Explain sample sizes, variation, and limitations; do not invent numbers or unsupported precision.
- For cost, distinguish actual billing, measured usage, and estimates. For estimates, state volume, units, prices, dates, and assumptions. Verify prices against current official sources when used; do not assume service prices or configuration have remained unchanged.
- Relate efficiency recommendations to trade-offs in correctness, quality, latency, and reliability. Do not implement optimizations, switch models/services, change infrastructure, or purchase resources as part of the audit. When cost data is unavailable, report partial analysis without calling it actual cost.

## Test code and output

Store this session's own tests, fixtures, screenshots/profiler output where relevant, and durable evidence in `Sigma/Audit Product/Performance-Cost/`, with temporary execution permitted as specified above. Redirect tools away from the entire original product tree. If isolation cannot be guaranteed, choose another method or report the unperformed check. Do not implement repairs, replacement interfaces, or optimizations under the name of test code.

Resolve output paths and keep durable writes inside this audit category; temporary writes must remain within the explicitly allowed temporary/cache scope. Do not follow symlinks/junctions back to source code or other Sigma content. Quote paths containing spaces in shell and runner commands.

Create a new Markdown report at `Sigma/Audit Product/Performance-Cost/{timedate}-AUDIT-{title}.md`. Read the current time from an available clock/system date tool; never estimate it from model context. Use `YYYYMMDD-HHmmss` in the known Director-local timezone; if unknown, use UTC and state it. `{title}` is an ASCII kebab-case slug. Never overwrite an old report; refresh the timestamp or disambiguate the slug on collision. Content is free-form without a mandatory template or section sequence. Ground findings in evidence, impact, reproduction/measurement conditions, recommendations, and material limitations as appropriate; redact secrets and PII. Record the audited commit/build/version/URL and environment when available, even as one free-form provenance line. Do not invent missing identifiers or make UI–UX inspect files to obtain them.

The report is advisory to the Director and reference material for FMN to formulate a new PLAN, followed by DEV's EXEC implementation. AUD does not create PLAN/EXEC, repair the product, or message other roles without applicable communication instructions. Return the report location and a summary to the Director.

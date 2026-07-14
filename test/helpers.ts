import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const CLI = path.resolve(__dirname, '..', 'dist', 'cli.js');
const SCHEMA_VERSION = '1.0.0';

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runCli(args: string, cwd: string, homeDir: string, input?: string): CliResult {
  try {
    const stdout = execSync(`node "${CLI}" ${args}`, {
      cwd,
      env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir },
      encoding: 'utf-8',
      input: input ?? '',
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

export interface TestEnv {
  projectDir: string;
  homeDir: string;
  sigmaDir: string;
  progressPath: string;
  cleanup: () => void;
}

export function setupTestEnv(): TestEnv {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-test-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-home-'));

  // Minimal ~/.sigma global installation
  const sigmaGlobal = path.join(homeDir, '.sigma');
  fs.mkdirSync(sigmaGlobal);
  fs.writeJsonSync(path.join(sigmaGlobal, 'sigma.config.json'), {
    schema_version: SCHEMA_VERSION,
    cli_version: '0.9.0',
    installed_at: new Date().toISOString(),
  });
  fs.writeJsonSync(path.join(sigmaGlobal, 'projects.json'), {
    schema_version: SCHEMA_VERSION,
    projects: [],
  });

  // Project Sigma/ structure
  const sigmaDir = path.join(projectDir, 'Sigma');
  for (const sub of ['design', 'build', 'close', 'rules', 'logs', 'memory']) {
    fs.mkdirSync(path.join(sigmaDir, sub), { recursive: true });
  }

  const progressPath = path.join(sigmaDir, 'progress.json');

  return {
    projectDir,
    homeDir,
    sigmaDir,
    progressPath,
    cleanup: () => {
      fs.removeSync(projectDir);
      fs.removeSync(homeDir);
    },
  };
}

export function makeProgress(overrides: Partial<ReturnType<typeof baseProgress>> = {}): object {
  return { ...baseProgress(), ...overrides };
}

function baseProgress() {
  const now = new Date().toISOString();
  return {
    schema_version: SCHEMA_VERSION,
    project_id: 'TEST',
    project_name: 'Test Project',
    lifecycle_state: 'DESIGN',
    created_at: now,
    updated_at: now,
    intent: { active_version: null, active_state: null, versions: [] },
    plan: { active_version: null, active_state: null, versions: [] },
    exec: { active_version: null, active_state: null, versions: [] },
    close: { active_version: null, active_state: null, versions: [] },
    roadmap: { active_version: null, active_state: null, versions: [] },
    gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    cso: [],
  };
}

export function makeProgressWithDraftIntent() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'DESIGN',
    intent: {
      active_version: 'v1',
      active_state: 'DRAFT',
      versions: [{ version: 'v1', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now }],
    },
    gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
  });
}

export function makeProgressWithLockedIntent() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'BUILD',
    intent: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now }],
    },
    gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
  });
}

export function makeProgressWithLockedPlan() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'BUILD',
    intent: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now }],
    },
    plan: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

export function makeProgressWithLockedExec() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'BUILD',
    intent: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now }],
    },
    plan: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    exec: {
      active_version: 'v0.1',
      active_state: 'LOCKED',
      versions: [{ version: 'v0.1', state: 'LOCKED', file: 'Sigma/build/DEV-EXEC-v0.1.md', created_at: now, updated_at: now, locked_at: now, plan_version_ref: 'v1' }],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: true },
  });
}

export function validIntentDoc(version: string): string {
  return `<!-- SIGMA:DOC type=DIR_INTENT schema=3 -->
# DIR-INTENT ${version}

<!-- SIGMA:DIR_INTENT:SECTION:INTENT_CORE -->
## 1. Intent Core

Test intent core.

<!-- SIGMA:DIR_INTENT:SECTION:COMPREHENSIVE_RESEARCH -->
## 2. Comprehensive Research

Test research.

<!-- SIGMA:DIR_INTENT:SECTION:SUCCESS_DEFINITION -->
## 3. Success Definition

Test success definition.

<!-- SIGMA:DIR_INTENT:SECTION:QUALITY_BAR -->
## 4. Quality Bar

| Dimension | Minimum Standard For This Intent | Must Not Happen | Evidence Required |
|:--------- |:-------------------------------- |:--------------- |:----------------- |
| Security | N/A | N/A | N/A |
| UX Trust | N/A | N/A | N/A |
| UI / Product Packaging | N/A | N/A | N/A |
| Performance / Cost | N/A | N/A | N/A |

<!-- SIGMA:DIR_INTENT:SECTION:STRATEGIC_TRADE_OFFS -->
## 5. Strategic Trade-Offs

Test trade-offs.

<!-- SIGMA:DIR_INTENT:SECTION:SCOPE_BOUNDARY -->
## 6. Scope Boundary

Test scope boundary.

<!-- SIGMA:DIR_INTENT:SECTION:CONSTRAINTS_AND_PREFERENCES -->
## 7. Constraints & Preferences

Test constraints.

<!-- SIGMA:DIR_INTENT:SECTION:TECHNICAL_AND_ARCHITECTURE_DIRECTION -->
## 8. Technical & Architecture Direction

Test technical direction.

<!-- SIGMA:DIR_INTENT:SECTION:FUNCTIONAL_REQUIREMENTS -->
## 9. Functional Requirements

Test functional requirements.

<!-- SIGMA:DIR_INTENT:SECTION:RISK_AND_FAILURE_DEFINITION -->
## 10. Risk & Failure Definition

Test risk definition.

<!-- SIGMA:DIR_INTENT:SECTION:EXECUTION_DIRECTION_FOR_FMN -->
## 11. Execution Direction for FMN

Test execution direction.

<!-- SIGMA:DIR_INTENT:SECTION:AUD_FINDINGS_ADVISORY_ONLY -->
## 12. AUD Findings — Advisory Only

Test AUD findings.

- [x] PASS

<!-- SIGMA:DIR_INTENT:SECTION:FINAL_VALIDATION_CHECKLIST -->
## 13. Final Validation Checklist

Test checklist.

### 13.1 Lock Requirement

- [x] Intent Core is clear enough to guide execution.
- [x] Scope in/out is explicit.
- [x] Success criteria are observable or measurable.
- [x] Security minimum standard is stated or explicitly marked not applicable.
- [x] UX Trust minimum standard is stated or explicitly marked not applicable.
- [x] UI / Product Packaging minimum standard is stated or explicitly marked not applicable.
- [x] Performance / Cost minimum standard is stated or explicitly marked not applicable.
- [x] FMN is instructed to preserve the Quality Bar in every PLAN.
- [x] Constraints and preferences are separated.
- [x] Technical choices are marked as auditable means, not sovereign intent.
- [x] At least one execution direction exists for FMN (Execution Direction for FMN).
- [x] Risk appetite is stated.
- [x] Primary failure concern is stated.
- [x] Evidence requirement is stated.
- [x] Director verdict is recorded.

### 13.2 Conditional Requirement

- [ ] Comprehensive Research subsections filled or N/A.
- [ ] AUD Verificator Mode reviewed source-tier compliance, or Director accepted the risk.
`;
}

export function validPlanDoc(version: string): string {
  return `<!-- SIGMA:DOC type=FMN_PLAN schema=1 -->
# FMN-PLAN ${version}

<!-- SIGMA:FMN_PLAN:SECTION:SOURCE_ALIGNMENT -->
## 1. Source Alignment

Test source alignment.

<!-- SIGMA:FMN_PLAN:SECTION:WORK_ORDER_TASK_PLAN -->
## 2. Work Order / Task Plan

Test work order.

<!-- SIGMA:FMN_PLAN:SECTION:ACCEPTANCE_CRITERIA -->
## 3. Acceptance Criteria

Test acceptance criteria.

<!-- SIGMA:FMN_PLAN:SECTION:IMPLEMENTATION_CONSTRAINTS -->
## 4. Implementation Constraints

Test constraints.

<!-- SIGMA:FMN_PLAN:SECTION:PRE_BUILD_TEST_CONTRACT -->
## 5. Pre-Build Test Contract

Test contract.

<!-- SIGMA:FMN_PLAN:SECTION:DEV_HANDOFF_INSTRUCTIONS -->
## 6. DEV Handoff Instructions

Test handoff.

<!-- SIGMA:FMN_PLAN:SECTION:AUD_FINDINGS -->
## 7. AUD Findings

Test AUD findings.

- [x] PASS
`;
}

export function makeProgressWithDraftIntentAfterLockedChain() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'BUILD',
    intent: {
      active_version: 'v2',
      active_state: 'DRAFT',
      versions: [
        { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
        { version: 'v2', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v2.md', created_at: now, updated_at: now },
      ],
    },
    plan: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    exec: {
      active_version: 'v0.1',
      active_state: 'LOCKED',
      versions: [{ version: 'v0.1', state: 'LOCKED', file: 'Sigma/build/DEV-EXEC-v0.1.md', created_at: now, updated_at: now, locked_at: now, plan_version_ref: 'v1' }],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: true },
  });
}

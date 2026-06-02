import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { migrateRoadmapCoreProcessFlowContent, renderRoadmapFile } from '../src/utils/roadmap';
import { validateSigmaDocFile } from '../src/utils/docCheck';

describe('ROADMAP core process migration helpers', () => {
  const tempPaths: string[] = [];

  afterEach(() => {
    while (tempPaths.length > 0) {
      const target = tempPaths.pop();
      if (target) fs.removeSync(target);
    }
  });

  it('migrates legacy Phase Dependencies block into Core Process Flow', () => {
    const legacy = [
      '<!-- SIGMA:DOC type=ROADMAP schema=1 -->',
      '# ROADMAP',
      '',
      '<!-- SIGMA:RENDER:START:stage-overview -->',
      '## 3. Stage Overview',
      '<!-- SIGMA:RENDER:END:stage-overview -->',
      '',
      '<!-- SIGMA:RENDER:START:phase-dependencies -->',
      '<!-- SIGMA:ROADMAP:SECTION:PHASE_DEPENDENCIES -->',
      '## 4. Phase Dependencies',
      '',
      '```mermaid',
      'flowchart TD',
      '  A[Login] --> B[Dashboard]',
      '```',
      '<!-- SIGMA:RENDER:END:phase-dependencies -->',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:STAGE_DETAILS -->',
      '## 5. Stage Details',
    ].join('\n');

    const result = migrateRoadmapCoreProcessFlowContent(legacy);

    expect(result.changed).toBe(true);
    expect(result.content).toMatch(/SIGMA:ROADMAP:SECTION:CORE_PROCESS_FLOW/);
    expect(result.content).toMatch(/SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW/);
    expect(result.content).toMatch(/SIGMA:ROADMAP:SECTION:PLAN_BREAKDOWN/);
    expect(result.content).toMatch(/## 4\. Core Process Flow/);
    expect(result.content).toMatch(/A\[Login\] --> B\[Dashboard\]/);
    expect(result.content).not.toMatch(/SIGMA:RENDER:START:phase-dependencies/);
  });

  it('validator accepts migrated roadmap core process marker', () => {
    const migrated = [
      '<!-- SIGMA:DOC type=ROADMAP schema=1 -->',
      '# ROADMAP',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:ROADMAP_PURPOSE -->',
      '## 1. Roadmap Purpose',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:SOURCE_INTENT_ALIGNMENT -->',
      '## 2. Source Intent Alignment',
      '',
      '<!-- SIGMA:RENDER:START:stage-overview -->',
      '## 3. Stage Overview',
      '',
      '| Stage | Title | Focus | Status | Reason |',
      '| :--- | :--- | :--- | :--- | :--- |',
      '<!-- SIGMA:RENDER:END:stage-overview -->',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:CORE_PROCESS_FLOW -->',
      '## 4. Core Process Flow',
      '',
      '1. User signs in',
      '2. System loads main workspace',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:STAGE_DETAILS -->',
      '## 5. Stage Details',
      '',
      '<!-- SIGMA:RENDER:START:plan-breakdown -->',
      '## 6. PLAN Breakdown',
      '',
      '| PLAN | Covers Stage | Status | Reason |',
      '| :--- | :--- | :--- | :--- |',
      '<!-- SIGMA:RENDER:END:plan-breakdown -->',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:FMN_ROADMAP_NOTES -->',
      '## 7. FMN Roadmap Notes',
    ].join('\n');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-roadmap-'));
    tempPaths.push(tempDir);
    const filePath = path.join(tempDir, 'ROADMAP-v1.md');
    fs.writeFileSync(filePath, migrated);

    const report = validateSigmaDocFile(filePath, 'roadmap');

    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it('render keeps derived section markers for stage overview and plan breakdown', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-roadmap-render-'));
    tempPaths.push(tempDir);
    const filePath = path.join(tempDir, 'ROADMAP-v1.md');

    const roadmap = [
      '<!-- SIGMA:DOC type=ROADMAP schema=1 -->',
      '# ROADMAP',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:ROADMAP_PURPOSE -->',
      '## 1. Roadmap Purpose',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:SOURCE_INTENT_ALIGNMENT -->',
      '## 2. Source Intent Alignment',
      '',
      '<!-- SIGMA:RENDER:START:stage-overview -->',
      '<!-- SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW -->',
      '## 3. Stage Overview',
      '',
      '| Stage | Title | Focus | Status | Reason |',
      '| :--- | :--- | :--- | :--- | :--- |',
      '<!-- SIGMA:RENDER:END:stage-overview -->',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:CORE_PROCESS_FLOW -->',
      '## 4. Core Process Flow',
      '',
      '1. User signs in',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:STAGE_DETAILS -->',
      '## 5. Stage Details',
      '',
      '## Stage 1.1 — Example Stage',
      '<!-- SIGMA:STAGE:FOCUS:Example Focus -->',
      '',
      '<!-- SIGMA:RENDER:START:plan-breakdown -->',
      '<!-- SIGMA:ROADMAP:SECTION:PLAN_BREAKDOWN -->',
      '## 6. PLAN Breakdown',
      '',
      '| PLAN | Covers Stage | Title | Focus | Status | Reason |',
      '| :--- | :--- | :--- | :--- | :--- | :--- |',
      '<!-- SIGMA:RENDER:END:plan-breakdown -->',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:FMN_ROADMAP_NOTES -->',
      '## 7. FMN Roadmap Notes',
    ].join('\n');

    fs.writeFileSync(filePath, roadmap);

    renderRoadmapFile(filePath, {
      schema_version: '1.0.0',
      project_id: 'TEST',
      project_name: 'Test',
      lifecycle_state: 'BUILD',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      intent: { active_version: 'v1', active_state: 'LOCKED', versions: [] },
      plan: {
        active_version: 'v1.1',
        active_state: 'DRAFT',
        versions: [{
          version: 'v1.1',
          state: 'DRAFT',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          title: 'Example Stage',
          focus: 'Example Focus',
        }],
        pending: [],
      },
      exec: { active_version: null, active_state: null, versions: [] },
      close: { active_version: null, active_state: null, versions: [] },
      roadmap: { active_version: 'v1', active_state: 'ACTIVE', versions: [] },
      gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
    });

    const rendered = fs.readFileSync(filePath, 'utf8');
    expect(rendered).toMatch(/SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW/);
    expect(rendered).toMatch(/SIGMA:ROADMAP:SECTION:PLAN_BREAKDOWN/);
  });
});

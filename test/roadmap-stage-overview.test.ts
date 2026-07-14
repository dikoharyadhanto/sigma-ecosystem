import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { renderRoadmapFile } from '../src/utils/roadmap';
import { validateSigmaDocFile } from '../src/utils/docCheck';
import { ProgressJson } from '../src/engine/progress';

function baseProgress(): ProgressJson {
  return {
    schema_version: '1.0.0',
    project_id: 'TEST',
    project_name: 'Test',
    lifecycle_state: 'BUILD',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    intent: { active_version: 'v1', active_state: 'LOCKED', versions: [] },
    plan: { active_version: null, active_state: null, versions: [], pending: [] },
    exec: { active_version: null, active_state: null, versions: [] },
    close: { active_version: null, active_state: null, versions: [] },
    roadmap: {
      active_version: 'v1',
      active_state: 'ACTIVE',
      versions: [{
        version: 'v1',
        state: 'ACTIVE',
        file: 'Sigma/build/ROADMAP-v1.md',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }],
    },
    gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
  };
}

const ROADMAP_TEMPLATE = [
  '<!-- SIGMA:DOC type=ROADMAP schema=1 -->',
  '# ROADMAP',
  '',
  '<!-- SIGMA:ROADMAP:SECTION:OVERVIEW -->',
  '## 1. Overview',
  '',
  '<!-- SIGMA:ROADMAP:SECTION:CORE_PROCESS_FLOW -->',
  '## 2. Core Process Flow',
  '',
  '<!-- SIGMA:RENDER:START:stage-overview -->',
  '<!-- SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW -->',
  '## 3. Stage Overview',
  '',
  '| Stage | Title | Focus | Status | Reason |',
  '| :--- | :--- | :--- | :--- | :--- |',
  '<!-- SIGMA:RENDER:END:stage-overview -->',
].join('\n');

describe('ROADMAP Stage Overview (3-section format)', () => {
  const tempPaths: string[] = [];

  afterEach(() => {
    while (tempPaths.length > 0) {
      const target = tempPaths.pop();
      if (target) fs.removeSync(target);
    }
  });

  function writeTempRoadmap(content: string): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-roadmap-'));
    tempPaths.push(tempDir);
    const filePath = path.join(tempDir, 'ROADMAP-v1.md');
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  it('validator accepts the 3-section roadmap format (Overview, Core Process Flow, Stage Overview)', () => {
    const filePath = writeTempRoadmap(ROADMAP_TEMPLATE);

    const report = validateSigmaDocFile(filePath, 'roadmap');

    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it('validator rejects the old 6-section format (no OVERVIEW marker, has legacy STAGE_DETAILS)', () => {
    const legacy = [
      '<!-- SIGMA:DOC type=ROADMAP schema=1 -->',
      '# ROADMAP',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:ROADMAP_PURPOSE -->',
      '## 1. Roadmap Purpose',
      '',
      '<!-- SIGMA:RENDER:START:stage-overview -->',
      '<!-- SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW -->',
      '## 3. Stage Overview',
      '<!-- SIGMA:RENDER:END:stage-overview -->',
      '',
      '<!-- SIGMA:ROADMAP:SECTION:STAGE_DETAILS -->',
      '## 5. Stage Details',
    ].join('\n');
    const filePath = writeTempRoadmap(legacy);

    const report = validateSigmaDocFile(filePath, 'roadmap');

    expect(report.ok).toBe(false);
    expect(report.errors).toContain('Missing required section marker: OVERVIEW');
    expect(report.errors).toContain('Missing required section marker: CORE_PROCESS_FLOW');
  });

  it('render populates Stage Overview rows directly from progress.json plan entries', () => {
    const filePath = writeTempRoadmap(ROADMAP_TEMPLATE);

    const data = baseProgress();
    data.plan.versions = [
      {
        version: 'v1.1',
        state: 'DRAFT',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        intent_version_ref: 'v1',
        title: 'Example Stage',
        focus: 'Example Focus',
      },
      {
        version: 'v1.2',
        state: 'SUPERSEDED',
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
        intent_version_ref: 'v1',
        title: 'Superseded Stage',
        focus: 'Superseded Focus',
        supersede_reason: 'Scope changed',
      },
    ];

    renderRoadmapFile(filePath, data);

    const rendered = fs.readFileSync(filePath, 'utf8');
    expect(rendered).toMatch(/\| 1\.1 \| Example Stage \| Example Focus \| DRAFT \| — \|/);
    expect(rendered).toMatch(/\| 1\.2 \| Superseded Stage \| Superseded Focus \| SUPERSEDED \| Scope changed \|/);
  });

  it('render excludes plan entries belonging to a different INTENT major', () => {
    const filePath = writeTempRoadmap(ROADMAP_TEMPLATE);

    const data = baseProgress();
    data.plan.versions = [
      {
        version: 'v1.1',
        state: 'DRAFT',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        intent_version_ref: 'v1',
        title: 'Belongs to v1',
        focus: 'In scope',
      },
      {
        version: 'v2.1',
        state: 'DRAFT',
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
        intent_version_ref: 'v2',
        title: 'Belongs to v2',
        focus: 'Out of scope',
      },
    ];

    renderRoadmapFile(filePath, data);

    const rendered = fs.readFileSync(filePath, 'utf8');
    expect(rendered).toMatch(/Belongs to v1/);
    expect(rendered).not.toMatch(/Belongs to v2/);
  });

  it('render keeps the Stage Overview marker and removes a legacy plan-breakdown block', () => {
    const withLegacyBlock = [
      ROADMAP_TEMPLATE,
      '',
      '<!-- SIGMA:RENDER:START:plan-breakdown -->',
      '<!-- SIGMA:ROADMAP:SECTION:PLAN_BREAKDOWN -->',
      '## PLAN Breakdown',
      '',
      '| PLAN | Covers Stage | Title | Focus | Status | Reason |',
      '| :--- | :--- | :--- | :--- | :--- | :--- |',
      '<!-- SIGMA:RENDER:END:plan-breakdown -->',
    ].join('\n');
    const filePath = writeTempRoadmap(withLegacyBlock);

    renderRoadmapFile(filePath, baseProgress());

    const rendered = fs.readFileSync(filePath, 'utf8');
    expect(rendered).toMatch(/SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW/);
    expect(rendered).not.toMatch(/SIGMA:ROADMAP:SECTION:PLAN_BREAKDOWN/);
    expect(rendered).not.toMatch(/SIGMA:RENDER:START:plan-breakdown/);
  });
});

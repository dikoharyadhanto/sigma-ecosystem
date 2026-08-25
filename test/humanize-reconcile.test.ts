import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { collectHumanPushTargets, reconcileSupersededHumanArtifacts, computeHumanNotionTitle } from '../src/engine/humanizePush';
import { scanForSigmaTerminology } from '../src/engine/terminologyScanner';
import { readProjectConfig, writeProjectConfig } from '../src/engine/projectConfig';
import { writeGlobalNotionToken, getProjectId } from '../src/engine/notionCredentials';
import { makeChain } from './helpers';
import { SCHEMA_VERSION } from '../src/config';

function jsonResponse(body: any, ok = true, status = 200) {
  return { ok, status, statusText: ok ? 'OK' : 'Error', json: async () => body } as any;
}

// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.5, Fase 4 — Notion must never keep
// showing a human artifact whose source is SUPERSEDED locally.

describe('collectHumanPushTargets() excludes SUPERSEDED sources', () => {
  it('does not push a SUPERSEDED intent even though chain.intent.human is set', () => {
    const now = new Date().toISOString();
    const chain = makeChain('v1', {
      intent: { version: 'v1', state: 'SUPERSEDED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, human: { version: 'v1', generated_at: now } },
    }) as any;

    expect(collectHumanPushTargets(chain)).toEqual([]);
  });

  it('does not push a SUPERSEDED exec entry even though it has a human record', () => {
    const now = new Date().toISOString();
    const chain = makeChain('v1', {
      intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now },
      exec: {
        active_version: 'v1.1', active_state: 'SUPERSEDED',
        versions: [{ version: 'v1.1', state: 'SUPERSEDED', file: 'Sigma/evidence/DEV-EXEC-v1.1.md', created_at: now, updated_at: now, plan_version_ref: 'v1.1', human: { version: 'v1.1', generated_at: now } }],
      },
    }) as any;

    expect(collectHumanPushTargets(chain)).toEqual([]);
  });

  it('still pushes a non-SUPERSEDED intent with a human record', () => {
    const now = new Date().toISOString();
    const chain = makeChain('v1', {
      intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, human: { version: 'v1', generated_at: now } },
    }) as any;

    expect(collectHumanPushTargets(chain)).toHaveLength(1);
  });
});

describe('computeHumanNotionTitle() — never leaks Sigma terminology into a published page title', () => {
  // The bug this guards: syncArtifactToNotion() previously always built the
  // page title as "{artifactType} - {version}" — for a human artifact that
  // meant a literal "DIR-INTENT-HUMAN - v1" title, visible on the page
  // itself, even though the terminology scanner only ever checks body
  // content. A title is never scanned; it must be clean by construction.
  const defaultTerms = require('../Sigma/rules/sigma_terminology.default.json').terms as string[];

  it('produces a title with no Sigma terminology for each artifact kind', () => {
    for (const kind of ['intent', 'exec', 'close'] as const) {
      const title = computeHumanNotionTitle(kind, 'v1', 'Acme Project');
      expect(scanForSigmaTerminology(title, defaultTerms)).toEqual([]);
    }
  });

  it('includes the project name and version for lookup uniqueness', () => {
    expect(computeHumanNotionTitle('intent', 'v2', 'Acme Project')).toBe('Acme Project — Project Brief (v2)');
    expect(computeHumanNotionTitle('exec', 'v1.1', 'Acme Project')).toBe('Acme Project — Delivery Summary (v1.1)');
    expect(computeHumanNotionTitle('close', 'v1', 'Acme Project')).toBe('Acme Project — Closing Summary (v1)');
  });
});

describe('reconcileSupersededHumanArtifacts()', () => {
  let projectDir: string;
  let homeDir: string;
  let restoreHome: string | undefined;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-reconcile-project-'));
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-reconcile-home-'));
    restoreHome = process.env.HOME;
    process.env.HOME = homeDir;

    fs.ensureDirSync(path.join(projectDir, 'Sigma'));
    fs.writeJsonSync(path.join(projectDir, '.sigma-identity.json'), {
      schema_version: SCHEMA_VERSION, project_id: 'TEST-RECONCILE', project_name: 'Test', registered: true, logs_created_at: new Date().toISOString(),
    });
    const cfg = readProjectConfig(projectDir);
    cfg.notion = { enabled: true, parent_page_id: 'parent-page-123', clean_local: false };
    writeProjectConfig(projectDir, cfg);
    writeGlobalNotionToken(getProjectId(projectDir)!, 'secret_test_token');
  });

  afterEach(() => {
    fs.removeSync(projectDir);
    fs.removeSync(homeDir);
    if (restoreHome !== undefined) process.env.HOME = restoreHome;
    vi.unstubAllGlobals();
  });

  it('archives the Notion page for a SUPERSEDED, previously-pushed intent', async () => {
    const now = new Date().toISOString();
    fs.writeJsonSync(path.join(projectDir, 'Sigma', 'progress-v1.json'), makeChain('v1', {
      intent: { version: 'v1', state: 'SUPERSEDED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, human: { version: 'v1', generated_at: now, pushed_to_notion_at: now } },
    }));
    fs.writeJsonSync(path.join(projectDir, 'Sigma', 'activate_status.json'), { active_chain: 'v1' });

    let archivedId: string | undefined;
    vi.stubGlobal('fetch', vi.fn(async (url: string, opts: any) => {
      if (url.includes('/blocks/parent-page-123/children')) {
        // Human-friendly title (§2.6) — never the raw "DIR-INTENT-HUMAN - v1"
        // form, which would leak Sigma vocabulary into a published page title.
        return jsonResponse({ results: [{ type: 'child_page', id: 'page-xyz', child_page: { title: 'Test — Project Brief (v1)' } }] });
      }
      if (url.includes('/pages/page-xyz') && opts.method === 'PATCH') {
        archivedId = 'page-xyz';
        const body = JSON.parse(opts.body);
        expect(body.archived).toBe(true);
        return jsonResponse({ id: 'page-xyz', archived: true });
      }
      return jsonResponse({}, false, 404);
    }));

    const results = await reconcileSupersededHumanArtifacts(projectDir);

    expect(results).toEqual([{ artifactType: 'DIR-INTENT-HUMAN', version: 'v1', deleted: true, error: undefined }]);
    expect(archivedId).toBe('page-xyz');
  });

  it('returns nothing to reconcile when no source is SUPERSEDED', async () => {
    const now = new Date().toISOString();
    fs.writeJsonSync(path.join(projectDir, 'Sigma', 'progress-v1.json'), makeChain('v1', {
      intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, human: { version: 'v1', generated_at: now, pushed_to_notion_at: now } },
    }));
    fs.writeJsonSync(path.join(projectDir, 'Sigma', 'activate_status.json'), { active_chain: 'v1' });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ results: [] })));

    expect(await reconcileSupersededHumanArtifacts(projectDir)).toEqual([]);
  });

  it('treats "page not found" as a no-op, not an error', async () => {
    const now = new Date().toISOString();
    fs.writeJsonSync(path.join(projectDir, 'Sigma', 'progress-v1.json'), makeChain('v1', {
      intent: { version: 'v1', state: 'SUPERSEDED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, human: { version: 'v1', generated_at: now, pushed_to_notion_at: now } },
    }));
    fs.writeJsonSync(path.join(projectDir, 'Sigma', 'activate_status.json'), { active_chain: 'v1' });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ results: [] }))); // page never existed / already gone

    const results = await reconcileSupersededHumanArtifacts(projectDir);
    expect(results).toEqual([{ artifactType: 'DIR-INTENT-HUMAN', version: 'v1', deleted: false, error: undefined }]);
  });

  it('does not attempt to reconcile a SUPERSEDED source that was never pushed (no human record)', async () => {
    const now = new Date().toISOString();
    fs.writeJsonSync(path.join(projectDir, 'Sigma', 'progress-v1.json'), makeChain('v1', {
      intent: { version: 'v1', state: 'SUPERSEDED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now }, // no .human
    }));
    fs.writeJsonSync(path.join(projectDir, 'Sigma', 'activate_status.json'), { active_chain: 'v1' });
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const results = await reconcileSupersededHumanArtifacts(projectDir);
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

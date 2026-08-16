import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import {
  markdownToNotionBlocks,
  getResolvedNotionConfig,
  ensureGitignoreNotion,
  syncArtifactToNotion,
  fetchArtifactFromNotion,
  purgeSigmaDir,
  findProjectRootForRemote,
  runNotionPush,
} from '../src/engine/notionService';
import { writeGlobalNotionToken, getProjectId } from '../src/engine/notionCredentials';
import { readProjectConfig, writeProjectConfig } from '../src/engine/projectConfig';
import { findProjectRoot } from '../src/utils/fs';
import { makeChain } from './helpers';

const SCHEMA_VERSION = '1.1.0';

describe('Notion Integration Engine (v2)', () => {
  let projectDir: string;
  let homeDir: string;
  let restoreHome: string | undefined;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-notion-v2-project-'));
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-notion-v2-home-'));
    restoreHome = process.env.HOME;
    process.env.HOME = homeDir;

    // Minimal Sigma project skeleton + identity, mirroring `sigma project start`.
    fs.ensureDirSync(path.join(projectDir, 'Sigma'));
    fs.writeJsonSync(path.join(projectDir, 'Sigma', 'activate_status.json'), { active_chain: null });
    fs.writeJsonSync(path.join(projectDir, '.sigma-identity.json'), {
      schema_version: SCHEMA_VERSION,
      project_id: 'TEST-NOTION',
      project_name: 'Test Notion Project',
      registered: true,
      logs_created_at: new Date().toISOString(),
    });

    const cfg = readProjectConfig(projectDir);
    cfg.notion = { enabled: true, parent_page_id: 'parent-page-123', clean_local: true };
    writeProjectConfig(projectDir, cfg);

    const projectId = getProjectId(projectDir)!;
    writeGlobalNotionToken(projectId, 'secret_test_token');

    // Minimal valid chain so runNotionPush() (resolveActiveChainVersion +
    // readChain) has something to read.
    fs.writeJsonSync(path.join(projectDir, 'Sigma', 'progress-v1.json'), makeChain('v1'));
    fs.writeJsonSync(path.join(projectDir, 'Sigma', 'activate_status.json'), { active_chain: 'v1' });
  });

  afterEach(() => {
    fs.removeSync(projectDir);
    fs.removeSync(homeDir);
    if (restoreHome !== undefined) process.env.HOME = restoreHome;
    vi.unstubAllGlobals();
  });

  describe('markdownToNotionBlocks', () => {
    it('parses headings, bullets, code blocks, and callouts', () => {
      const markdown = `# Title 1
## Title 2
- Bullet 1

> [!NOTE]
> A note

\`\`\`typescript
const x = 42;
\`\`\`
`;
      const blocks = markdownToNotionBlocks(markdown);
      expect(blocks[0].type).toBe('heading_1');
      expect(blocks[1].type).toBe('heading_2');
      expect(blocks[2].type).toBe('bulleted_list_item');
      expect(blocks[3].type).toBe('callout');
      expect(blocks[4].type).toBe('code');
      expect(blocks[4].code.language).toBe('typescript');
    });
  });

  describe('D-01 — credential isolation', () => {
    it('never writes the token anywhere under the project root', () => {
      const projectFiles = fs.readdirSync(projectDir, { recursive: true, encoding: 'utf-8' }) as unknown as string[];
      for (const rel of projectFiles) {
        const full = path.join(projectDir, rel);
        if (fs.statSync(full).isFile()) {
          const content = fs.readFileSync(full, 'utf8');
          expect(content).not.toContain('secret_test_token');
        }
      }
    });

    it('resolves the token from the global credentials store, not project config', () => {
      const resolved = getResolvedNotionConfig(projectDir);
      expect(resolved.token).toBe('secret_test_token');
      expect(resolved.enabled).toBe(true);
    });

    it('env var override takes priority over the global store', () => {
      process.env.NOTION_TOKEN = 'secret_env_override';
      const resolved = getResolvedNotionConfig(projectDir);
      expect(resolved.token).toBe('secret_env_override');
      delete process.env.NOTION_TOKEN;
    });
  });

  describe('ensureGitignoreNotion', () => {
    it('adds Sigma/ once and is idempotent', () => {
      const res1 = ensureGitignoreNotion(projectDir);
      expect(res1.added).toBe(true);
      const res2 = ensureGitignoreNotion(projectDir);
      expect(res2.added).toBe(false);
    });
  });

  describe('D-04 — append before delete', () => {
    it('does not delete old blocks when the append fails', async () => {
      const deleteUrls: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, opts: any) => {
          if (url.includes('/blocks/parent-page-123/children')) {
            // Existing page found under the parent.
            return jsonResponse({ results: [{ type: 'child_page', id: 'page-1', child_page: { title: 'Doc - v1' } }] });
          }
          if (url.includes('/blocks/page-1/children') && opts.method === 'GET') {
            return jsonResponse({ results: [{ id: 'old-block-1' }, { id: 'old-block-2' }] });
          }
          if (url.includes('/blocks/page-1/children') && opts.method === 'PATCH') {
            return { ok: false, status: 500, statusText: 'Internal Error', json: async () => ({ message: 'boom' }) };
          }
          if (opts.method === 'DELETE') {
            deleteUrls.push(url);
            return { ok: true, json: async () => ({}) };
          }
          return jsonResponse({});
        })
      );

      const res = await syncArtifactToNotion(projectDir, 'Doc', 'v1', '# Hello\n\nSome content');
      expect(res.success).toBe(false);
      expect(deleteUrls.length).toBe(0);
    });

    it('deletes old blocks only after a successful append', async () => {
      const deleteUrls: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, opts: any) => {
          if (url.includes('/blocks/parent-page-123/children')) {
            return jsonResponse({ results: [{ type: 'child_page', id: 'page-1', child_page: { title: 'Doc - v1' } }] });
          }
          if (url.includes('/blocks/page-1/children') && opts.method === 'GET') {
            return jsonResponse({ results: [{ id: 'old-block-1' }] });
          }
          if (url.includes('/blocks/page-1/children') && opts.method === 'PATCH') {
            return jsonResponse({});
          }
          if (opts.method === 'DELETE') {
            deleteUrls.push(url);
            return { ok: true, json: async () => ({}) };
          }
          return jsonResponse({});
        })
      );

      const res = await syncArtifactToNotion(projectDir, 'Doc', 'v1', '# Hello');
      expect(res.success).toBe(true);
      expect(deleteUrls).toEqual([expect.stringContaining('old-block-1')]);
    });
  });

  describe('D-05 — pagination', () => {
    it('push: sends more than one PATCH request for >100 blocks', async () => {
      const patchCalls: any[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, opts: any) => {
          if (url.includes('/blocks/parent-page-123/children')) {
            return jsonResponse({ results: [] }); // no existing page → create path
          }
          if (url.endsWith('/pages') && opts.method === 'POST') {
            return jsonResponse({ id: 'new-page-1', url: 'https://notion.so/newpage1' });
          }
          if (url.includes('/blocks/new-page-1/children') && opts.method === 'PATCH') {
            patchCalls.push(JSON.parse(opts.body));
            return jsonResponse({});
          }
          return jsonResponse({});
        })
      );

      const bigMarkdown = Array.from({ length: 150 }, (_, i) => `- item ${i}`).join('\n');
      const res = await syncArtifactToNotion(projectDir, 'Big Doc', 'v1', bigMarkdown);

      expect(res.success).toBe(true);
      // 150 blocks: first 100 inline in page creation, remaining 50 via one PATCH.
      expect(patchCalls.length).toBe(1);
      expect(patchCalls[0].children.length).toBe(50);
    });

    it('fetch: aggregates results across has_more pages', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, opts: any) => {
          if (url.includes('/blocks/parent-page-123/children')) {
            return jsonResponse({ results: [{ type: 'child_page', id: 'page-1', child_page: { title: 'Doc - v1' } }] });
          }
          if (url.includes('/blocks/page-1/children') && opts.method === 'GET') {
            const u = new URL(url);
            if (!u.searchParams.get('start_cursor')) {
              return jsonResponse({
                results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'first page' }] } }],
                has_more: true,
                next_cursor: 'cursor-2',
              });
            }
            return jsonResponse({
              results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'second page' }] } }],
              has_more: false,
            });
          }
          return jsonResponse({});
        })
      );

      const res = await fetchArtifactFromNotion(projectDir, 'Doc', 'v1');
      expect(res.success).toBe(true);
      expect(res.contentMarkdown).toContain('first page');
      expect(res.contentMarkdown).toContain('second page');
    });
  });

  describe('D-03 — purge marker and remote resolver', () => {
    it('writes the marker and removes Sigma/ only when called', () => {
      expect(fs.existsSync(path.join(projectDir, 'Sigma'))).toBe(true);
      const purged = purgeSigmaDir(projectDir, { chain_version: 'v1', dashboard_url: 'https://notion.so/dash' });
      expect(purged).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'Sigma'))).toBe(false);

      const markerPath = path.join(projectDir, '.sigma-remote-state.json');
      expect(fs.existsSync(markerPath)).toBe(true);
      const marker = fs.readJsonSync(markerPath);
      expect(marker.moved_to_notion).toBe(true);
      expect(marker.chain_version).toBe('v1');
    });

    it('findProjectRootForRemote resolves after Sigma/ is purged', () => {
      purgeSigmaDir(projectDir, { chain_version: 'v1' });
      const resolved = findProjectRootForRemote(projectDir);
      expect(resolved).toBe(projectDir);
    });
  });

  describe('D-02 — regression guard: shared findProjectRoot is untouched', () => {
    it('does NOT anchor on .sigma-identity.json alone (no Sigma/activate_status.json)', () => {
      const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-notion-v2-bare-'));
      try {
        fs.writeJsonSync(path.join(bareDir, '.sigma-identity.json'), {
          schema_version: SCHEMA_VERSION,
          project_id: 'BARE',
          project_name: 'Bare',
          registered: true,
          logs_created_at: new Date().toISOString(),
        });

        expect(() => findProjectRoot(bareDir)).toThrow(/Not inside a Sigma project/);
      } finally {
        fs.removeSync(bareDir);
      }
    });

    it('still resolves normally when Sigma/activate_status.json is present', () => {
      expect(findProjectRoot(projectDir)).toBe(projectDir);
    });

    it('points to `sigma notion pull-state` instead of `sigma project start` once the remote marker exists', () => {
      purgeSigmaDir(projectDir, { chain_version: 'v1' });
      expect(() => findProjectRoot(projectDir)).toThrow(/sigma notion pull-state/);
      expect(() => findProjectRoot(projectDir)).not.toThrow(/sigma project start/);
    });
  });

  describe('D-04 point 5 — purge only fires when every push in the sequence succeeds', () => {
    it('does not purge Sigma/ when the dashboard push succeeds but the state backup push fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, opts: any) => {
          if (url.includes('/blocks/parent-page-123/children') && opts.method === 'GET') {
            return jsonResponse({ results: [] }); // nothing exists yet, everything goes through create
          }
          if (url.endsWith('/pages') && opts.method === 'POST') {
            const body = JSON.parse(opts.body);
            const title: string = body.properties.title.title[0].text.content;
            if (title.startsWith('Chain State')) {
              return { ok: false, status: 500, statusText: 'Internal Error', json: async () => ({ message: 'state push failed' }) };
            }
            return jsonResponse({ id: 'new-page-1', url: `https://notion.so/${title.replace(/\s+/g, '-')}` });
          }
          return jsonResponse({});
        })
      );

      const res = await runNotionPush(projectDir);

      expect(res.success).toBe(false);
      expect(res.purged).toBe(false);
      // Dashboard push happened first and did succeed — its URL should
      // still surface to the caller even though the overall push failed.
      expect(res.dashboardUrl).toContain('Governance-Dashboard');
      expect(fs.existsSync(path.join(projectDir, 'Sigma'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, '.sigma-remote-state.json'))).toBe(false);
    });

    it('purges Sigma/ only after both the dashboard and the state backup succeed', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, opts: any) => {
          if (url.includes('/blocks/parent-page-123/children') && opts.method === 'GET') {
            return jsonResponse({ results: [] });
          }
          if (url.endsWith('/pages') && opts.method === 'POST') {
            const body = JSON.parse(opts.body);
            const title: string = body.properties.title.title[0].text.content;
            return jsonResponse({ id: `page-${title}`, url: `https://notion.so/${title.replace(/\s+/g, '-')}` });
          }
          return jsonResponse({});
        })
      );

      const res = await runNotionPush(projectDir);

      expect(res.success).toBe(true);
      expect(res.purged).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'Sigma'))).toBe(false);
      expect(fs.existsSync(path.join(projectDir, '.sigma-remote-state.json'))).toBe(true);
    });
  });
});

function jsonResponse(body: any): { ok: true; json: () => Promise<any> } {
  return { ok: true, json: async () => body };
}

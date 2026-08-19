"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResolvedNotionConfig = getResolvedNotionConfig;
exports.ensureGitignoreNotion = ensureGitignoreNotion;
exports.findProjectRootForRemote = findProjectRootForRemote;
exports.clearRemoteStateMarker = clearRemoteStateMarker;
exports.purgeSigmaDir = purgeSigmaDir;
exports.testNotionConnection = testNotionConnection;
exports.isNotionApiDetectable = isNotionApiDetectable;
exports.markdownToNotionBlocks = markdownToNotionBlocks;
exports.syncArtifactToNotion = syncArtifactToNotion;
exports.deleteNotionPageByTitle = deleteNotionPageByTitle;
exports.fetchArtifactFromNotion = fetchArtifactFromNotion;
exports.pushStateToNotion = pushStateToNotion;
exports.pullStateFromNotion = pullStateFromNotion;
exports.fetchRemoteProgressFromNotion = fetchRemoteProgressFromNotion;
exports.syncProjectStateToNotion = syncProjectStateToNotion;
exports.runNotionPush = runNotionPush;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const projectConfig_1 = require("./projectConfig");
const notionCredentials_1 = require("./notionCredentials");
const chain_1 = require("./chain");
const config_1 = require("../config");
const NOTION_API_VERSION = '2022-06-28';
const NOTION_BASE_URL = 'https://api.notion.com/v1';
const MAX_BLOCKS_PER_REQUEST = 100;
// D-01 — token is resolved from the global per-machine credentials store
// (env var, then ~/.sigma/notion.credentials.json), never from anything
// under the project root. parent_page_id/database_id/clean_local are not
// secrets and stay in Sigma/project.config.json.
function getResolvedNotionConfig(projectRoot) {
    const projCfgPath = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'project.config.json');
    const projCfg = fs_extra_1.default.existsSync(projCfgPath)
        ? (0, projectConfig_1.readProjectConfig)(projectRoot).notion || {}
        : {};
    const token = (0, notionCredentials_1.resolveNotionToken)(projectRoot);
    return {
        enabled: Boolean(projCfg.enabled) && Boolean(token),
        token,
        parent_page_id: projCfg.parent_page_id,
        database_id: projCfg.database_id,
        clean_local: projCfg.clean_local ?? false,
    };
}
function ensureGitignoreNotion(projectRoot) {
    const gitignorePath = path_1.default.join(projectRoot, '.gitignore');
    let content = '';
    if (fs_extra_1.default.existsSync(gitignorePath)) {
        content = fs_extra_1.default.readFileSync(gitignorePath, 'utf8');
    }
    if (content.includes('Sigma/')) {
        return { added: false };
    }
    const newEntry = '\n# Sigma governance local runtime cache (mirrored to Notion Cloud)\nSigma/\n';
    fs_extra_1.default.appendFileSync(gitignorePath, newEntry, 'utf8');
    return { added: true };
}
// D-02 — deliberately NOT exported for use by the 17 non-Notion commands.
// The shared findProjectRoot() in utils/fs.ts anchors only on
// Sigma/activate_status.json, unchanged from main. Notion commands that must
// work after Sigma/ has been purged (pull-state, progress, status) use this
// resolver instead, which also recognizes .sigma-identity.json and the
// post-purge marker.
function findProjectRootForRemote(startDir) {
    let current = path_1.default.resolve(startDir);
    while (true) {
        const identityCandidate = path_1.default.join(current, config_1.PROJECT_IDENTITY_FILE);
        const remoteStateCandidate = path_1.default.join(current, config_1.PROJECT_REMOTE_STATE_FILE);
        const activateCandidate = path_1.default.join(current, config_1.PROJECT_SIGMA_DIR, 'activate_status.json');
        if (fs_extra_1.default.existsSync(identityCandidate) ||
            fs_extra_1.default.existsSync(remoteStateCandidate) ||
            fs_extra_1.default.existsSync(activateCandidate)) {
            return current;
        }
        const parent = path_1.default.dirname(current);
        if (parent === current)
            return undefined;
        current = parent;
    }
}
// D-03 — written only after the caller has confirmed every push in the
// sequence succeeded. Sibling to .sigma-identity.json so it survives the
// purge it documents.
function writeRemoteStateMarker(projectRoot, marker) {
    const markerPath = path_1.default.join(projectRoot, config_1.PROJECT_REMOTE_STATE_FILE);
    fs_extra_1.default.writeJsonSync(markerPath, {
        moved_to_notion: true,
        chain_version: marker.chain_version,
        pushed_at: new Date().toISOString(),
        dashboard_url: marker.dashboard_url,
    }, { spaces: 2 });
}
function clearRemoteStateMarker(projectRoot) {
    const markerPath = path_1.default.join(projectRoot, config_1.PROJECT_REMOTE_STATE_FILE);
    if (fs_extra_1.default.existsSync(markerPath)) {
        fs_extra_1.default.removeSync(markerPath);
    }
}
// Only called by the caller after every push in the sequence has been
// confirmed successful (D-04 point 5) — never best-effort per-artifact.
function purgeSigmaDir(projectRoot, marker) {
    const sigmaDir = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR);
    if (!fs_extra_1.default.existsSync(sigmaDir))
        return false;
    writeRemoteStateMarker(projectRoot, marker);
    fs_extra_1.default.removeSync(sigmaDir);
    return true;
}
async function testNotionConnection(token) {
    if (!token) {
        return { success: false, error: 'Notion token not provided.' };
    }
    try {
        const res = await fetch(`${NOTION_BASE_URL}/users/me`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Notion-Version': NOTION_API_VERSION,
                'Content-Type': 'application/json',
            },
        });
        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            return { success: false, error: errJson?.message || `HTTP ${res.status}: ${res.statusText}` };
        }
        const data = (await res.json());
        const botName = data.name || data.bot?.workspace_name || 'Sigma Bot';
        const workspaceName = data.bot?.workspace_name || 'Notion Workspace';
        return { success: true, botName, workspaceName };
    }
    catch (err) {
        return { success: false, error: err.message || 'Failed to connect to Notion API.' };
    }
}
// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §3.1 — `sigma project start`'s
// notion_humanize_gate prompt auto-falls back to OFF when this returns
// false, instead of asking a question the Director couldn't act on yet.
// Only the env var path is checkable here: at `project start` time
// .sigma-identity.json hasn't been written, so resolveNotionToken()'s
// project-keyed lookup in the global credentials file can never resolve
// anything — env var is the only real signal available this early.
async function isNotionApiDetectable() {
    const token = process.env.NOTION_TOKEN;
    if (!token)
        return false;
    const result = await testNotionConnection(token);
    return result.success;
}
function chunkRichText(text, maxLength = 2000) {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLength) {
        chunks.push({
            type: 'text',
            text: { content: text.slice(i, i + maxLength) },
        });
    }
    return chunks.length > 0 ? chunks : [{ type: 'text', text: { content: '' } }];
}
function markdownToNotionBlocks(markdownText) {
    const lines = markdownText.split('\n');
    const blocks = [];
    let inCodeBlock = false;
    let codeBuffer = [];
    let codeLang = 'plain text';
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('```')) {
            if (inCodeBlock) {
                blocks.push({
                    object: 'block',
                    type: 'code',
                    code: {
                        language: codeLang,
                        rich_text: chunkRichText(codeBuffer.join('\n')),
                    },
                });
                codeBuffer = [];
                inCodeBlock = false;
            }
            else {
                inCodeBlock = true;
                codeLang = trimmed.slice(3).trim() || 'plain text';
                if (codeLang === 'bash' || codeLang === 'sh')
                    codeLang = 'shell';
                if (codeLang === 'ts')
                    codeLang = 'typescript';
                if (codeLang === 'js')
                    codeLang = 'javascript';
                if (codeLang === 'json')
                    codeLang = 'json';
                if (codeLang === 'md')
                    codeLang = 'markdown';
            }
            continue;
        }
        if (inCodeBlock) {
            codeBuffer.push(line);
            continue;
        }
        if (!trimmed)
            continue;
        if (trimmed.startsWith('# ')) {
            blocks.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: chunkRichText(trimmed.slice(2)) } });
        }
        else if (trimmed.startsWith('## ')) {
            blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: chunkRichText(trimmed.slice(3)) } });
        }
        else if (trimmed.startsWith('### ')) {
            blocks.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: chunkRichText(trimmed.slice(4)) } });
        }
        else if (trimmed.startsWith('---') || trimmed.startsWith('***')) {
            blocks.push({ object: 'block', type: 'divider', divider: {} });
        }
        else if (trimmed.startsWith('> [!') || trimmed.startsWith('> ')) {
            let calloutText = trimmed.replace(/^>\s*/, '');
            let emoji = '💡';
            if (calloutText.includes('[!IMPORTANT]'))
                emoji = '❗';
            if (calloutText.includes('[!WARNING]'))
                emoji = '⚠️';
            if (calloutText.includes('[!TIP]'))
                emoji = '💡';
            if (calloutText.includes('[!NOTE]'))
                emoji = '📝';
            calloutText = calloutText.replace(/\[!(IMPORTANT|WARNING|TIP|NOTE)\]\s*/, '').trim();
            const lastBlock = blocks[blocks.length - 1];
            if (lastBlock && lastBlock.type === 'callout' && !trimmed.startsWith('> [!')) {
                const prevText = lastBlock.callout.rich_text[0].text.content;
                lastBlock.callout.rich_text[0].text.content = prevText ? `${prevText}\n${calloutText}` : calloutText;
            }
            else {
                blocks.push({ object: 'block', type: 'callout', callout: { icon: { emoji }, rich_text: chunkRichText(calloutText) } });
            }
        }
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            blocks.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: chunkRichText(trimmed.slice(2)) } });
        }
        else {
            blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: chunkRichText(trimmed) } });
        }
    }
    return blocks;
}
function notionHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_API_VERSION,
        'Content-Type': 'application/json',
    };
}
// D-06 — resolves an existing page by listing the configured parent page's
// direct children and matching child_page titles, instead of the
// workspace-wide /v1/search used previously. Paginated (has_more/next_cursor)
// so it is correct once a parent page has more than 100 children.
async function findChildPageId(token, parentPageId, title) {
    let cursor;
    do {
        const url = new URL(`${NOTION_BASE_URL}/blocks/${parentPageId}/children`);
        url.searchParams.set('page_size', '100');
        if (cursor)
            url.searchParams.set('start_cursor', cursor);
        const res = await fetch(url.toString(), { method: 'GET', headers: notionHeaders(token) });
        if (!res.ok)
            return undefined;
        const data = (await res.json());
        const match = (data.results || []).find((b) => b.type === 'child_page' && b.child_page?.title === title);
        if (match)
            return match.id;
        cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
    return undefined;
}
// D-05 (push side) — Notion's PATCH children endpoint accepts at most 100
// blocks per call. Sends sequential requests instead of the old
// blocks.slice(0, 100) silent truncation.
async function appendBlocksChunked(token, pageId, blocks) {
    for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
        const chunk = blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST);
        const res = await fetch(`${NOTION_BASE_URL}/blocks/${pageId}/children`, {
            method: 'PATCH',
            headers: notionHeaders(token),
            body: JSON.stringify({ children: chunk }),
        });
        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            return { success: false, error: errJson?.message || `Failed to append blocks (HTTP ${res.status}).` };
        }
    }
    return { success: true };
}
// D-05 (fetch side) — paginates GET children fully instead of reading only
// the first page.
async function listAllBlockChildren(token, blockId) {
    const results = [];
    let cursor;
    do {
        const url = new URL(`${NOTION_BASE_URL}/blocks/${blockId}/children`);
        url.searchParams.set('page_size', '100');
        if (cursor)
            url.searchParams.set('start_cursor', cursor);
        const res = await fetch(url.toString(), { method: 'GET', headers: notionHeaders(token) });
        if (!res.ok)
            break;
        const data = (await res.json());
        results.push(...(data.results || []));
        cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
    return results;
}
async function syncArtifactToNotion(projectRoot, artifactType, version, contentMarkdown) {
    const config = getResolvedNotionConfig(projectRoot);
    if (!config.enabled || !config.token) {
        return { success: false, error: 'Notion integration is not configured or enabled.' };
    }
    if (!config.parent_page_id) {
        return { success: false, error: 'Notion parent_page_id is not configured. Run `sigma notion setup --parent-id <id>`.' };
    }
    const title = `${artifactType} - ${version}`;
    const blocks = markdownToNotionBlocks(contentMarkdown);
    try {
        const existingPageId = await findChildPageId(config.token, config.parent_page_id, title);
        if (existingPageId) {
            // D-04 — capture old block IDs, append new content, verify success,
            // ONLY THEN delete the old blocks. The page is never left empty
            // mid-operation: if append fails, old content is untouched.
            const oldBlocks = await listAllBlockChildren(config.token, existingPageId);
            const oldBlockIds = oldBlocks.map((b) => b.id);
            const appendRes = await appendBlocksChunked(config.token, existingPageId, blocks);
            if (!appendRes.success) {
                return { success: false, error: appendRes.error };
            }
            for (const oldId of oldBlockIds) {
                await fetch(`${NOTION_BASE_URL}/blocks/${oldId}`, {
                    method: 'DELETE',
                    headers: notionHeaders(config.token),
                }).catch(() => { });
            }
            return { success: true, pageUrl: `https://notion.so/${existingPageId.replace(/-/g, '')}` };
        }
        // No existing page — create it under the parent, then append remaining
        // blocks beyond the first 100 (page creation itself accepts up to 100
        // children inline).
        const firstChunk = blocks.slice(0, MAX_BLOCKS_PER_REQUEST);
        const rest = blocks.slice(MAX_BLOCKS_PER_REQUEST);
        const createRes = await fetch(`${NOTION_BASE_URL}/pages`, {
            method: 'POST',
            headers: notionHeaders(config.token),
            body: JSON.stringify({
                parent: { page_id: config.parent_page_id },
                properties: { title: { title: [{ type: 'text', text: { content: title } }] } },
                children: firstChunk,
            }),
        });
        if (!createRes.ok) {
            const errJson = await createRes.json().catch(() => ({}));
            return { success: false, error: errJson?.message || 'Failed to create Notion page.' };
        }
        const createdData = (await createRes.json());
        if (rest.length > 0) {
            const appendRes = await appendBlocksChunked(config.token, createdData.id, rest);
            if (!appendRes.success) {
                return { success: false, error: appendRes.error };
            }
        }
        return { success: true, pageUrl: createdData.url };
    }
    catch (err) {
        return { success: false, error: err.message || 'Failed to reach Notion.' };
    }
}
// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.5 — reconcile-on-push primitive.
// Notion has no true delete via API; archiving (PATCH .../pages/{id}
// {archived:true}) moves the page to trash, which is the closest
// equivalent and is what every Notion client surfaces as "delete" anyway.
// Generic by design — takes a title, knows nothing about SUPERSEDED or
// human artifacts; humanizePush.ts decides *when* to call this.
async function deleteNotionPageByTitle(projectRoot, artifactType, version) {
    const config = getResolvedNotionConfig(projectRoot);
    if (!config.enabled || !config.token || !config.parent_page_id) {
        return { deleted: false, error: 'Notion integration is not configured or enabled.' };
    }
    const title = `${artifactType} - ${version}`;
    try {
        const pageId = await findChildPageId(config.token, config.parent_page_id, title);
        if (!pageId) {
            return { deleted: false }; // nothing to delete — not an error, page was never pushed or already gone
        }
        const res = await fetch(`${NOTION_BASE_URL}/pages/${pageId}`, {
            method: 'PATCH',
            headers: notionHeaders(config.token),
            body: JSON.stringify({ archived: true }),
        });
        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            return { deleted: false, error: errJson?.message || `Failed to archive "${title}".` };
        }
        return { deleted: true };
    }
    catch (err) {
        return { deleted: false, error: err.message || 'Failed to reach Notion.' };
    }
}
async function fetchArtifactFromNotion(projectRoot, artifactType, version) {
    const config = getResolvedNotionConfig(projectRoot);
    if (!config.enabled || !config.token) {
        return { success: false, error: 'Notion integration is not configured or enabled.' };
    }
    if (!config.parent_page_id) {
        return { success: false, error: 'Notion parent_page_id is not configured. Run `sigma notion setup --parent-id <id>`.' };
    }
    const title = `${artifactType} - ${version}`;
    try {
        const pageId = await findChildPageId(config.token, config.parent_page_id, title);
        if (!pageId) {
            return { success: false, error: `Page "${title}" not found under the configured parent page.` };
        }
        const blocks = await listAllBlockChildren(config.token, pageId);
        const lines = [];
        for (const b of blocks) {
            if (b.type === 'heading_1')
                lines.push(`# ${(b.heading_1.rich_text || []).map((t) => t.plain_text || '').join('')}`);
            else if (b.type === 'heading_2')
                lines.push(`## ${(b.heading_2.rich_text || []).map((t) => t.plain_text || '').join('')}`);
            else if (b.type === 'heading_3')
                lines.push(`### ${(b.heading_3.rich_text || []).map((t) => t.plain_text || '').join('')}`);
            else if (b.type === 'bulleted_list_item')
                lines.push(`- ${(b.bulleted_list_item.rich_text || []).map((t) => t.plain_text || '').join('')}`);
            else if (b.type === 'callout')
                lines.push(`> [!NOTE]\n> ${(b.callout.rich_text || []).map((t) => t.plain_text || '').join('')}`);
            else if (b.type === 'code') {
                const codeContent = (b.code.rich_text || []).map((t) => t.plain_text || '').join('');
                lines.push(`\`\`\`${b.code.language || ''}\n${codeContent}\n\`\`\``);
            }
            else if (b.type === 'paragraph') {
                lines.push((b.paragraph.rich_text || []).map((t) => t.plain_text || '').join(''));
            }
        }
        return { success: true, contentMarkdown: lines.join('\n'), pageUrl: `https://notion.so/${pageId.replace(/-/g, '')}` };
    }
    catch (err) {
        return { success: false, error: err.message || 'Failed to fetch from Notion.' };
    }
}
async function pushStateToNotion(projectRoot, activeChain) {
    const identityPath = path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE);
    const activatePath = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'activate_status.json');
    const projCfgPath = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'project.config.json');
    const chainPath = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, `progress-${activeChain}.json`);
    const payload = {
        active_chain: activeChain,
        identity: fs_extra_1.default.existsSync(identityPath) ? fs_extra_1.default.readJsonSync(identityPath) : null,
        activate_status: fs_extra_1.default.existsSync(activatePath) ? fs_extra_1.default.readJsonSync(activatePath) : null,
        project_config: fs_extra_1.default.existsSync(projCfgPath) ? fs_extra_1.default.readJsonSync(projCfgPath) : null,
        chain_state: fs_extra_1.default.existsSync(chainPath) ? fs_extra_1.default.readJsonSync(chainPath) : null,
    };
    const markdown = `# Sigma Chain State JSON — ${activeChain}

> [!NOTE]
> State backup: machine-readable payload for cross-device restore via \`sigma notion pull-state\`. Not meant for human reading — see the Governance Dashboard page instead.

\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\`
`;
    return syncArtifactToNotion(projectRoot, 'Chain State', activeChain, markdown);
}
async function pullStateFromNotion(projectRoot, activeChain = 'v1') {
    const fetched = await fetchArtifactFromNotion(projectRoot, 'Chain State', activeChain);
    if (!fetched.success || !fetched.contentMarkdown) {
        return { success: false, error: fetched.error || 'Failed to read state from Notion Cloud.' };
    }
    const jsonMatch = fetched.contentMarkdown.match(/```json\r?\n([\s\S]*?)\r?\n```/);
    if (!jsonMatch) {
        return { success: false, error: 'No JSON state payload found on the Notion page.' };
    }
    try {
        const payload = JSON.parse(jsonMatch[1]);
        const restoredFiles = [];
        if (payload.identity) {
            fs_extra_1.default.writeJsonSync(path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE), payload.identity, { spaces: 2 });
            restoredFiles.push(config_1.PROJECT_IDENTITY_FILE);
        }
        if (payload.activate_status) {
            const p = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'activate_status.json');
            fs_extra_1.default.ensureDirSync(path_1.default.dirname(p));
            fs_extra_1.default.writeJsonSync(p, payload.activate_status, { spaces: 2 });
            restoredFiles.push(`${config_1.PROJECT_SIGMA_DIR}/activate_status.json`);
        }
        if (payload.project_config) {
            const p = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'project.config.json');
            fs_extra_1.default.ensureDirSync(path_1.default.dirname(p));
            fs_extra_1.default.writeJsonSync(p, payload.project_config, { spaces: 2 });
            restoredFiles.push(`${config_1.PROJECT_SIGMA_DIR}/project.config.json`);
        }
        if (payload.chain_state) {
            const p = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, `progress-${activeChain}.json`);
            fs_extra_1.default.ensureDirSync(path_1.default.dirname(p));
            fs_extra_1.default.writeJsonSync(p, payload.chain_state, { spaces: 2 });
            restoredFiles.push(`${config_1.PROJECT_SIGMA_DIR}/progress-${activeChain}.json`);
        }
        // D-03 — restore succeeded, local state is alive again; the marker that
        // told findProjectRootForRemote()/error messages "this project's state
        // lives in Notion" no longer applies.
        clearRemoteStateMarker(projectRoot);
        return { success: true, restoredFiles };
    }
    catch (err) {
        return { success: false, error: `Failed to parse state JSON: ${err.message}` };
    }
}
async function fetchRemoteProgressFromNotion(projectRoot, activeChain = 'v1') {
    const fetched = await fetchArtifactFromNotion(projectRoot, 'Chain State', activeChain);
    if (!fetched.success || !fetched.contentMarkdown) {
        return { success: false, error: fetched.error || 'Failed to read progress from Notion Cloud.' };
    }
    const jsonMatch = fetched.contentMarkdown.match(/```json\r?\n([\s\S]*?)\r?\n```/);
    if (!jsonMatch) {
        return { success: false, error: 'No JSON state payload found on the Notion page.' };
    }
    try {
        const payload = JSON.parse(jsonMatch[1]);
        return { success: true, data: payload, pageUrl: fetched.pageUrl };
    }
    catch (err) {
        return { success: false, error: `Failed to parse state JSON: ${err.message}` };
    }
}
// D-08 — English only. D-07/§0.1 — dashboard only; raw artifact content is
// out of scope for this default push until Sigma Humanize Operation exists.
async function syncProjectStateToNotion(projectRoot, state) {
    const markdown = `# Sigma Governance Dashboard

> **Project**: ${state.projectName || 'N/A'} (\`${state.projectId || 'N/A'}\`)
> **Active Chain**: \`${state.active_chain || 'v1'}\` · **Phase**: \`${state.phase || 'N/A'}\`
> **Last Synced**: ${new Date().toISOString()}

---

## Gate Status

> **Gate 1 (Intent Ratified)**: ${state.gates?.gate_1_open ? 'OPEN' : 'CLOSED'}

> **Gate 2 (Plan Locked)**: ${state.gates?.gate_2_open ? 'OPEN' : 'BLOCKED'}

> **Gate 3 (Build Evidence)**: ${state.gates?.gate_3_satisfied ? 'SATISFIED' : 'BLOCKED'}

---

> [!NOTE]
> This dashboard reflects local Sigma state as of the last \`sigma notion push\`. It is not live — run \`sigma notion push\` again after significant governance events to refresh it.
`;
    return syncArtifactToNotion(projectRoot, 'Governance Dashboard', state.active_chain || 'v1', markdown);
}
// D-04 point 5 — the orchestration `sigma notion push` runs: purge only
// fires when every push in the sequence (dashboard, then state backup) has
// already succeeded. Kept here rather than inline in commands/notion.ts so
// the purge-gate rule is directly unit-testable against mocked fetch,
// without having to drive it through a CLI subprocess.
async function runNotionPush(projectRoot) {
    const resolved = getResolvedNotionConfig(projectRoot);
    if (!resolved.enabled || !resolved.token) {
        return { success: false, purged: false, error: 'Notion integration is not enabled or token is missing.' };
    }
    if (!resolved.parent_page_id) {
        return { success: false, purged: false, error: 'Notion parent_page_id is not configured.' };
    }
    const activeVersion = (0, chain_1.resolveActiveChainVersion)(projectRoot);
    const chain = (0, chain_1.readChain)(projectRoot, activeVersion);
    const identity = (0, chain_1.readProjectIdentity)(projectRoot);
    const dashboardRes = await syncProjectStateToNotion(projectRoot, {
        phase: chain.lifecycle_state,
        active_chain: chain.chain_version,
        gates: chain.gates,
        projectName: identity.project_name,
        projectId: identity.project_id,
    });
    if (!dashboardRes.success) {
        return { success: false, purged: false, error: dashboardRes.error };
    }
    const stateRes = await pushStateToNotion(projectRoot, chain.chain_version);
    if (!stateRes.success) {
        return { success: false, purged: false, error: stateRes.error, dashboardUrl: dashboardRes.pageUrl };
    }
    let purged = false;
    if (resolved.clean_local) {
        purged = purgeSigmaDir(projectRoot, { chain_version: chain.chain_version, dashboard_url: dashboardRes.pageUrl });
    }
    return { success: true, dashboardUrl: dashboardRes.pageUrl, purged };
}
//# sourceMappingURL=notionService.js.map
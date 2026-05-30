#!/usr/bin/env node
'use strict';

/**
 * refresh-registries.js
 *
 * Dev-only maintenance script for sigma-ecosystem.
 * Loads compiled CLI from dist/, walks the Commander.js command tree, diffs
 * against SIGMA-OPERATION-REGISTRY.json, and injects stubs for missing
 * operations. Also checks SIGMA-REGISTRY.json for known new document types.
 *
 * Guard: aborts if package.json name is not "sigma-ecosystem".
 * Prerequisite: npm run build  (dist/commands/ must exist)
 *
 * Usage:
 *   node scripts/refresh-registries.js            — apply updates
 *   node scripts/refresh-registries.js --dry-run  — report only, no writes
 */

const fs   = require('fs');
const path = require('path');

const ROOT          = process.cwd();
const DRY_RUN       = process.argv.includes('--dry-run');
const SIGMA_DIR     = path.join(ROOT, 'Sigma');
const DIST_DIR      = path.join(ROOT, 'dist');
const OP_REGISTRY   = path.join(SIGMA_DIR, 'SIGMA-OPERATION-REGISTRY.json');
const DOC_REGISTRY  = path.join(SIGMA_DIR, 'SIGMA-REGISTRY.json');

// ── Guard ─────────────────────────────────────────────────────────────────────

function guard() {
  const pkgPath = path.join(ROOT, 'package.json');
  if (!fs.existsSync(pkgPath)) die('No package.json found. Run from the sigma-ecosystem root.');

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name !== 'sigma-ecosystem') {
    die(`Package name is "${pkg.name}" — expected "sigma-ecosystem".\nThis script may only run from the sigma-ecosystem source root.`);
  }
  if (!fs.existsSync(path.join(DIST_DIR, 'commands'))) {
    die('dist/commands/ not found. Run "npm run build" first.');
  }
  if (!fs.existsSync(OP_REGISTRY)) die(`${OP_REGISTRY} not found.`);
  if (!fs.existsSync(DOC_REGISTRY)) die(`${DOC_REGISTRY} not found.`);
}

function die(msg) { console.error(`\nError: ${msg}\n`); process.exit(1); }
function log(msg) { console.log(msg); }

// ── Commander tree walker ─────────────────────────────────────────────────────

/**
 * Recursively walk a Commander.js Command object tree.
 * Returns a flat array of operations — one entry per command that has an
 * action handler attached.
 *
 * idChain: underscore-joined ancestor names, e.g. "plan" or "config_set"
 */
function collectOps(cmd, idChain) {
  const results = [];

  // Strip positional argument syntax from command name:
  //   "language <lang>"  →  "language"
  //   "advance testing"  →  "advance_testing"  (multi-word command names)
  const rawName  = cmd.name() || '';
  const cleanName = rawName
    .replace(/<[^>]*>/g, '')   // remove <arg>
    .replace(/\[[^\]]*\]/g, '') // remove [opt]
    .trim()
    .replace(/\s+/g, '_');     // spaces → underscores

  if (!cleanName) return results;

  const chain = idChain ? `${idChain}_${cleanName}` : cleanName;

  // _actionHandler is Commander.js v7-v12 internal — indicates this command
  // has a registered .action() handler and is therefore an executable operation.
  if (typeof cmd._actionHandler === 'function') {
    const parts  = chain.split('_');
    const domain = parts[0];
    const action = parts.slice(1).join(' ') || domain;

    results.push({
      operation_id: chain,
      domain,
      action,
      description: cmd.description() || '',
      options: (cmd.options || []).map(o => ({
        flags:    o.flags,
        required: !!o.required,
      })),
    });
  }

  for (const sub of (cmd.commands || [])) {
    results.push(...collectOps(sub, chain));
  }

  return results;
}

// ── Load CLI operations from dist/ ────────────────────────────────────────────

function loadCliOps() {
  const commandsDir = path.join(DIST_DIR, 'commands');
  const jsFiles     = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
  const allOps      = [];

  for (const file of jsFiles) {
    const modName     = path.basename(file, '.js');
    const factoryName = `${modName}Command`;
    try {
      const mod = require(path.join(commandsDir, file));
      if (typeof mod[factoryName] !== 'function') continue; // no matching export
      const cmd = mod[factoryName]();
      allOps.push(...collectOps(cmd, ''));
    } catch (err) {
      log(`  [WARN] Could not load dist/commands/${file}: ${err.message}`);
    }
  }

  return allOps;
}

// ── Inference helpers ─────────────────────────────────────────────────────────

const READ_ONLY_ACTIONS  = ['status', 'list', 'show', 'check', 'evidence', 'bootstrap', 'generate'];
const DIRECTOR_VERBS     = ['lock', 'supersede', 'reset', 'sync', 'register'];

function inferLevel(domain, action) {
  if (domain === 'setup')                                                 return 'system';
  if (READ_ONLY_ACTIONS.some(r => action === r || action.startsWith(r + ' '))) return 'read_only';
  return 'semantic';
}

function inferRole(action) {
  if (DIRECTOR_VERBS.some(v => action === v || action.startsWith(v + ' '))) return 'director';
  return 'any';
}

// ── Build operation stub ──────────────────────────────────────────────────────

function buildOpStub(op) {
  const requiredInputs = op.options
    .filter(o => o.required)
    .map(o => ({
      name:        (o.flags.match(/--[\w-]+/) || ['--?'])[0],
      type:        'string',
      required:    true,
      description: o.flags,
    }));

  return {
    operation_id: op.operation_id,
    domain:       op.domain,
    action:       op.action,
    level:        inferLevel(op.domain, op.action),
    role:         inferRole(op.action),
    description:  op.description || `[NEEDS_REVIEW] Describe ${op.operation_id}`,
    inputs:       requiredInputs,
    outputs: [
      { type: 'NEEDS_REVIEW', description: 'Fill in: outputs for this operation' },
    ],
    constraints: [],
    gating: {
      pre_condition:  'NEEDS_REVIEW',
      post_condition: 'NEEDS_REVIEW',
    },
    error_messages: {},
    NEEDS_REVIEW: true,
  };
}

// ── Refresh SIGMA-OPERATION-REGISTRY.json ─────────────────────────────────────

function refreshOpRegistry(discovered) {
  const reg = JSON.parse(fs.readFileSync(OP_REGISTRY, 'utf8'));

  const existingIds  = new Set(reg.operations.map(o => o.operation_id));
  const discoveredIds = new Set(discovered.map(o => o.operation_id));

  const newOps     = discovered.filter(o => !existingIds.has(o.operation_id));
  const removedIds = [...existingIds].filter(id => !discoveredIds.has(id));
  const allDomains = [...new Set([...reg.domains, ...discovered.map(o => o.domain)])].sort();

  log('\n── SIGMA-OPERATION-REGISTRY.json');
  log(`   Registered: ${reg.total_operations}  |  Detected: ${discovered.length}  |  New: ${newOps.length}  |  Removed: ${removedIds.length}`);

  if (newOps.length > 0) {
    log('\n   + New operations (stubs to be injected):');
    newOps.forEach(o => log(`       + ${o.operation_id}  (inferred level=${inferLevel(o.domain, o.action)}, role=${inferRole(o.action)})`));
  }

  if (removedIds.length > 0) {
    log('\n   ? In registry but not detected in CLI (review manually):');
    removedIds.forEach(id => log(`       ? ${id}`));
  }

  if (DRY_RUN) { log('\n   [dry-run] No writes.'); return; }

  if (newOps.length === 0 && allDomains.join() === reg.domains.join()) {
    log('   Nothing to update.');
    return;
  }

  newOps.forEach(op => reg.operations.push(buildOpStub(op)));
  reg.total_operations = reg.operations.length;
  reg.domains          = allDomains;
  reg.generated_at     = new Date().toISOString();

  fs.writeFileSync(OP_REGISTRY, JSON.stringify(reg, null, 2) + '\n', 'utf8');
  log(`\n   ✓ Injected ${newOps.length} stub(s). total_operations → ${reg.total_operations}`);
  if (newOps.length > 0) {
    log('   Action required: fill in gating, constraints, and outputs for NEEDS_REVIEW entries.');
  }
}

// ── Refresh SIGMA-REGISTRY.json ───────────────────────────────────────────────

// Documents introduced after the registry was initially authored.
// Add entries here whenever a new file type is established in user projects.
const KNOWN_NEW_DOCS = [
  {
    document_id: 'project_config',
    file:        'project.config.json',
    location:    'Sigma/',
    authority_tier: 'agent_config',
    owner:       'Director',
    lifecycle:   'runtime — created on first sigma config set; absent = defaults apply',
    mandatory_when: ['session_bootstrap'],
    description: (
      'Director-scoped project configuration. Stores interaction_language and ' +
      'document_language preferences. Absent until first sigma config set; ' +
      'CLI defaults to English (en/en) when file is missing. ' +
      'Written by: sigma config set. Read by: sigma session bootstrap, sigma config show.'
    ),
    tolerate_missing: true,
    missing_behavior: 'Default to English for both document and interaction language.',
  },
];

function refreshDocRegistry() {
  const reg = JSON.parse(fs.readFileSync(DOC_REGISTRY, 'utf8'));

  const existingIds = new Set(reg.documents.map(d => d.document_id));
  const toAdd       = KNOWN_NEW_DOCS.filter(d => !existingIds.has(d.document_id));

  log('\n── SIGMA-REGISTRY.json');
  log(`   Registered: ${reg.total_documents}  |  To add: ${toAdd.length}`);

  if (toAdd.length > 0) {
    log('\n   + Documents to inject:');
    toAdd.forEach(d => log(`       + ${d.document_id}  (${d.file})`));
  }

  if (DRY_RUN) { log('\n   [dry-run] No writes.'); return; }

  if (toAdd.length === 0) { log('   Nothing to update.'); return; }

  toAdd.forEach(d => reg.documents.push(d));
  reg.total_documents = reg.documents.length;
  reg.generated_at    = new Date().toISOString();

  fs.writeFileSync(DOC_REGISTRY, JSON.stringify(reg, null, 2) + '\n', 'utf8');
  log(`\n   ✓ Injected ${toAdd.length} entry(s). total_documents → ${reg.total_documents}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

guard();

log(`\n=== Sigma Registry Refresh${DRY_RUN ? ' [DRY-RUN]' : ''} ===`);
log(`Root : ${ROOT}`);

log('\nLoading CLI command tree from dist/...');
const discovered = loadCliOps();
log(`  ${discovered.length} executable operations found.`);

refreshOpRegistry(discovered);
refreshDocRegistry();

log('\n=== Done ===\n');

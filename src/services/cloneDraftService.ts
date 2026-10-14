// F08b: supported section mapping, fresh identity and explicit preview binding.
import fs from 'fs-extra';
import path from 'path';
import { createIntentDraft, createIntentDraftTransactionFiles } from './intentDraftService';
import { createPlanDraft, createPlanDraftTransactionFiles } from './planDraftService';
import { resolveTemplate } from '../utils/artifacts';
import { withChainMetadata, resolveVersioningScheme } from '../engine/numbering';
import { nextChainVersion, nextPlanVersion } from '../engine/chain';
import { journaledWrite, controlTestFailpoint } from '../engine/controlStore';
import { validateSigmaDocFile } from '../utils/docCheck';
import { computeStateRevision } from '../mcp/contract';
import { captureArtifact, reviewChain, sectionsOf, targetOnly } from './sourceReviewService';
import { digest, readF08Store, writeF08Store, f08StorePath } from './f08Store';
import { artifactFileName, existingArtifactNames } from '../engine/artifactNames';

export interface CloneInput {
  projectRoot: string; type: 'intent' | 'plan'; sourceChain: string; sourceVersion: string;
  title: string; focus: string; allowReopenClosed?: boolean;
}
const CONTRACT_SECTIONS = {
  intent: new Set(['PURPOSE_AND_PROBLEM', 'DESIRED_OUTCOME_AND_MEASUREMENT', 'SCOPE', 'QUALITY_STANDARDS',
    'PRIORITIES_AND_CONSTRAINTS', 'ASSUMPTIONS_AND_RISKS', 'FUNCTIONAL_REQUIREMENTS', 'RESEARCH']),
  plan: new Set(['OBJECTIVE', 'REQUIREMENT', 'KEY_OUTPUT', 'WORK_ORDER', 'ACCEPTANCE_AND_TEST_CONTRACT',
    'CONSTRAINTS_FOR_DEV', 'WORK_OUTSIDE_INTENT']),
};
function delta(before: string, after: string): string {
  const a = before.replace(/\r\n/g, '\n').split('\n'), b = after.replace(/\r\n/g, '\n').split('\n');
  let head = 0, tail = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  return ['--- source', '+++ new draft', '@@ line ' + (head + 1) + ' @@',
    ...a.slice(head, a.length - tail).map(v => '-' + v), ...b.slice(head, b.length - tail).map(v => '+' + v)].join('\n');
}
export function previewClone(input: CloneInput) {
  const { projectRoot: root, type } = input;
  if (!['intent', 'plan'].includes(type)) throw new Error('Clone supports INTENT and PLAN only.');
  if (!input.title.trim() || !input.focus.trim() || /[|\r\n]/.test(input.title + input.focus))
    throw new Error('Clone title/focus must be non-empty single-line table-safe values.');
  const source = captureArtifact(root, input.sourceChain, type, input.sourceVersion);
  const docType = type === 'intent' ? 'DIR_INTENT' : 'FMN_PLAN', expectedSchema = type === 'intent' ? '5' : '3';
  const template = fs.readFileSync(resolveTemplate(type === 'intent' ? 'DIR-INTENT-TEMPLATE.md' : 'FMN-PLAN-TEMPLATE.md'), 'utf8');
  const schemaOf = (text: string) => text.match(/<!--\s*SIGMA:DOC type=([A-Z_]+) schema=(\d+)\s*-->/);
  const sourceSchema = schemaOf(source.content), destinationSchema = schemaOf(template);
  if (sourceSchema?.[1] !== docType || destinationSchema?.[1] !== docType ||
      sourceSchema[2] !== expectedSchema || destinationSchema[2] !== expectedSchema)
    throw new Error('Unsupported clone schema mapping. Supported: INTENT 5→5, PLAN 3→3. Review older schemas manually; host templates may require F09.');
  const structure = validateSigmaDocFile(path.join(root, source.path), type);
  if (!structure.ok) throw new Error('Source structure invalid: ' + structure.errors.join('; '));
  const sourceSections = sectionsOf(source.content, docType), templateSections = sectionsOf(template, docType);
  if (new Set(sourceSections.map(s => s.id)).size !== sourceSections.length ||
      new Set(templateSections.map(s => s.id)).size !== templateSections.length) throw new Error('Duplicate section markers; cannot clone.');
  const unknown = sourceSections.filter(s => !templateSections.some(t => t.id === s.id));
  if (unknown.length) throw new Error('Unmapped source sections: ' + unknown.map(s => s.id).join(', '));
  const active = reviewChain(root);
  const targetChain = type === 'intent' ? nextChainVersion(root) : active.chainVersion;
  const targetVersion = type === 'intent' ? targetChain : nextPlanVersion(active.data, active.data.intent.version);
  const sourceById = new Map(sourceSections.map(s => [s.id, s]));
  const allowed = CONTRACT_SECTIONS[type];
  let content = template.slice(0, template.indexOf(templateSections[0].marker));
  for (const section of templateSections) {
    const old = sourceById.get(section.id);
    if (old && allowed.has(section.id)) {
      // Boundary obligations survive; historical ratification is not inherited.
      content += section.marker + old.body.replace(/\bAMENDMENT_RATIFIED\b/g, 'AMENDMENT_REQUESTED').replace(/\[x\]/gi, '[ ]');
    } else content += section.marker + section.body;
  }
  content = content.replace(/<!--\s*SIGMA:CHAIN\b[\s\S]*?-->\s*/g, '');
  if (type === 'plan') content = content.replace('INTENT-v{X}', 'INTENT-' + active.data.intent.version);
  content = withChainMetadata(content, { intent: targetChain,
    versioning_scheme: type === 'intent' ? 'intent_aligned' : resolveVersioningScheme(active.data) });
  const targetDir = type === 'intent' ? 'charter' : 'contract';
  const targetPath = 'Sigma/' + targetDir + '/' + artifactFileName(type, targetVersion);
  // Either name form counts (F10).
  if (fs.existsSync(path.join(root, targetPath)) || existingArtifactNames(root, type, targetDir, targetVersion).length > 0) throw new Error('Clone destination already exists.');
  const reset = templateSections.filter(s => !allowed.has(s.id)).map(s => s.id);
  const binding = {
    type, source: targetOnly(source), title: input.title, focus: input.focus,
    target_chain: targetChain, target_version: targetVersion, target_path: targetPath,
    state_revision: computeStateRevision(root).revision, template_sha256: digest(template),
    content_sha256: digest(content), allow_reopen_closed: Boolean(input.allowReopenClosed),
  };
  return { ...binding, preview_token: digest(JSON.stringify(binding)), content,
    diff: delta(source.content, content), reset_sections: reset,
    effects: type === 'intent' ? ['Create and activate a new DRAFT INTENT chain; source unchanged.'] : ['Create a new DRAFT PLAN under the active chain; source unchanged.'] };
}
export function cloneTransactionFiles(input: CloneInput): string[] {
  return [...(input.type === 'intent' ? createIntentDraftTransactionFiles(input.projectRoot) : createPlanDraftTransactionFiles(input.projectRoot)),
    f08StorePath(input.projectRoot)];
}
export function cloneDraft(input: CloneInput, token: string) {
  const preview = previewClone(input);
  if (preview.preview_token !== token) throw new Error('STALE_ARTIFACT: source, template or project state changed; preview clone again.');
  const created = input.type === 'intent'
    ? createIntentDraft({ projectRoot: input.projectRoot, title: input.title, focus: input.focus, allowReopenClosed: input.allowReopenClosed })
    : createPlanDraft({ projectRoot: input.projectRoot, title: input.title, focus: input.focus });
  journaledWrite(input.projectRoot, path.join(input.projectRoot, created.relPath), preview.content);
  controlTestFailpoint('f08_clone_after_content');
  const target = targetOnly(captureArtifact(input.projectRoot, preview.target_chain, input.type, preview.target_version));
  const data = readF08Store(input.projectRoot);
  data.clones.push({ target, source: preview.source, created_at: new Date().toISOString(), diff: preview.diff, reset_sections: preview.reset_sections });
  writeF08Store(input.projectRoot, data);
  controlTestFailpoint('f08_clone_after_record');
  return { ...created, target, source: preview.source, sha256: target.sha256, diff: preview.diff, reset_sections: preview.reset_sections };
}

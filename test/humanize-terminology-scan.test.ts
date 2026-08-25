import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  scanForSigmaTerminology,
  stripTemplateInstructions,
  loadTerminologyList,
} from '../src/engine/terminologyScanner';
import { setupTestEnv, runCli, stubProjectRootAnchor, stubProjectIdentity, TestEnv } from './helpers';

// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.6/§2.7/§2.10, Fase 5/5a/5b.

describe('scanForSigmaTerminology()', () => {
  it('finds terms with line number and line text', () => {
    const content = 'Line one is clean.\nAfter DIR-INTENT was RATIFIED, work began.';
    const matches = scanForSigmaTerminology(content, ['DIR-INTENT', 'RATIFIED']);

    expect(matches).toEqual([
      { term: 'DIR-INTENT', line: 2, lineText: 'After DIR-INTENT was RATIFIED, work began.' },
      { term: 'RATIFIED', line: 2, lineText: 'After DIR-INTENT was RATIFIED, work began.' },
    ]);
  });

  it('returns empty when nothing matches', () => {
    expect(scanForSigmaTerminology('Nothing to see here.', ['DIR-INTENT', 'RATIFIED'])).toEqual([]);
  });

  it('is case-sensitive — lowercase "draft"/"locked" do not false-positive against DRAFT/LOCKED', () => {
    const content = 'This is a rough draft of the door being locked.';
    expect(scanForSigmaTerminology(content, ['DRAFT', 'LOCKED'])).toEqual([]);
  });

  it('respects word boundaries — "AUD" does not match inside "audit" or "Australia"', () => {
    const content = 'The audit covered Australia and AUD currency risk.';
    const matches = scanForSigmaTerminology(content, ['AUD']);
    expect(matches).toHaveLength(1);
    expect(matches[0].lineText).toContain('AUD currency risk');
  });

  it('matches multi-word terms like "Gate 2"', () => {
    expect(scanForSigmaTerminology('Blocked on Gate 2 review.', ['Gate 2'])).toHaveLength(1);
  });
});

describe('stripTemplateInstructions()', () => {
  it('removes every blockquote line, keeps everything else', () => {
    const content = [
      '# Title',
      '',
      '> Source: DIR-INTENT §1. Class: Preserve.',
      '> Do not include this in the output.',
      '',
      'This is real published content.',
      '',
      '## Section',
      '> Another instruction.',
      'More real content.',
    ].join('\n');

    const { cleaned, strippedLines } = stripTemplateInstructions(content);

    expect(strippedLines).toBe(3);
    expect(cleaned).not.toContain('>');
    expect(cleaned).toContain('This is real published content.');
    expect(cleaned).toContain('More real content.');
  });

  it('is a no-op on content with no blockquotes', () => {
    const content = 'Just plain text.\nAnother line.';
    const { cleaned, strippedLines } = stripTemplateInstructions(content);
    expect(strippedLines).toBe(0);
    expect(cleaned).toBe(content);
  });

  it('running the terminology scanner after stripping avoids false failures on instruction text', () => {
    // The core reason stripping must run first (§2.7 tahap 0): instructions
    // are intentionally full of Sigma vocabulary and would otherwise fail
    // every freshly generated document on their own template text.
    const content = [
      '> Source: FMN-PLAN §3 Work Order. Class: Preserve.',
      'The team shipped a CSV export button.',
    ].join('\n');

    const { cleaned } = stripTemplateInstructions(content);
    expect(scanForSigmaTerminology(cleaned, ['FMN-PLAN'])).toEqual([]);
    expect(scanForSigmaTerminology(content, ['FMN-PLAN'])).toHaveLength(1);
  });
});

describe('loadTerminologyList()', () => {
  let dir: string;

  afterEach(() => {
    if (dir) fs.removeSync(dir);
  });

  it('merges default (rules/) and custom (project root) lists, de-duplicated', () => {
    dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sigma-terms-'));
    fs.ensureDirSync(path.join(dir, 'Sigma', 'rules'));
    fs.writeJsonSync(path.join(dir, 'Sigma', 'rules', 'sigma_terminology.default.json'), {
      terms: ['DIR-INTENT', 'Sigma'],
    });
    fs.writeJsonSync(path.join(dir, 'Sigma', 'sigma_terminology.custom.json'), {
      terms: ['ProjectCodeName', 'Sigma'],
    });

    const terms = loadTerminologyList(dir);
    expect(terms.sort()).toEqual(['DIR-INTENT', 'ProjectCodeName', 'Sigma'].sort());
  });

  it('returns an empty list when neither file exists', () => {
    dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sigma-terms-'));
    expect(loadTerminologyList(dir)).toEqual([]);
  });
});

describe('sigma scan --file (CLI)', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  function seedTerminology(env: TestEnv) {
    fs.ensureDirSync(path.join(env.sigmaDir, 'rules'));
    fs.writeJsonSync(path.join(env.sigmaDir, 'rules', 'sigma_terminology.default.json'), {
      terms: ['DIR-INTENT', 'RATIFIED', 'Sigma'],
    });
  }

  it('reports clean with no findings and writes no log file', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    seedTerminology(env);
    const target = path.join(env.projectDir, 'notes.md');
    fs.writeFileSync(target, 'A perfectly ordinary note.');

    const result = runCli(`scan --file notes.md`, env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/No Sigma terminology detected/);
    const logsDir = path.join(env.sigmaDir, 'logs');
    const scanLogs = fs.existsSync(logsDir) ? fs.readdirSync(logsDir).filter(f => f.endsWith('_terminology-scan.log')) : [];
    expect(scanLogs).toHaveLength(0);
  });

  it('reports a count and writes findings to a timestamped log file', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    seedTerminology(env);
    const target = path.join(env.projectDir, 'notes.md');
    fs.writeFileSync(target, 'After DIR-INTENT was RATIFIED, Sigma moved forward.');

    const result = runCli(`scan --file notes.md`, env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/3 term\(s\) detected\. Full report: Sigma\/logs\/\d{8}-\d{6}_terminology-scan\.log/);
    expect(result.stdout).not.toContain('DIR-INTENT');

    const logsDir = path.join(env.sigmaDir, 'logs');
    const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('_terminology-scan.log'));
    expect(logFiles).toHaveLength(1);
    const logContent = fs.readFileSync(path.join(logsDir, logFiles[0]), 'utf8');
    expect(logContent).toContain('DIR-INTENT');
    expect(logContent).toContain('RATIFIED');
    expect(logContent).toContain('3 term(s) found');
  });

  it('skips Sigma artifact files by filename pattern instead of scanning them', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    seedTerminology(env);
    const artifactPath = path.join(env.sigmaDir, 'charter', 'DIR-INTENT-v1.md');
    fs.ensureDirSync(path.dirname(artifactPath));
    fs.writeFileSync(artifactPath, 'RATIFIED intent content, full of Sigma vocabulary by design.');

    const result = runCli(`scan --file Sigma/charter/DIR-INTENT-v1.md`, env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Skipped: DIR-INTENT-v1\.md is a Sigma artifact file/);
    const logsDir = path.join(env.sigmaDir, 'logs');
    const scanLogs = fs.existsSync(logsDir) ? fs.readdirSync(logsDir).filter(f => f.endsWith('_terminology-scan.log')) : [];
    expect(scanLogs).toHaveLength(0);
  });

  it('errors clearly when the target file does not exist', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    seedTerminology(env);

    const result = runCli(`scan --file nope.md`, env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/does not exist/);
  });
});

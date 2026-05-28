import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { setupTestEnv, runCli, makeProgress, TestEnv } from './helpers';
import {
  generateMessageId,
  generateFilename,
  generateRandomSuffix,
  formatTimestampForId,
} from '../src/engine/mailbox';

describe('Mailbox regression', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  function readMailboxIndex(e: TestEnv) {
    const indexPath = path.join(e.projectDir, 'Sigma', 'messages', 'index.json');
    if (!fs.existsSync(indexPath)) return null;
    return fs.readJsonSync(indexPath);
  }

  function writeRawIndex(e: TestEnv, content: unknown) {
    const indexPath = path.join(e.projectDir, 'Sigma', 'messages', 'index.json');
    fs.ensureDirSync(path.dirname(indexPath));
    if (typeof content === 'string') {
      fs.writeFileSync(indexPath, content, 'utf8');
    } else {
      fs.writeJsonSync(indexPath, content, { spaces: 2 });
    }
  }

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('sigma send — happy path', () => {
    it('creates a message file and index entry', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());

      const r = runCli('send --from arc --to fmn --subject "Hello" --message "Body"', env.projectDir, env.homeDir);

      expect(r.exitCode).toBe(0);
      expect(r.stdout).toMatch(/Message sent/i);

      const index = readMailboxIndex(env);
      expect(index).not.toBeNull();
      expect(index.messages).toHaveLength(1);
      const m = index.messages[0];
      expect(m.from).toBe('ARC');
      expect(m.to).toBe('FMN');
      expect(m.status).toBe('UNREAD');
      expect(m.subject).toBe('Hello');
      expect(m.id).toMatch(/^MSG-/);
      expect(fs.existsSync(path.join(env.projectDir, m.file))).toBe(true);
    });

    it('does not modify progress.json', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());
      const before = JSON.stringify(fs.readJsonSync(env.progressPath));

      runCli('send --from arc --to fmn --subject "Test" --message "Body"', env.projectDir, env.homeDir);

      expect(JSON.stringify(fs.readJsonSync(env.progressPath))).toBe(before);
    });
  });

  // ── Unread gate ────────────────────────────────────────────────────────────

  describe('sigma send — unread gate', () => {
    it('is blocked when the sender has unread messages in their own inbox', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());

      // ARC sends to FMN → FMN now has 1 unread
      runCli('send --from arc --to fmn --subject "For FMN" --message "A"', env.projectDir, env.homeDir);
      // FMN tries to send while FMN still has unread → should be blocked
      const r = runCli('send --from fmn --to dev --subject "From FMN" --message "B"', env.projectDir, env.homeDir);

      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/SEND BLOCKED/i);
      expect(r.stderr).toMatch(/sigma inbox/i);
      expect(r.stderr).toMatch(/Policy/i);
    });

    it('allows send after the sender reads their own unread messages', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());

      // ARC sends to FMN → FMN has 1 unread
      runCli('send --from arc --to fmn --subject "For FMN" --message "A"', env.projectDir, env.homeDir);
      const msgId = readMailboxIndex(env).messages[0].id;
      // FMN reads the unread message
      runCli(`inbox read ${msgId}`, env.projectDir, env.homeDir);

      // FMN can now send
      const r = runCli('send --from fmn --to dev --subject "From FMN" --message "B"', env.projectDir, env.homeDir);
      expect(r.exitCode).toBe(0);
    });

    it('gate is per-sender — sender with no unread can send regardless of recipient unread state', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());

      // ARC sends to FMN → FMN gets unread; ARC itself has no unread
      runCli('send --from arc --to fmn --subject "For FMN" --message "A"', env.projectDir, env.homeDir);
      // ARC can send again (ARC has no unread, even though FMN does)
      const r = runCli('send --from arc --to dev --subject "For DEV" --message "B"', env.projectDir, env.homeDir);

      expect(r.exitCode).toBe(0);
    });

    it('sender can send multiple messages to same recipient when sender has no unread', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());

      runCli('send --from arc --to fmn --subject "First" --message "A"', env.projectDir, env.homeDir);
      // ARC still has no unread, so a second send from ARC is allowed
      const r = runCli('send --from arc --to fmn --subject "Second" --message "B"', env.projectDir, env.homeDir);

      expect(r.exitCode).toBe(0);
    });
  });

  // ── Identity uniqueness ───────────────────────────────────────────────────

  describe('message identity — collision resistance', () => {
    it('generateRandomSuffix returns a 4-character uppercase alphanumeric string', () => {
      const s = generateRandomSuffix();
      expect(s).toHaveLength(4);
      expect(s).toMatch(/^[A-Z0-9]{4}$/);
    });

    it('formatTimestampForId includes millisecond precision', () => {
      const ts1 = '2026-05-18T14:30:45.100Z';
      const ts2 = '2026-05-18T14:30:45.200Z';
      expect(formatTimestampForId(ts1)).not.toBe(formatTimestampForId(ts2));
    });

    it('generateMessageId differs when suffixes differ (same-millisecond scenario)', () => {
      const ts = '2026-05-18T14:30:45.123Z';
      const id1 = generateMessageId('ARC', 'FMN', ts, 'AAAA');
      const id2 = generateMessageId('ARC', 'FMN', ts, 'BBBB');
      expect(id1).not.toBe(id2);
    });

    it('generateFilename differs when suffixes differ (same-millisecond scenario)', () => {
      const ts = '2026-05-18T14:30:45.123Z';
      const f1 = generateFilename('NOTE', 'ARC', 'FMN', ts, 'AAAA');
      const f2 = generateFilename('NOTE', 'ARC', 'FMN', ts, 'BBBB');
      expect(f1).not.toBe(f2);
    });

    it('two sequential CLI sends produce distinct IDs and file paths', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());

      runCli('send --from arc --to fmn --subject "First" --message "A"', env.projectDir, env.homeDir);
      const id1 = readMailboxIndex(env).messages[0].id;
      const file1 = readMailboxIndex(env).messages[0].file;

      runCli(`inbox read ${id1}`, env.projectDir, env.homeDir);
      runCli('send --from arc --to fmn --subject "Second" --message "B"', env.projectDir, env.homeDir);
      const id2 = readMailboxIndex(env).messages[1].id;
      const file2 = readMailboxIndex(env).messages[1].file;

      expect(id1).not.toBe(id2);
      expect(file1).not.toBe(file2);
    });
  });

  // ── Attachment uniqueness ─────────────────────────────────────────────────

  describe('sigma send — attachments', () => {
    it('copies attachment with a filename derived from message ID', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());

      const srcFile = path.join(env.projectDir, 'notes.txt');
      fs.writeFileSync(srcFile, 'attachment content');

      const r = runCli(
        `send --from arc --to fmn --subject "With Attach" --message "See file" --attach "${srcFile}"`,
        env.projectDir,
        env.homeDir
      );

      expect(r.exitCode).toBe(0);
      const index = readMailboxIndex(env);
      expect(index.messages[0].attachments).toHaveLength(1);
      const attachPath = path.join(env.projectDir, index.messages[0].attachments[0]);
      expect(fs.existsSync(attachPath)).toBe(true);
      expect(index.messages[0].attachments[0]).toContain(index.messages[0].id);
    });
  });

  // ── sigma inbox ───────────────────────────────────────────────────────────

  describe('sigma inbox', () => {
    it('--role lists unread messages for the recipient', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());
      runCli('send --from arc --to fmn --subject "Task" --message "Do it"', env.projectDir, env.homeDir);

      const r = runCli('inbox --role fmn', env.projectDir, env.homeDir);

      expect(r.exitCode).toBe(0);
      expect(r.stdout).toMatch(/FMN/);
      expect(r.stdout).toMatch(/Task/);
    });

    it('read <id> marks the message as READ', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());
      runCli('send --from arc --to fmn --subject "Task" --message "Do it"', env.projectDir, env.homeDir);
      const msgId = readMailboxIndex(env).messages[0].id;

      const r = runCli(`inbox read ${msgId}`, env.projectDir, env.homeDir);

      expect(r.exitCode).toBe(0);
      expect(r.stdout).toMatch(/Marked as READ/i);
      expect(readMailboxIndex(env).messages[0].status).toBe('READ');
    });

    it('read <id> touches only the targeted message', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());
      runCli('send --from arc --to fmn --subject "Msg1" --message "A"', env.projectDir, env.homeDir);
      const id1 = readMailboxIndex(env).messages[0].id;
      runCli(`inbox read ${id1}`, env.projectDir, env.homeDir);
      runCli('send --from arc --to fmn --subject "Msg2" --message "B"', env.projectDir, env.homeDir);
      const id2 = readMailboxIndex(env).messages[1].id;

      runCli(`inbox read ${id2}`, env.projectDir, env.homeDir);

      const index = readMailboxIndex(env);
      expect(index.messages[0].status).toBe('READ');
      expect(index.messages[1].status).toBe('READ');
    });

    it('archive <id> marks the message as ARCHIVED', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());
      runCli('send --from arc --to fmn --subject "Task" --message "Do it"', env.projectDir, env.homeDir);
      const msgId = readMailboxIndex(env).messages[0].id;

      const r = runCli(`inbox archive ${msgId}`, env.projectDir, env.homeDir);

      expect(r.exitCode).toBe(0);
      expect(readMailboxIndex(env).messages[0].status).toBe('ARCHIVED');
    });

    it('read on unknown ID fails with a clear error', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());

      const r = runCli('inbox read MSG-99999999-000000000-ZZZZ-ARC-FMN', env.projectDir, env.homeDir);
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/not found/i);
    });
  });

  // ── Mailbox index corruption ──────────────────────────────────────────────

  describe('mailbox index corruption', () => {
    it('sigma send fails when index.json is not valid JSON', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());
      writeRawIndex(env, 'NOT_JSON{{{');

      const r = runCli('send --from arc --to fmn --subject "Test" --message "Body"', env.projectDir, env.homeDir);
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/index\.json/i);
    });

    it('sigma inbox fails when index.json is not valid JSON', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());
      writeRawIndex(env, 'NOT_JSON{{{');

      const r = runCli('inbox --role fmn', env.projectDir, env.homeDir);
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/index\.json/i);
    });

    it('sigma send fails when messages field is missing', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());
      writeRawIndex(env, { version: 1 });

      const r = runCli('send --from arc --to fmn --subject "Test" --message "Body"', env.projectDir, env.homeDir);
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/corruption/i);
    });

    it('sigma send fails when index contains duplicate IDs', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());
      const now = new Date().toISOString();
      const base = {
        id: 'MSG-DUPLICATE',
        from: 'ARC',
        to: 'FMN',
        type: 'NOTE',
        subject: 'Dup',
        file: 'Sigma/messages/FMN/dup-a.md',
        status: 'UNREAD',
        created_at: now,
        attachments: [],
      };
      writeRawIndex(env, {
        messages: [base, { ...base, file: 'Sigma/messages/FMN/dup-b.md' }],
      });

      const r = runCli('send --from arc --to fmn --subject "Test" --message "Body"', env.projectDir, env.homeDir);
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/duplicate/i);
    });

    it('malformed index is never auto-replaced with an empty mailbox', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());
      writeRawIndex(env, 'NOT_JSON{{{');

      runCli('send --from arc --to fmn --subject "Test" --message "Body"', env.projectDir, env.homeDir);

      const indexPath = path.join(env.projectDir, 'Sigma', 'messages', 'index.json');
      expect(fs.readFileSync(indexPath, 'utf8')).toBe('NOT_JSON{{{');
    });

    it('corruption error includes recovery guidance', () => {
      env = setupTestEnv();
      fs.writeJsonSync(env.progressPath, makeProgress());
      writeRawIndex(env, { version: 1 });

      const r = runCli('send --from arc --to fmn --subject "Test" --message "Body"', env.projectDir, env.homeDir);
      expect(r.stderr).toMatch(/Do not delete/i);
    });
  });
});

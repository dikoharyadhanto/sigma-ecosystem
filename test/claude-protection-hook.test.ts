import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';

const HOOK = path.resolve(__dirname, '../setup/targets/hooks/protect-sigma.js');
function run(input: unknown, raw = false) {
  return spawnSync(process.execPath, [HOOK], {
    input: raw ? String(input) : JSON.stringify(input),
    encoding: 'utf8', windowsHide: true,
  });
}

describe('Claude PreToolUse protection hook', () => {
  it.each([
    ['Write', 'file_path', 'C:\\project\\Sigma\\progress-v1.json'],
    ['Edit', 'file_path', '/project/Sigma/progress.json'],
    ['MultiEdit', 'file_path', 'Sigma/progress-v12.json'],
    ['Edit', 'path', 'Sigma/progress-v2.json'],
    ['Write', 'filePath', 'Sigma/progress-v3.json'],
    ['Write', 'file_path', 'src/../Sigma/progress-v4.json'],
  ])('denies %s with %s=%s using the native hook response', (tool, key, file) => {
    const result = run({ tool_name: tool, tool_input: { [key]: file, content: 'sensitive-payload' } });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ hookSpecificOutput: {
      hookEventName: 'PreToolUse', permissionDecision: 'deny',
      permissionDecisionReason: expect.stringContaining('CLI-managed'),
    } });
    expect(result.stdout + result.stderr).not.toContain('sensitive-payload');
  });

  it.each([
    { tool_name: 'Read', tool_input: { file_path: 'Sigma/progress-v1.json' } },
    { tool_name: 'Write', tool_input: { file_path: 'Sigma/Audit Product/Security/repro.mjs' } },
    { tool_name: 'Write', tool_input: { file_path: 'NotSigma/progress-v1.json' } },
    { tool_name: 'Edit', tool_input: { file_path: 'Sigma/progress-v1.json.bak' } },
    { tool_name: 'Write', tool_input: { file_path: 'Sigma/../src/progress.json' } },
    { tool_name: 'Edit', tool_input: null },
    { tool_name: 7, tool_input: { file_path: 'Sigma/progress.json' } },
    null,
  ])('leaves normal permission handling unchanged for %j', (input) => {
    const result = run(input);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('tolerates malformed hook input without emitting a false denial', () => {
    const result = run('{not-json', true);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});

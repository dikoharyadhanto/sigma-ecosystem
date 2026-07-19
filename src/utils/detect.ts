import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface DetectedTools {
  claudeCode: boolean;
  codex: boolean;
  reasonix: boolean;
  antigravity: boolean;
  cursor: boolean;
}

export interface ToolTargetPaths {
  claudeCommands: string;    // ~/.claude/commands/
  codexSkills: string;       // ~/.codex/skills/
  reasonixSkills: string;    // ~/.reasonix/skills/
  reasonixConfig: string;    // ~/.reasonix/config.json
  antigravitySkills: string; // ~/.gemini/config/skills/
  cursorRules: string;       // ~/.cursor/rules/
}

export function targetPaths(): ToolTargetPaths {
  const home = os.homedir();
  return {
    claudeCommands: path.join(home, '.claude', 'commands'),
    codexSkills: path.join(home, '.codex', 'skills'),
    reasonixSkills: path.join(home, '.reasonix', 'skills'),
    reasonixConfig: path.join(home, '.reasonix', 'config.json'),
    antigravitySkills: path.join(home, '.gemini', 'config', 'skills'),
    cursorRules: path.join(home, '.cursor', 'rules'),
  };
}

export function detectTools(): DetectedTools {
  const t = targetPaths();
  const home = os.homedir();
  return {
    claudeCode: fs.existsSync(t.claudeCommands),
    codex: fs.existsSync(t.codexSkills),
    reasonix: fs.existsSync(t.reasonixSkills),
    antigravity: fs.existsSync(path.join(home, '.gemini')),
    cursor: fs.existsSync(t.cursorRules),
  };
}

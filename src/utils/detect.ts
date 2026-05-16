import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface DetectedTools {
  claudeCode: boolean;
  codex: boolean;
  reasonix: boolean;
  antigravity: boolean;
}

export interface ToolTargetPaths {
  claudeCommands: string;   // ~/.claude/commands/
  codexSkills: string;      // ~/.codex/skills/
  reasonixSkills: string;   // ~/.reasonix/skills/
  antigravityAgents: string; // ~/.gemini/agents/
}

export function targetPaths(): ToolTargetPaths {
  const home = os.homedir();
  return {
    claudeCommands: path.join(home, '.claude', 'commands'),
    codexSkills: path.join(home, '.codex', 'skills'),
    reasonixSkills: path.join(home, '.reasonix', 'skills'),
    antigravityAgents: path.join(home, '.gemini', 'agents'),
  };
}

export function detectTools(): DetectedTools {
  const t = targetPaths();
  return {
    claudeCode: fs.existsSync(t.claudeCommands),
    codex: fs.existsSync(t.codexSkills),
    reasonix: fs.existsSync(t.reasonixSkills),
    antigravity: fs.existsSync(t.antigravityAgents),
  };
}

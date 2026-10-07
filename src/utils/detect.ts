import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface DetectedTools {
  claudeCode: boolean;
  codex: boolean;
  reasonix: boolean;
  antigravity: boolean;
  opencode: boolean;
}

export interface ToolTargetPaths {
  claudeCommands: string;    // ~/.claude/commands/
  codexSkills: string;       // ~/.codex/skills/
  reasonixSkills: string;    // ~/.reasonix/skills/
  reasonixConfig: string;    // ~/.reasonix/config.json
  antigravitySkills: string; // ~/.gemini/config/skills/
  opencodeConfigDir: string; // ~/.config/opencode/
  opencodeCommands: string;  // ~/.config/opencode/commands/
  opencodePlugins: string;   // ~/.config/opencode/plugins/
}

export function targetPaths(): ToolTargetPaths {
  const home = os.homedir();
  // opencode: XDG_CONFIG_HOME is deliberately ignored (F16 O-9) — the verified
  // layout on every platform is ~/.config/opencode.
  const opencodeConfigDir = path.join(home, '.config', 'opencode');
  return {
    claudeCommands: path.join(home, '.claude', 'commands'),
    codexSkills: path.join(home, '.codex', 'skills'),
    reasonixSkills: path.join(home, '.reasonix', 'skills'),
    reasonixConfig: path.join(home, '.reasonix', 'config.json'),
    antigravitySkills: path.join(home, '.gemini', 'config', 'skills'),
    opencodeConfigDir,
    opencodeCommands: path.join(opencodeConfigDir, 'commands'),
    opencodePlugins: path.join(opencodeConfigDir, 'plugins'),
  };
}

export function detectTools(): DetectedTools {
  const t = targetPaths();
  const home = os.homedir();
  return {
    claudeCode: fs.existsSync(path.join(home, '.claude')),
    codex: fs.existsSync(t.codexSkills),
    reasonix: fs.existsSync(path.join(home, '.reasonix')),
    antigravity: fs.existsSync(path.join(home, '.gemini')),
    opencode: fs.existsSync(t.opencodeConfigDir),
  };
}

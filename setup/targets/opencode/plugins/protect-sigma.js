// sigma-managed: protect-sigma
//
// Sigma protection plugin for opencode. Deployed to ~/.config/opencode/plugins/
// by `sigma setup install|update`; removed by `sigma setup uninstall`.
//
// Blocks direct edits to Sigma/progress.json and Sigma/progress-v<N>.json, which
// are CLI-managed. Parity with the Claude Code hook (setup/targets/hooks/protect-sigma.js):
// file-edit tools only, `bash` is not inspected.
//
// opencode file tools: `edit`/`write` take `filePath`; `apply_patch` takes
// `patchText` whose headers name the touched files (`*** Add|Update|Delete File:`,
// `*** Move to:`). Unrecognised tools or argument shapes never throw (fail-open).
//
// Keep this file's only export a plugin function: opencode treats every export as a plugin.

const PROTECTED_PATH = /Sigma[\/\\]progress(-v\d+)?\.json$/;
const FILE_TOOL = /^(edit|write|multiedit)$/i;
const PATCH_TOOL = /^(apply_patch|patch)$/i;
const PATH_KEYS = ['filePath', 'path', 'file_path'];
const PATCH_HEADER = /^\*\*\* (?:Add File|Update File|Delete File|Move to):\s*(.+?)\s*$/;

function isProtected(candidate) {
  return typeof candidate === 'string' && PROTECTED_PATH.test(candidate.trim());
}

function patchPaths(patchText) {
  if (typeof patchText !== 'string') return [];
  const found = [];
  for (const line of patchText.split(/\r?\n/)) {
    const match = PATCH_HEADER.exec(line);
    if (match) found.push(match[1]);
  }
  return found;
}

export const SigmaProtect = async () => ({
  'tool.execute.before': async (input, output) => {
    const tool = String((input && input.tool) || '');
    const args = output && output.args;
    if (!args || typeof args !== 'object') return;

    let blocked = false;
    if (FILE_TOOL.test(tool)) {
      blocked = PATH_KEYS.some((key) => isProtected(args[key]));
    } else if (PATCH_TOOL.test(tool)) {
      blocked = patchPaths(args.patchText).some(isProtected);
    }

    if (blocked) {
      throw new Error(
        'Sigma progress-v<N>.json is CLI-managed. Use sigma commands (sigma intent ratify, sigma plan approve, etc.) instead of direct edits.',
      );
    }
  },
});

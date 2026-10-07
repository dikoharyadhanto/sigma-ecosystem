import fs from 'fs-extra';
import { MessageEntry, readIndex, writeIndex, selectSurplusRead, updateMessageStatus } from '../engine/mailbox';
import { assertMailboxMutable, assertMailboxPath, MailboxScope, matchesMailboxScope, retentionScope, entryContext } from '../engine/mailboxContext';
import { readProjectConfig, resolveAutoOutdateKeep } from '../engine/projectConfig';
import { MessagingRole } from '../config';

export function readMailboxEntry(root: string, id: string, memo: boolean): { entry: MessageEntry; content: string; outdated: number } {
  const index = readIndex(root);
  assertMailboxMutable(root, index);
  const entry = index.messages.find(m => m.id === id);
  if (!entry) throw new Error(`${memo ? 'Memo' : 'Message'} not found: ${id}`);
  if ((entry.type === 'MEMO') !== memo) throw new Error(`${id} is not a ${memo ? 'memo' : 'cross-role message'}. Use: sigma ${memo ? 'inbox' : 'memo'} read ${id}`);
  const content = fs.readFileSync(assertMailboxPath(root, entry.file, true), 'utf8');
  let dirty = false;
  if (entry.status === 'UNREAD') { updateMessageStatus(index, id, 'READ'); dirty = true; }
  const keep = resolveAutoOutdateKeep(readProjectConfig(root));
  const surplus = keep > 0 ? selectSurplusRead(index, entry.to, keep, retentionScope(entry), memo).filter(m => m.id !== id) : [];
  for (const m of surplus) updateMessageStatus(index, m.id, 'OUTDATED');
  if (dirty || surplus.length) writeIndex(root, index);
  return { entry, content, outdated: surplus.length };
}

export function clearMailbox(root: string, roles: MessagingRole[], keep: number, scope: MailboxScope, memo: boolean, dryRun: boolean): MessageEntry[] {
  const index = readIndex(root);
  if (!dryRun) assertMailboxMutable(root, index);
  const groups = new Map<string, { role: MessagingRole; scope: MailboxScope }>();
  for (const e of index.messages) {
    if (!roles.includes(e.to as MessagingRole) || (e.type === 'MEMO') !== memo || !matchesMailboxScope(e, scope)) continue;
    const c = entryContext(e);
    groups.set(`${e.to}:${c.intent_version ?? c.context}`, { role: e.to as MessagingRole, scope: retentionScope(e) });
  }
  const surplus: MessageEntry[] = [];
  const selected = { ...index, messages: index.messages.filter(e => matchesMailboxScope(e, scope)) };
  for (const group of groups.values()) surplus.push(...selectSurplusRead(selected, group.role, keep, group.scope, memo));
  if (!dryRun && surplus.length) {
    for (const e of surplus) updateMessageStatus(index, e.id, 'OUTDATED');
    writeIndex(root, index);
  }
  return surplus;
}

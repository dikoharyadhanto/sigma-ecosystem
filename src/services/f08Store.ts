// F08 internal records. These records grant no governance approval.
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { assertNoTransactionSymlink, journaledWrite } from '../engine/controlStore';
import { readProjectIdentity } from '../engine/chain';
export const F08_STORE = 'Sigma/logs/f08.json';
export const digest = (value: string | Buffer) => 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
export interface TargetRef { chain: string; type: 'intent' | 'plan' | 'exec' | 'roadmap' | 'close'; version: string; path: string; sha256: string; }
export interface CapturedFile extends TargetRef { content: string; }
export interface AuditPack {
  id: string; project_id: string; created_at: string; state_revision: string; target: TargetRef;
  files: CapturedFile[]; missing: string[]; evidence: { description: string; path: string; recorded_sha256: string }[];
  evidence_snapshots: { path: string; sha256: string; content: string }[];
  review: unknown; manifest_sha256: string;
}
export interface AuditResponse {
  id: string; pack_id: string; pack_sha256: string; raw: string; sha256: string; origin: string; recorded_by: string; created_at: string;
}
export interface Question {
  id: string; target: TargetRef; question: string; created_by: string; created_at: string;
  answer?: string; resolved_at?: string; resolved_by?: string; resolution_sha256?: string;
}
export interface Assessment {
  id: string; target: TargetRef; source_sha256: string; status: 'READY' | 'SCOPE_GAP' | 'PENDING_ALIGNMENT' | 'UNKNOWN';
  reason: string; recorded_by: 'FMN'; created_at: string;
}
export interface CloneRecord { target: TargetRef; source: TargetRef; created_at: string; diff: string; reset_sections: string[]; }
export interface F08Store {
  format: 1; project_id: string; packs: AuditPack[]; responses: AuditResponse[];
  questions: Question[]; assessments: Assessment[]; clones: CloneRecord[];
}
export function f08StorePath(root: string): string {
  const file = path.join(root, F08_STORE); assertNoTransactionSymlink(root, file); return file;
}
export function readF08Store(root: string): F08Store {
  const file = f08StorePath(root), projectId = readProjectIdentity(root).project_id;
  if (!fs.existsSync(file)) return { format: 1, project_id: projectId, packs: [], responses: [], questions: [], assessments: [], clones: [] };
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.size > 16 * 1024 * 1024) throw new Error('F08 store is not a regular file or exceeds 16 MiB.');
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as F08Store;
  if (data.format !== 1 || data.project_id !== projectId ||
      ![data.packs, data.responses, data.questions, data.assessments, data.clones].every(Array.isArray))
    throw new Error('Invalid F08 store identity/format; refusing to overwrite.');
  return data;
}
export function writeF08Store(root: string, data: F08Store): void {
  const body = JSON.stringify(data, null, 2) + '\n';
  if (Buffer.byteLength(body) > 16 * 1024 * 1024) throw new Error('F08 store exceeds 16 MiB; archive explicitly before adding records.');
  journaledWrite(root, f08StorePath(root), body);
}

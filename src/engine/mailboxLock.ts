import path from 'path';
import { acquireProjectLock, ProjectLockHandle } from './controlStore';

const leases = new Map<string, ProjectLockHandle>();

// CLI mailbox mutations recheck ownership immediately before writes. MCP
// archive already runs inside its own bounded, journaled control wrapper.
export function assertMailboxLease(root: string): void {
  leases.get(path.resolve(root))?.assertOwned();
}

export async function withMailboxLock<T>(root: string, fn: () => T | Promise<T>): Promise<T> {
  const lock = await acquireProjectLock(root);
  const key = path.resolve(root);
  try {
    lock.assertOwned(); leases.set(key, lock);
    const result = await fn(); lock.assertOwned(); return result;
  } finally { leases.delete(key); await lock.release(); }
}

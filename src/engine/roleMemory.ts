import fs from 'fs-extra';
import path from 'path';

export const ROLE_MEMORY_ROLES = ['ARC', 'FMN', 'DEV', 'AUD'] as const;
export type RoleMemoryRole = typeof ROLE_MEMORY_ROLES[number];

export interface RoleMemory {
  schema_version: string;
  role: RoleMemoryRole;
  source_rule: string;
  source_rule_version: string;
  memory_updated_at: string;
  authority: string;
  general: string[];
  role_specific: string[];
}

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLED_ROLE_MEMORY_DIR = path.join(PACKAGE_ROOT, 'Sigma', 'role-memory');

export function getBundledRoleMemoryDir(): string {
  return BUNDLED_ROLE_MEMORY_DIR;
}

export function getRoleMemoryFilename(role: RoleMemoryRole): string {
  return `${role.toLowerCase()}-memory.json`;
}

export function getLocalRoleMemoryPath(projectRoot: string, role: RoleMemoryRole): string {
  return path.join(projectRoot, 'Sigma', 'role-memory', getRoleMemoryFilename(role));
}

export function getBundledRoleMemoryPath(role: RoleMemoryRole): string {
  return path.join(BUNDLED_ROLE_MEMORY_DIR, getRoleMemoryFilename(role));
}

export function loadRoleMemory(role: RoleMemoryRole, projectRoot?: string): { memory: RoleMemory; sourcePath: string } {
  const candidates = [
    projectRoot ? getLocalRoleMemoryPath(projectRoot, role) : null,
    getBundledRoleMemoryPath(role),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;

    try {
      const memory = fs.readJsonSync(candidate) as RoleMemory;
      return { memory, sourcePath: candidate };
    } catch {
      throw new Error(`Failed to parse role memory file at ${candidate}`);
    }
  }

  throw new Error(
    `Role memory for ${role} not found. Expected local Sigma/role-memory/${getRoleMemoryFilename(role)} ` +
    `or bundled package memory at ${getBundledRoleMemoryPath(role)}.`
  );
}

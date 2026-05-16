import fs from 'fs-extra';
import path from 'path';
import { OPERATION_REGISTRY_FILE, DOCUMENT_REGISTRY_FILE } from '../config';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OperationConstraint {
  condition: string;
}

export interface OperationGating {
  pre_condition?: string;
  post_condition?: string;
}

export interface Operation {
  operation_id: string;
  domain?: string;
  action?: string;
  role?: string;
  level?: string;
  description?: string;
  constraints?: OperationConstraint[];
  gating?: OperationGating;
  error_messages?: Record<string, string>;
}

export interface OperationRegistry {
  schema_version: string;
  registry_id: string;
  total_operations: number;
  domains: string[];
  operations: Operation[];
}

export interface DocumentEntry {
  document_id: string;
  file: string;
  location: string;
  authority_tier: string;
  owner: string;
  description: string;
  mandatory_when: string[];
  tolerate_missing: boolean;
  missing_behavior?: string;
}

export interface DocumentRegistry {
  schema_version: string;
  total_documents: number;
  documents: DocumentEntry[];
}

// ── Loaders ──────────────────────────────────────────────────────────────────

export function loadOperationRegistry(projectRoot: string): OperationRegistry {
  const filePath = path.join(projectRoot, OPERATION_REGISTRY_FILE);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Operation registry not found at ${filePath}. Run: sigma project sync`);
  }

  try {
    return fs.readJsonSync(filePath) as OperationRegistry;
  } catch {
    throw new Error(`Failed to parse operation registry at ${filePath}`);
  }
}

export function loadDocumentRegistry(projectRoot: string): DocumentRegistry {
  const filePath = path.join(projectRoot, DOCUMENT_REGISTRY_FILE);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Document registry not found at ${filePath}. Run: sigma project sync`);
  }

  try {
    return fs.readJsonSync(filePath) as DocumentRegistry;
  } catch {
    throw new Error(`Failed to parse document registry at ${filePath}`);
  }
}

export function getOperation(registry: OperationRegistry, operationId: string): Operation | undefined {
  return registry.operations.find(op => op.operation_id === operationId);
}

export function getDocumentsForRole(registry: DocumentRegistry, role: string | null): DocumentEntry[] {
  const roleKey = role ? `session_bootstrap_${role.toLowerCase()}_role` : null;

  return registry.documents.filter(doc => {
    const when = doc.mandatory_when ?? [];
    if (when.includes('session_bootstrap')) return true;
    if (roleKey && when.includes(roleKey)) return true;
    return false;
  });
}

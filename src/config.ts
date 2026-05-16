import path from 'path';
import os from 'os';

export const SIGMA_VERSION = '0.5.0';
export const SCHEMA_VERSION = '1.0.0';

export const GLOBAL_SIGMA_DIR = path.join(os.homedir(), '.sigma');
export const GLOBAL_TEMPLATES_DIR = path.join(GLOBAL_SIGMA_DIR, 'templates');
export const GLOBAL_RULES_DIR = path.join(GLOBAL_SIGMA_DIR, 'rules');
export const GLOBAL_GOVERNANCE_DIR = path.join(GLOBAL_SIGMA_DIR, 'governance');
export const GLOBAL_BRIDGE_DIR = path.join(GLOBAL_SIGMA_DIR, 'bridge');
export const GLOBAL_PROJECTS_FILE = path.join(GLOBAL_SIGMA_DIR, 'projects.json');
export const GLOBAL_CONFIG_FILE = path.join(GLOBAL_SIGMA_DIR, 'sigma.config.json');
export const GLOBAL_MEMORY_FILE = path.join(GLOBAL_SIGMA_DIR, 'memory_sigma.jsonl');

export const PROJECT_SIGMA_DIR = 'Sigma';
export const PROGRESS_FILE = path.join(PROJECT_SIGMA_DIR, 'progress.json');
export const OPERATION_REGISTRY_FILE = path.join(PROJECT_SIGMA_DIR, 'SIGMA-OPERATION-REGISTRY.json');
export const DOCUMENT_REGISTRY_FILE = path.join(PROJECT_SIGMA_DIR, 'SIGMA-REGISTRY.json');
export const PROJECT_DECISIONS_FILE = path.join(PROJECT_SIGMA_DIR, 'memory', 'decisions.jsonl');

export const SUBFOLDERS = ['design', 'build', 'close', 'rules', 'logs', 'memory'];

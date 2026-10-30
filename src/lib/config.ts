import path from 'node:path';
import type { ModelProvider } from '@/lib/types';

export const DATA_DIR = path.resolve(process.cwd(), process.env.DEVPILOT_DATA_DIR || '.devpilot-data');
export const REPOSITORIES_DIR = path.join(DATA_DIR, 'repositories');
export const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
export const DB_PATH = path.join(DATA_DIR, 'devpilot.sqlite');
export const MAX_REPOSITORY_BYTES = Number(process.env.DEVPILOT_MAX_REPOSITORY_BYTES || 100 * 1024 * 1024);
export const MAX_FILES = Number(process.env.DEVPILOT_MAX_FILES || 10_000);
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_MISSION_ITERATIONS = 5;

export function getModelProvider(): ModelProvider {
  const requested = (process.env.DEVPILOT_MODEL_PROVIDER || 'mock').toLowerCase();
  if (requested === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
  if (requested === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
  return 'mock';
}

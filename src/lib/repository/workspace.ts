import fs from 'node:fs';
import path from 'node:path';
import { MAX_FILES, MAX_REPOSITORY_BYTES, REPOSITORIES_DIR, WORKSPACES_DIR } from '@/lib/config';
import { isSensitiveRepositoryPath } from '@/lib/security/path-guard';

const EXCLUDED = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.devpilot', '.devpilot-data', 'vendor', '__pycache__']);

export function assertManagedRepository(root: string): void {
  const resolved = path.resolve(root);
  const base = path.resolve(REPOSITORIES_DIR);
  if (!resolved.startsWith(`${base}${path.sep}`)) throw new Error('Repository root is not a DevPilot-managed upload.');
}

export function copyRepository(source: string, target: string): { fileCount: number; totalBytes: number } {
  assertManagedRepository(source);
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  let fileCount = 0;
  let totalBytes = 0;
  const walk = (from: string, to: string, depth: number, relative: string) => {
    if (depth > 14) return;
    const entries = fs.readdirSync(from, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (EXCLUDED.has(entry.name)) continue;
      if (entry.name === '.env' || entry.name.startsWith('.env.') || entry.name === '.npmrc' || entry.name === '.pypirc') continue;
      const src = path.join(from, entry.name);
      const dest = path.join(to, entry.name);
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (isSensitiveRepositoryPath(childRelative)) continue;
      if (entry.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true, mode: 0o700 });
        walk(src, dest, depth + 1, childRelative);
      } else if (entry.isFile()) {
        const stat = fs.statSync(src);
        fileCount++;
        totalBytes += stat.size;
        if (fileCount > MAX_FILES) throw new Error(`Repository exceeds ${MAX_FILES} files.`);
        if (totalBytes > MAX_REPOSITORY_BYTES) throw new Error('Repository exceeds configured byte limit.');
        if (stat.size > 10 * 1024 * 1024) continue;
        fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL);
        try { fs.chmodSync(dest, 0o600); } catch { /* Platform-specific permissions. */ }
      }
    }
  };
  walk(source, target, 0, '');
  return { fileCount, totalBytes };
}

export function createMissionWorkspace(repoPath: string, missionId: string): string {
  const target = path.join(WORKSPACES_DIR, missionId);
  fs.mkdirSync(WORKSPACES_DIR, { recursive: true, mode: 0o700 });
  if (fs.existsSync(target)) throw new Error('Mission workspace already exists.');
  copyRepository(repoPath, target);
  return target;
}

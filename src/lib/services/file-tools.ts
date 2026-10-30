import fs from 'node:fs';
import path from 'node:path';
import { MAX_FILE_BYTES } from '@/lib/config';
import { isSensitiveRepositoryPath, resolveInsideRoot, safeReadFile, safeWriteFile } from '@/lib/security/path-guard';

export function listRepositoryFiles(root: string, maxFiles = 180): string[] {
  const output: string[] = [];
  const ignored = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.devpilot', '.devpilot-data']);
  const walk = (dir: string, rel: string, depth: number) => {
    if (depth > 12 || output.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) walk(path.join(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name, depth + 1);
      } else if (entry.isFile()) {
        const relative = rel ? `${rel}/${entry.name}` : entry.name;
        try { if (fs.statSync(path.join(dir, entry.name)).size < MAX_FILE_BYTES && !isSensitiveRepositoryPath(relative)) output.push(relative); } catch { /* Skip files that disappeared. */ }
      }
      if (output.length >= maxFiles) break;
    }
  };
  walk(root, '', 0);
  return output;
}

export function readRepositoryFile(root: string, relativePath: string): string {
  return safeReadFile(root, relativePath, MAX_FILE_BYTES);
}

export function writeRepositoryFile(root: string, relativePath: string, content: string): void {
  // Make it impossible to update lockfiles, environment files, or tool-managed state.
  const normalized = relativePath.replace(/\\/g, '/');
  if (/^(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|\.gitignore|tsconfig\.json|next\.config\.[^/]+|postcss\.config\.[^/]+|tailwind\.config\.[^/]+)$/i.test(normalized) || /(^|\/)\.env(\.|$)/i.test(normalized) || normalized.startsWith('.github/') || /\.(sh|bash|ps1|bat|cmd)$/i.test(normalized)) {
    throw new Error('This path is protected from autonomous edits.');
  }
  const target = resolveInsideRoot(root, normalized);
  safeWriteFile(root, normalized, content);
  if (!fs.existsSync(target)) throw new Error('Write failed.');
}

import fs from 'node:fs';
import path from 'node:path';
import type { RepositoryAnalysis } from '@/lib/types';
import { isSensitiveRepositoryPath } from '@/lib/security/path-guard';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.devpilot', '.devpilot-data', 'vendor', '__pycache__']);
const SKIP_FILES = new Set(['.env', '.env.local', '.env.production', '.npmrc', '.pypirc']);
const EXTENSION_LANGUAGES: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.java': 'Java', '.kt': 'Kotlin', '.php': 'PHP', '.rb': 'Ruby', '.cs': 'C#', '.vue': 'Vue', '.svelte': 'Svelte', '.css': 'CSS', '.scss': 'SCSS'
};

export function scanRepository(root: string, repoId: string, name: string): RepositoryAnalysis {
  const files: string[] = [];
  const riskAreas: RepositoryAnalysis['riskAreas'] = [];
  let totalBytes = 0;
  const maxFiles = Number(process.env.DEVPILOT_MAX_FILES || 10_000);
  const maxDepth = 14;
  const visit = (dir: string, rel: string, depth: number) => {
    if (depth > maxDepth || files.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (entry.isSymbolicLink()) continue;
      const relative = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) visit(path.join(dir, entry.name), relative, depth + 1);
        continue;
      }
      if (!entry.isFile() || SKIP_FILES.has(entry.name) || entry.name.startsWith('.env.') || isSensitiveRepositoryPath(relative)) continue;
      try {
        const stat = fs.statSync(path.join(dir, entry.name));
        totalBytes += stat.size;
        files.push(relative);
        const lower = relative.toLowerCase();
        if (/\b(auth|oauth|session|permission|middleware|security)\b/.test(lower)) riskAreas.push({ path: relative, reason: 'Authentication, session, or permission-sensitive code', severity: 'high' });
        if (/\b(api|route|controller|endpoint|handler)\b/.test(lower)) riskAreas.push({ path: relative, reason: 'Server/API boundary; validate inputs and authorization', severity: 'medium' });
        if (/\.(env|pem|key|cert)$/i.test(entry.name)) riskAreas.push({ path: relative, reason: 'Potential secret or private-key material', severity: 'high' });
      } catch { /* Ignore files that race with scanning. */ }
    }
  };
  visit(root, '', 0);

  const has = (pattern: RegExp) => files.some((file) => pattern.test(file));
  const readPackage = () => {
    try { return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); } catch { return null; }
  };
  const pkg = readPackage();
  let framework = 'Unknown / multi-language';
  if (pkg?.dependencies?.next || pkg?.devDependencies?.next) framework = 'Next.js';
  else if (pkg?.dependencies?.react || pkg?.devDependencies?.react) framework = 'React';
  else if (pkg?.dependencies?.vue || pkg?.devDependencies?.vue) framework = 'Vue';
  else if (pkg?.dependencies?.express || pkg?.devDependencies?.express) framework = 'Node.js / Express';
  else if (pkg?.dependencies?.fastify || pkg?.devDependencies?.fastify) framework = 'Node.js / Fastify';
  else if (has(/(^|\/)manage\.py$/)) framework = 'Django';
  else if (has(/(^|\/)Cargo\.toml$/i)) framework = 'Rust';
  else if (has(/(^|\/)go\.mod$/i)) framework = 'Go';
  else if (has(/(^|\/)pom\.xml$/i)) framework = 'Java / Maven';
  else if (has(/(^|\/)\.sln$/i)) framework = '.NET';

  const packageManager = has(/^pnpm-lock\.yaml$/) ? 'pnpm' : has(/^yarn\.lock$/) ? 'yarn' : has(/^bun\.lockb?$/) ? 'bun' : pkg ? 'npm' : has(/^poetry\.lock$/) ? 'poetry' : has(/^requirements\.txt$/) ? 'pip' : has(/^Cargo\.lock$/) ? 'cargo' : 'unknown';
  const languageSet = new Set<string>();
  for (const file of files) {
    const language = EXTENSION_LANGUAGES[path.extname(file).toLowerCase()];
    if (language) languageSet.add(language);
  }
  const importantFiles = files.filter((file) => /(^|\/)(package\.json|tsconfig\.json|next\.config\.[^/]+|vite\.config\.[^/]+|README\.md|AGENTS\.md|CONTRIBUTING\.md|jest\.config\.[^/]+|vitest\.config\.[^/]+|pyproject\.toml|requirements\.txt|go\.mod|Cargo\.toml)$/i.test(file)).slice(0, 30);
  const testFiles = files.filter((file) => /(^|\/)(__tests__|tests?|specs?)(\/|\.)|\.(test|spec)\.[cm]?[jt]sx?$/i.test(file)).slice(0, 100);
  const entryPoints = files.filter((file) => /(^|\/)(src\/)?(app|pages)\/(page|layout|route)\.[jt]sx?$|(^|\/)(index|main|server)\.[jt]sx?$|(^|\/)main\.py$/i.test(file)).slice(0, 50);
  const uniqueRisks = [...new Map(riskAreas.map((r) => [`${r.path}:${r.reason}`, r])).values()].slice(0, 40);

  return {
    repoId, name, fileCount: files.length, totalBytes, framework, language: [...languageSet].sort(), packageManager,
    entryPoints, testFiles, importantFiles, riskAreas: uniqueRisks, fileTree: files.slice(0, 250), analyzedAt: new Date().toISOString()
  };
}

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { MAX_FILES, MAX_REPOSITORY_BYTES, REPOSITORIES_DIR } from '@/lib/config';
import { saveRepository } from '@/lib/db/database';
import { isSensitiveRepositoryPath, normalizeRelativePath } from '@/lib/security/path-guard';
import { scanRepository } from '@/lib/repository/scan';
import type { RepositoryRecord } from '@/lib/types';
import { safeError } from '@/lib/api/public';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  let rootPath: string | undefined;
  try {
    const form = await request.formData();
    const fileItems = form.getAll('files').filter((item): item is File => item instanceof File);
    const rawPaths = form.getAll('paths').filter((item): item is string => typeof item === 'string');
    if (!fileItems.length || fileItems.length !== rawPaths.length) return NextResponse.json({ error: 'Upload a repository folder with at least one file.' }, { status: 400 });
    if (fileItems.length > MAX_FILES * 5) return NextResponse.json({ error: 'Upload contains too many individual file entries.' }, { status: 413 });

    // Validate traversal before filtering ignored directories so unsafe paths can never be normalized into safe paths.
    const prepared = rawPaths.map((raw) => {
      const value = raw.replace(/\\/g, '/');
      if (!value || value.includes('\0') || value.startsWith('/') || /^[a-zA-Z]:/.test(value)) throw new Error('Upload path must be repository-relative.');
      const parts = value.split('/');
      if (parts.some((part) => part === '..' || part === '.' || part === '')) throw new Error('Upload path traversal is not allowed.');
      return value;
    });
    const firstSegments = prepared.map((name) => name.split('/')[0]);
    const commonRoot = firstSegments.length && firstSegments.every((name) => name === firstSegments[0]) && prepared.every((name) => name.includes('/')) ? firstSegments[0] : '';
    const ignoredDirectories = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.devpilot', '.devpilot-data', 'vendor', '__pycache__', 'secrets']);
    const eligible = prepared.map((name, index) => ({ index, relative: commonRoot ? name.slice(commonRoot.length + 1) : name })).filter(({ relative }) => {
      const parts = relative.split('/');
      const filename = parts[parts.length - 1].toLowerCase();
      return Boolean(relative) && !parts.some((part) => ignoredDirectories.has(part.toLowerCase()))
        && !isSensitiveRepositoryPath(relative) && filename !== '.env' && !filename.startsWith('.env.') && filename !== '.npmrc' && filename !== '.pypirc';
    }).map(({ index, relative }) => ({ index, relative: normalizeRelativePath(relative) }));
    if (!eligible.length) return NextResponse.json({ error: 'No safe repository files were found. Hidden secrets and generated folders are excluded.' }, { status: 400 });
    if (eligible.length > MAX_FILES) return NextResponse.json({ error: `Repository contains too many safe files (limit ${MAX_FILES}).` }, { status: 413 });
    const total = eligible.reduce((sum, item) => sum + fileItems[item.index].size, 0);
    if (total > MAX_REPOSITORY_BYTES) return NextResponse.json({ error: `Repository exceeds the ${Math.round(MAX_REPOSITORY_BYTES / 1024 / 1024)} MB upload limit.` }, { status: 413 });
    if (eligible.some(({ index }) => fileItems[index].size > 10 * 1024 * 1024)) return NextResponse.json({ error: 'Individual files may not exceed 10 MB.' }, { status: 413 });

    const id = randomUUID();
    fs.mkdirSync(REPOSITORIES_DIR, { recursive: true, mode: 0o700 });
    const uploadRoot = path.join(REPOSITORIES_DIR, id);
    rootPath = uploadRoot;
    fs.mkdirSync(uploadRoot, { recursive: true, mode: 0o700 });
    const seen = new Set<string>();
    for (const { index, relative } of eligible) {
      if (seen.has(relative)) throw new Error(`Duplicate repository path: ${relative}`);
      seen.add(relative);
      const target = path.resolve(uploadRoot, ...relative.split('/'));
      if (!target.startsWith(`${uploadRoot}${path.sep}`)) throw new Error('Upload path escaped repository root.');
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      const bytes = Buffer.from(await fileItems[index].arrayBuffer());
      fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
    }
    if (!seen.size) throw new Error('No safe repository files were found in the upload.');

    const name = (commonRoot || 'Uploaded Repository').replace(/[^a-zA-Z0-9._ -]/g, '').slice(0, 80) || 'Uploaded Repository';
    const analysis = scanRepository(uploadRoot, id, name);
    const repo: RepositoryRecord = { id, name, rootPath: uploadRoot, fileCount: analysis.fileCount, totalBytes: analysis.totalBytes, analysis, createdAt: new Date().toISOString() };
    saveRepository(repo);
    return NextResponse.json({ repository: { id, name, fileCount: analysis.fileCount, totalBytes: analysis.totalBytes, createdAt: repo.createdAt }, analysis });
  } catch (error) {
    if (rootPath && fs.existsSync(rootPath)) fs.rmSync(rootPath, { recursive: true, force: true });
    return NextResponse.json({ error: safeError(error) }, { status: 400 });
  }
}

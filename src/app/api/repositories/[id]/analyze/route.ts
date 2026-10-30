import { NextResponse } from 'next/server';
import { getRepository, saveRepository } from '@/lib/db/database';
import { scanRepository } from '@/lib/repository/scan';
import { assertManagedRepository } from '@/lib/repository/workspace';
import { isUuid } from '@/lib/security/path-guard';

export const runtime = 'nodejs';
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid repository id.' }, { status: 400 });
  const repo = getRepository(id);
  if (!repo) return NextResponse.json({ error: 'Repository not found.' }, { status: 404 });
  try {
    assertManagedRepository(repo.rootPath);
    const analysis = scanRepository(repo.rootPath, repo.id, repo.name);
    saveRepository({ ...repo, analysis, fileCount: analysis.fileCount, totalBytes: analysis.totalBytes });
    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Repository analysis failed.' }, { status: 400 });
  }
}

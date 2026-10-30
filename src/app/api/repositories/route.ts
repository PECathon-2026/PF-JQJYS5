import { NextResponse } from 'next/server';
import { listRepositories } from '@/lib/db/database';

export const runtime = 'nodejs';
export async function GET() {
  const repositories = listRepositories(25).map((repo) => ({ id: repo.id, name: repo.name, fileCount: repo.fileCount, totalBytes: repo.totalBytes, createdAt: repo.createdAt }));
  return NextResponse.json({ repositories });
}

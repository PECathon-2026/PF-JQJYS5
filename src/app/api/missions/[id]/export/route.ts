import archiver from 'archiver';
import fs from 'node:fs';
import { NextResponse } from 'next/server';
import { getMission } from '@/lib/db/database';
import { isUuid, resolveInsideRoot } from '@/lib/security/path-guard';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid mission id.' }, { status: 400 });
  const mission = getMission(id);
  if (!mission) return NextResponse.json({ error: 'Mission not found.' }, { status: 404 });
  if (mission.status !== 'completed' || !mission.approvedAt) return NextResponse.json({ error: 'Approve the mission before exporting changes.' }, { status: 409 });
  if (!mission.filesChanged.length) return NextResponse.json({ error: 'No changed files are available to export.' }, { status: 409 });

  try {
    const archive = archiver('zip', { zlib: { level: 8 } });
    const chunks: Buffer[] = [];
    const output = new Promise<Buffer>((resolve, reject) => {
      archive.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
    });
    for (const change of mission.filesChanged) {
      const filePath = resolveInsideRoot(mission.workspacePath, change.path);
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;
      archive.file(filePath, { name: change.path });
    }
    await archive.finalize();
    const buffer = await output;
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="devpilot-${id}-changes.zip"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Export failed.' }, { status: 400 });
  }
}

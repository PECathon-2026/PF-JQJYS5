import { NextResponse } from 'next/server';
import { getMission } from '@/lib/db/database';
import { publicMission } from '@/lib/api/public';
import { isUuid } from '@/lib/security/path-guard';

export const runtime = 'nodejs';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid mission id.' }, { status: 400 });
  const mission = getMission(id);
  if (!mission) return NextResponse.json({ error: 'Mission not found.' }, { status: 404 });
  return NextResponse.json({ mission: publicMission(mission) });
}

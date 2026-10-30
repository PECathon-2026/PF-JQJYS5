import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMission, saveMission } from '@/lib/db/database';
import { isUuid } from '@/lib/security/path-guard';
import { publicMission } from '@/lib/api/public';

export const runtime = 'nodejs';
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid mission id.' }, { status: 400 });
  const mission = getMission(id);
  if (!mission) return NextResponse.json({ error: 'Mission not found.' }, { status: 404 });
  if (mission.status !== 'awaiting_approval') return NextResponse.json({ error: `Mission cannot be approved from status '${mission.status}'.` }, { status: 409 });
  if (!mission.filesChanged.length) return NextResponse.json({ error: 'There are no changed files to approve.' }, { status: 409 });
  if (mission.memory.securityResults.status === 'failed' || mission.memory.reviews.status === 'failed' || mission.memory.testResults.status === 'failed') {
    return NextResponse.json({ error: 'A blocking test, review, or security result prevents approval.' }, { status: 409 });
  }
  const now = new Date().toISOString();
  const approvalEvent = {
    id: randomUUID(), timestamp: now, agent: 'Human Approval Gate', action: 'approval.granted',
    message: 'Human approved the reviewed changes for export. No code was deployed to the original machine.', level: 'success' as const
  };
  const approved = {
    ...mission, status: 'completed' as const, approvedAt: now, updatedAt: now,
    memory: { ...mission.memory, status: 'completed' as const, findings: [...mission.memory.findings, approvalEvent], verifierSummary: `${mission.memory.verifierSummary} Human approval granted.` }
  };
  saveMission(approved);
  return NextResponse.json({ mission: publicMission(approved) });
}

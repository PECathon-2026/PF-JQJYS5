import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { listMissions, getRepository } from '@/lib/db/database';
import { runMission } from '@/lib/agents/workflow';
import { isUuid } from '@/lib/security/path-guard';
import { publicMission, safeError } from '@/lib/api/public';
import type { AgentEvent, MissionStreamPayload } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET() {
  const missions = listMissions(30).map((mission) => ({
    id: mission.id, repoId: mission.repoId, repoName: mission.repoName, request: mission.request, status: mission.status,
    createdAt: mission.createdAt, updatedAt: mission.updatedAt, approvedAt: mission.approvedAt,
    filesChanged: mission.filesChanged.map(({ path, addedLines, removedLines }) => ({ path, addedLines, removedLines }))
  }));
  const analytics = await import('@/lib/db/database').then((db) => db.getAnalytics());
  return NextResponse.json({ missions, analytics });
}

export async function POST(request: Request) {
  let input: { repoId?: string; request?: string };
  try { input = await request.json(); } catch { return NextResponse.json({ error: 'Expected a JSON request body.' }, { status: 400 }); }
  if (!input.repoId || !isUuid(input.repoId)) return NextResponse.json({ error: 'Choose a repository before launching a mission.' }, { status: 400 });
  if (typeof input.request !== 'string' || input.request.trim().length < 8 || input.request.trim().length > 4000) {
    return NextResponse.json({ error: 'Software change request must be between 8 and 4,000 characters.' }, { status: 400 });
  }
  const repo = getRepository(input.repoId);
  if (!repo) return NextResponse.json({ error: 'Repository not found. Upload it again.' }, { status: 404 });
  if (!repo.analysis) return NextResponse.json({ error: 'Analyze the repository before launching a mission.' }, { status: 409 });

  const missionId = randomUUID();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (payload: MissionStreamPayload) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`)); } catch { closed = true; }
      };
      const emit = (event: AgentEvent) => send({ type: 'event', event });
      void (async () => {
        try {
          const mission = await runMission({ missionId, repoId: input.repoId!, request: input.request!.trim(), emit });
          send({ type: 'result', mission: publicMission(mission) });
        } catch (error) {
          send({ type: 'error', error: safeError(error) });
        } finally {
          if (!closed) { try { controller.close(); } catch { /* Stream already closed by client. */ } }
          closed = true;
        }
      })();
    },
    cancel() { /* The workflow is persisted; a disconnected view does not cancel it. */ }
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Content-Type-Options': 'nosniff' }
  });
}

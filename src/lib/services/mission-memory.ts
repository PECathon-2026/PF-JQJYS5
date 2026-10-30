import type { AgentEvent, MissionMemory, MissionStatus, ReviewResult, SecurityResult, TestResult } from '@/lib/types';

export function emptyTestResult(): TestResult {
  return { status: 'pending', summary: 'Tests have not run.', checks: [], durationMs: 0 };
}

export function emptyReviewResult(): ReviewResult {
  return { status: 'pending', summary: 'Review has not run.', issues: [] };
}

export function emptySecurityResult(): SecurityResult {
  return { status: 'pending', summary: 'Security scan has not run.', findings: [] };
}

export function createInitialMissionMemory(request: string, maxIterations: number): MissionMemory {
  return {
    request,
    objectives: [],
    criteria: [],
    tasks: [],
    completedTasks: [],
    findings: [],
    reviews: emptyReviewResult(),
    testResults: emptyTestResult(),
    securityResults: emptySecurityResult(),
    status: 'queued',
    currentIteration: 0,
    maxIterations,
    verifierSummary: 'Verification has not run.'
  };
}

export function appendMissionFinding(
  memory: MissionMemory,
  event: AgentEvent,
  status: MissionStatus = memory.status,
  iteration?: number
): MissionMemory {
  return {
    ...memory,
    status,
    findings: [...memory.findings, event],
    currentIteration: iteration ?? memory.currentIteration
  };
}

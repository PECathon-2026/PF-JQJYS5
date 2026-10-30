import type { MissionRecord } from '@/lib/types';

export function publicMission(mission: MissionRecord) {
  const { workspacePath: _workspacePath, ...safe } = mission;
  return safe;
}

export function safeError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message || 'Request failed.';
    return message.length > 500 ? `${message.slice(0, 497)}...` : message;
  }
  return 'Request failed.';
}

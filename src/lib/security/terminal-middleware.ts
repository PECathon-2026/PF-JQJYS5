import { validateTerminalCommand } from '@/lib/security/path-guard';

/**
 * Last application-level gate before a process is spawned.
 * This is defense in depth, not an OS sandbox; untrusted test scripts must only
 * execute inside a separate network-disabled container/VM.
 */
export function assertAllowedTerminalCommand(command: string[]): void {
  const validation = validateTerminalCommand(command);
  if (!validation.allowed) throw new Error(`Terminal command blocked: ${validation.reason}`);
}

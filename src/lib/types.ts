export type ModelProvider = 'openai' | 'gemini' | 'mock';

export type MissionStatus =
  | 'queued' | 'planning' | 'implementing' | 'testing' | 'reviewing'
  | 'verifying' | 'awaiting_approval' | 'completed' | 'blocked' | 'failed';

export type EventLevel = 'info' | 'success' | 'warning' | 'error';

export interface AgentEvent {
  id: string;
  timestamp: string;
  agent: string;
  action: string;
  message: string;
  level: EventLevel;
  iteration?: number;
}

export interface RepositoryAnalysis {
  repoId: string;
  name: string;
  fileCount: number;
  totalBytes: number;
  framework: string;
  language: string[];
  packageManager: string;
  entryPoints: string[];
  testFiles: string[];
  importantFiles: string[];
  riskAreas: { path: string; reason: string; severity: 'low' | 'medium' | 'high' }[];
  fileTree: string[];
  analyzedAt: string;
}

export interface TestResult {
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  summary: string;
  checks: { name: string; status: 'passed' | 'failed' | 'skipped' | 'warning'; detail: string }[];
  durationMs: number;
  command?: string;
}

export interface ReviewResult {
  status: 'pending' | 'passed' | 'failed' | 'warning';
  summary: string;
  issues: { severity: 'low' | 'medium' | 'high'; path?: string; message: string }[];
}

export interface SecurityResult {
  status: 'pending' | 'passed' | 'failed' | 'warning';
  summary: string;
  findings: { severity: 'low' | 'medium' | 'high' | 'critical'; path: string; rule: string; message: string }[];
}

export interface MissionMemory {
  request: string;
  objectives: string[];
  criteria: string[];
  tasks: { id: string; title: string; description: string; owner: string; status: 'pending' | 'in_progress' | 'completed' | 'blocked' }[];
  completedTasks: string[];
  findings: AgentEvent[];
  reviews: ReviewResult;
  testResults: TestResult;
  securityResults: SecurityResult;
  status: MissionStatus;
  currentIteration: number;
  maxIterations: number;
  verifierSummary: string;
}

export interface FileChange {
  path: string;
  originalContent: string | null;
  newContent: string;
  addedLines: number;
  removedLines: number;
}

export interface RepositoryRecord {
  id: string;
  name: string;
  rootPath: string;
  fileCount: number;
  totalBytes: number;
  analysis?: RepositoryAnalysis;
  createdAt: string;
}

export interface MissionRecord {
  id: string;
  repoId: string;
  repoName: string;
  request: string;
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  workspacePath: string;
  filesChanged: FileChange[];
  memory: MissionMemory;
  analysis: RepositoryAnalysis;
  provider: ModelProvider;
}

export interface MissionEventPayload {
  type: 'event';
  event: AgentEvent;
}
export interface MissionResultPayload {
  type: 'result';
  mission: Omit<MissionRecord, 'workspacePath'>;
}
export interface MissionErrorPayload {
  type: 'error';
  error: string;
}
export type MissionStreamPayload = MissionEventPayload | MissionResultPayload | MissionErrorPayload;

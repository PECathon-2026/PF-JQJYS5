import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DATA_DIR, DB_PATH } from '@/lib/config';
import type { MissionRecord, RepositoryRecord } from '@/lib/types';

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
let dbInstance: Database.Database | null = null;

function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS repositories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL,
        file_count INTEGER NOT NULL,
        total_bytes INTEGER NOT NULL,
        analysis_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        repo_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        FOREIGN KEY(repo_id) REFERENCES repositories(id)
      );
      CREATE INDEX IF NOT EXISTS idx_missions_created ON missions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_missions_repo ON missions(repo_id);
    `);
  }
  return dbInstance;
}

export function saveRepository(repo: RepositoryRecord): void {
  getDb().prepare(`INSERT INTO repositories (id, name, root_path, file_count, total_bytes, analysis_json, created_at)
    VALUES (@id, @name, @rootPath, @fileCount, @totalBytes, @analysis, @createdAt)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, root_path=excluded.root_path,
    file_count=excluded.file_count, total_bytes=excluded.total_bytes, analysis_json=excluded.analysis_json`)
    .run({ ...repo, rootPath: repo.rootPath, analysis: repo.analysis ? JSON.stringify(repo.analysis) : null });
}

export function getRepository(id: string): RepositoryRecord | null {
  const row = getDb().prepare('SELECT * FROM repositories WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    id: row.id, name: row.name, rootPath: row.root_path, fileCount: row.file_count,
    totalBytes: row.total_bytes, analysis: row.analysis_json ? JSON.parse(row.analysis_json) : undefined,
    createdAt: row.created_at
  };
}

export function listRepositories(limit = 20): RepositoryRecord[] {
  const rows = getDb().prepare('SELECT * FROM repositories ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
  return rows.map((row) => ({
    id: row.id, name: row.name, rootPath: row.root_path, fileCount: row.file_count,
    totalBytes: row.total_bytes, analysis: row.analysis_json ? JSON.parse(row.analysis_json) : undefined,
    createdAt: row.created_at
  }));
}

export function saveMission(mission: MissionRecord): void {
  getDb().prepare(`INSERT INTO missions (id, repo_id, status, created_at, updated_at, payload_json)
    VALUES (@id, @repoId, @status, @createdAt, @updatedAt, @payload)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at, payload_json=excluded.payload_json`)
    .run({ id: mission.id, repoId: mission.repoId, status: mission.status, createdAt: mission.createdAt,
      updatedAt: mission.updatedAt, payload: JSON.stringify(mission) });
}

export function getMission(id: string): MissionRecord | null {
  const row = getDb().prepare('SELECT payload_json FROM missions WHERE id = ?').get(id) as { payload_json: string } | undefined;
  return row ? JSON.parse(row.payload_json) as MissionRecord : null;
}

export function listMissions(limit = 30): MissionRecord[] {
  const rows = getDb().prepare('SELECT payload_json FROM missions ORDER BY created_at DESC LIMIT ?').all(limit) as { payload_json: string }[];
  return rows.map((row) => JSON.parse(row.payload_json) as MissionRecord);
}

export function getAnalytics() {
  const db = getDb();
  const missionCounts = db.prepare('SELECT status, COUNT(*) AS count FROM missions GROUP BY status').all() as { status: string; count: number }[];
  const repos = db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(file_count), 0) AS files FROM repositories').get() as { count: number; files: number };
  const missions = db.prepare('SELECT COUNT(*) AS count FROM missions').get() as { count: number };
  const completed = db.prepare("SELECT COUNT(*) AS count FROM missions WHERE status = 'completed'").get() as { count: number };
  return {
    repositories: repos.count,
    indexedFiles: repos.files,
    missions: missions.count,
    completed: completed.count,
    completionRate: missions.count ? Math.round((completed.count / missions.count) * 100) : 0,
    statuses: Object.fromEntries(missionCounts.map((row) => [row.status, row.count]))
  };
}

export function clearDbForTests(): void {
  const db = getDb();
  db.exec('DELETE FROM missions; DELETE FROM repositories;');
}

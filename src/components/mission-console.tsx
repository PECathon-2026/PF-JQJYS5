'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, Bot, Check, CheckCircle2, ChevronDown,
  CircleDot, Clock3, Code2, Download, FileCode2, FileSearch, FileText, FolderUp, GitBranch,
  Loader2, LockKeyhole, Play, RefreshCw, ShieldCheck, Sparkles, Terminal, Upload, Workflow, XCircle
} from 'lucide-react';
import type { AgentEvent, MissionRecord, RepositoryAnalysis, RepositoryRecord } from '@/lib/types';

type PublicMission = Omit<MissionRecord, 'workspacePath'>;
type MissionSummary = Pick<PublicMission, 'id' | 'repoId' | 'repoName' | 'request' | 'status' | 'createdAt' | 'updatedAt' | 'approvedAt'> & { filesChanged: { path: string; addedLines: number; removedLines: number }[] };
type RepoChoice = Pick<RepositoryRecord, 'id' | 'name' | 'fileCount' | 'totalBytes' | 'createdAt'>;
type Analytics = { repositories: number; indexedFiles: number; missions: number; completed: number; completionRate: number; statuses: Record<string, number> };

const AGENTS = [
  { name: 'Shogun Planner', role: 'Strategy & decomposition', color: 'text-amber-300', dot: 'bg-amber-300', icon: Workflow },
  { name: 'Samurai Developer', role: 'Implementation & edits', color: 'text-rose-400', dot: 'bg-rose-400', icon: Code2 },
  { name: 'Sentinel Tester', role: 'Syntax & test runner', color: 'text-sky-300', dot: 'bg-sky-300', icon: CheckCircle2 },
  { name: 'Shadow Reviewer', role: 'Quality & regression', color: 'text-violet-300', dot: 'bg-violet-300', icon: FileSearch },
  { name: 'Security Guardian', role: 'Static security analysis', color: 'text-emerald-300', dot: 'bg-emerald-300', icon: ShieldCheck },
  { name: 'Imperial Verifier', role: 'Evidence & acceptance', color: 'text-orange-300', dot: 'bg-orange-300', icon: LockKeyhole }
];

const statusStyles: Record<string, string> = {
  queued: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-300', planning: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  implementing: 'border-rose-400/25 bg-rose-400/10 text-rose-200', testing: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
  reviewing: 'border-violet-400/25 bg-violet-400/10 text-violet-200', verifying: 'border-orange-400/25 bg-orange-400/10 text-orange-200',
  awaiting_approval: 'border-amber-400/30 bg-amber-400/10 text-amber-200', completed: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  blocked: 'border-red-400/25 bg-red-400/10 text-red-200', failed: 'border-red-400/25 bg-red-400/10 text-red-200'
};

function prettyStatus(status: string) { return status.replaceAll('_', ' '); }
function formatBytes(bytes: number) { return bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`; }
function timeAgo(timestamp: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
}

function StatusPill({ status }: { status: string }) {
  const active = !['completed', 'blocked', 'failed'].includes(status);
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.11em] ${statusStyles[status] || statusStyles.queued}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'animate-pulse bg-current' : 'bg-current'}`} />{prettyStatus(status)}
  </span>;
}

function MetricCard({ label, value, hint, icon: Icon, tone }: { label: string; value: string | number; hint: string; icon: typeof Activity; tone: string }) {
  return <motion.div whileHover={{ y: -2 }} className="glass rounded-2xl p-4 sm:p-5">
    <div className="flex items-start justify-between"><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-zinc-500">{label}</div><span className={`rounded-xl border border-white/[.07] bg-white/[.035] p-2 ${tone}`}><Icon size={15} /></span></div>
    <div className="mt-4 text-2xl font-semibold tracking-tight text-white">{value}</div><div className="mt-1 text-[11px] text-zinc-500">{hint}</div>
  </motion.div>;
}

function ResultRow({ label, detail, status }: { label: string; detail: string; status: string }) {
  const color = status === 'passed' ? 'text-emerald-300' : status === 'failed' ? 'text-rose-300' : status === 'warning' || status === 'skipped' ? 'text-amber-200' : 'text-zinc-500';
  const Icon = status === 'passed' ? CheckCircle2 : status === 'failed' ? XCircle : status === 'warning' || status === 'skipped' ? AlertTriangle : CircleDot;
  return <div className="flex items-start gap-3 border-b border-white/[.05] py-3 last:border-0"><Icon size={15} className={`${color} mt-0.5 shrink-0`} /><div className="min-w-0 flex-1"><div className="text-xs text-zinc-200">{label}</div><p className="mt-1 break-words text-[11px] leading-relaxed text-zinc-500">{detail}</p></div><span className={`pt-0.5 text-[9px] uppercase tracking-wider ${color}`}>{status}</span></div>;
}

export function MissionConsole({ compact = false }: { compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [repoChoices, setRepoChoices] = useState<RepoChoice[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [repoName, setRepoName] = useState('');
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [requestText, setRequestText] = useState('Add a dark mode toggle to the dashboard and preserve the current theme choice.');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [mission, setMission] = useState<PublicMission | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [history, setHistory] = useState<MissionSummary[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'activity' | 'memory' | 'tools'>('activity');
  const [selectedHistoryId, setSelectedHistoryId] = useState('');

  useEffect(() => { inputRef.current?.setAttribute('webkitdirectory', ''); inputRef.current?.setAttribute('directory', ''); }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/missions', { cache: 'no-store' });
      if (!response.ok) return;
      const body = await response.json();
      setHistory(body.missions || []); setAnalytics(body.analytics || null);
    } catch { /* The console remains usable when history is temporarily unavailable. */ }
    try {
      const response = await fetch('/api/repositories', { cache: 'no-store' });
      if (response.ok) {
        const body = await response.json();
        setRepoChoices(body.repositories || []);
      }
    } catch { /* Optional prior repositories. */ }
  }, []);
  useEffect(() => { void refreshHistory(); }, [refreshHistory]);

  const chooseFiles = (files: FileList | null) => {
    const excludedDirs = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.devpilot', '.devpilot-data', 'vendor', '__pycache__', 'secrets']);
    const next = Array.from(files || []).filter((file) => {
      const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const parts = relative.replace(/\\/g, '/').split('/');
      const name = parts[parts.length - 1].toLowerCase();
      return !parts.some((part) => excludedDirs.has(part.toLowerCase())) && name !== '.env' && !name.startsWith('.env.') && name !== '.npmrc' && name !== '.pypirc';
    });
    setSelectedFiles(next); setAnalysis(null); setError('');
    if (files && files.length && !next.length) setError('This folder contains only generated, hidden, or secret files. Choose a source repository folder.');
    if (next.length) {
      const relative = (next[0] as File & { webkitRelativePath?: string }).webkitRelativePath || next[0].name;
      setRepoName(relative.includes('/') ? relative.split('/')[0] : 'Uploaded Repository');
      setSelectedRepoId('');
    }
  };

  const analyzeRepository = async () => {
    setError(''); setLoadingAnalysis(true);
    try {
      let repoId = selectedRepoId;
      if (selectedFiles.length) {
        const form = new FormData();
        selectedFiles.forEach((file) => {
          const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
          form.append('files', file, file.name);
          form.append('paths', relativePath);
        });
        const response = await fetch('/api/repositories/upload', { method: 'POST', body: form });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Repository upload failed.');
        repoId = body.repository.id;
        setSelectedRepoId(repoId); setRepoName(body.repository.name); setAnalysis(body.analysis);
        setRepoChoices((prev) => [body.repository, ...prev.filter((repo) => repo.id !== body.repository.id)]);
      } else if (repoId) {
        const response = await fetch(`/api/repositories/${repoId}/analyze`, { method: 'POST' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Repository analysis failed.');
        setAnalysis(body.analysis);
        setRepoName(body.analysis.name);
      } else {
        throw new Error('Select a repository folder first, or choose a previously uploaded repository.');
      }
      setSelectedFiles([]);
      await refreshHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Repository analysis failed.');
    } finally { setLoadingAnalysis(false); }
  };

  const launchMission = async () => {
    if (!selectedRepoId || !analysis || requestText.trim().length < 8) return;
    setError(''); setRunning(true); setEvents([]); setMission(null); setActiveTab('activity');
    try {
      const response = await fetch('/api/missions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repoId: selectedRepoId, request: requestText.trim() }) });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Could not launch mission.');
      }
      if (!response.body) throw new Error('Streaming is not available in this browser.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalSeen = false;
      const processLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const payload = JSON.parse(line);
          if (payload.type === 'event') setEvents((previous) => [...previous, payload.event].slice(-160));
          if (payload.type === 'result') { setMission(payload.mission); finalSeen = true; }
          if (payload.type === 'error') throw new Error(payload.error || 'Mission failed.');
        } catch (caught) {
          if (caught instanceof Error && caught.message !== 'Unexpected end of JSON input') throw caught;
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) processLine(line);
      }
      buffer += decoder.decode();
      if (buffer.trim()) processLine(buffer);
      if (!finalSeen) throw new Error('The mission stream ended before a final result was received. Check mission history for its saved status.');
      await refreshHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Mission execution failed.');
      await refreshHistory();
    } finally { setRunning(false); }
  };

  const approveMission = async () => {
    if (!mission) return;
    setError(''); setApproving(true);
    try {
      const response = await fetch(`/api/missions/${mission.id}/approve`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Approval failed.');
      setMission(body.mission);
      setEvents((prev) => [...prev, ...(body.mission.memory.findings || []).slice(-1)]);
      await refreshHistory();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Approval failed.'); }
    finally { setApproving(false); }
  };

  const selectHistory = async (id: string) => {
    setSelectedHistoryId(id); setError('');
    try {
      const response = await fetch(`/api/missions/${id}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load mission.');
      setMission(body.mission); setEvents(body.mission.memory.findings || []); setActiveTab('activity');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load mission.'); }
  };

  const toolEvents = useMemo(() => events.filter((event) => /file\.|tests\.|implementation|security\.|review\.|verification\./.test(event.action)), [events]);
  const agentStatuses = useMemo(() => {
    const latest = new Map<string, AgentEvent>();
    events.forEach((event) => latest.set(event.agent, event));
    return latest;
  }, [events]);

  return <div className="space-y-6">
    {!compact && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Missions executed" value={analytics?.missions ?? history.length} hint="Persistent local history" icon={Activity} tone="text-rose-300" />
      <MetricCard label="Repositories indexed" value={analytics?.repositories ?? repoChoices.length} hint={`${analytics?.indexedFiles ?? 0} files scanned`} icon={FileCode2} tone="text-violet-300" />
      <MetricCard label="Approval rate" value={`${analytics?.completionRate ?? 0}%`} hint="Human-approved missions" icon={CheckCircle2} tone="text-emerald-300" />
      <MetricCard label="Self-correction loop" value="5 passes" hint="Bounded retry budget" icon={RefreshCw} tone="text-amber-200" />
    </div>}

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(380px,.88fr)]">
      <section className="glass overflow-hidden rounded-3xl">
        <div className="flex items-start justify-between border-b border-white/[.07] px-5 py-5 sm:px-7">
          <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-rose-300"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Mission constructor</div><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Brief the guild.</h2><p className="mt-1 text-xs text-zinc-500">One request. Six agents. A verifiable change set.</p></div>
          <div className="hidden rounded-2xl border border-rose-400/20 bg-rose-400/[.06] p-3 text-rose-300 sm:block"><Sparkles size={19} /></div>
        </div>
        <div className="space-y-6 p-5 sm:p-7">
          <div>
            <div className="mb-2 flex items-center justify-between"><label className="text-xs font-medium text-zinc-300">01 / Target repository</label><span className="text-[10px] text-zinc-600">Local folder → managed workspace</span></div>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => chooseFiles(event.target.files)} />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <button type="button" onClick={() => inputRef.current?.click()} className={`group flex min-h-[84px] items-center gap-4 rounded-2xl border border-dashed px-4 text-left transition ${selectedFiles.length ? 'border-rose-400/40 bg-rose-400/[.055]' : 'border-white/[.13] bg-white/[.015] hover:border-rose-400/35 hover:bg-rose-400/[.025]'}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[.07] bg-white/[.035] text-rose-300"><FolderUp size={20} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-zinc-200">{selectedFiles.length ? repoName || 'Repository selected' : 'Upload a repository folder'}</span><span className="mt-1 block text-[11px] text-zinc-500">{selectedFiles.length ? `${selectedFiles.length} files selected · ${formatBytes(selectedFiles.reduce((sum, file) => sum + file.size, 0))}` : 'Folder upload · up to 100 MB · secrets excluded'}</span></span>
                <Upload size={16} className="shrink-0 text-zinc-600 transition group-hover:text-rose-300" />
              </button>
              <div className="flex min-w-[175px] flex-col justify-center gap-1.5"><span className="text-[10px] uppercase tracking-[.16em] text-zinc-600">Or select saved</span><div className="relative"><select value={selectedRepoId} onChange={(event) => { setSelectedRepoId(event.target.value); setAnalysis(null); setSelectedFiles([]); setRepoName(repoChoices.find((r) => r.id === event.target.value)?.name || ''); }} className="w-full appearance-none rounded-xl border border-white/[.1] bg-[#111114] px-3 py-3 pr-8 text-xs text-zinc-300 outline-none focus:border-rose-400/40"><option value="">Choose repository…</option>{repoChoices.map((repo) => <option key={repo.id} value={repo.id}>{repo.name}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600" /></div></div>
            </div>
            {analysis && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[.05] px-2.5 py-1.5 text-[10px] text-emerald-200"><Check size={12} /> Repository analyzed</span><span className="rounded-lg border border-white/[.07] bg-white/[.025] px-2.5 py-1.5 text-[10px] text-zinc-500">{analysis.framework}</span><span className="rounded-lg border border-white/[.07] bg-white/[.025] px-2.5 py-1.5 text-[10px] text-zinc-500">{analysis.fileCount} files</span></div>}
            <div className="mt-3 flex justify-end"><button type="button" onClick={analyzeRepository} disabled={loadingAnalysis || running || (!selectedFiles.length && !selectedRepoId)} className="inline-flex items-center gap-2 rounded-xl border border-white/[.1] bg-white/[.045] px-4 py-2.5 text-xs font-medium text-zinc-200 transition hover:border-rose-400/30 hover:bg-rose-400/[.06]">{loadingAnalysis ? <Loader2 size={14} className="animate-spin" /> : <FileSearch size={14} />}{loadingAnalysis ? 'Analyzing…' : 'Analyze repository'}<ArrowRight size={13} className="text-zinc-500" /></button></div>
          </div>

          <div className="h-px bg-white/[.06]" />
          <div>
            <div className="mb-2 flex items-center justify-between"><label htmlFor="mission-request" className="text-xs font-medium text-zinc-300">02 / Software change request</label><span className="text-[10px] text-zinc-600">Natural language</span></div>
            <textarea id="mission-request" value={requestText} onChange={(event) => setRequestText(event.target.value)} maxLength={4000} rows={4} placeholder="Describe the change, expected behavior, and constraints…" className="w-full resize-y rounded-2xl border border-white/[.09] bg-black/30 px-4 py-3.5 text-sm leading-relaxed text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-rose-400/35 focus:bg-black/40" />
            <div className="mt-2 flex items-center justify-between"><span className="text-[10px] text-zinc-600">Tip: mention acceptance criteria and any constraints.</span><span className="text-[10px] tabular-nums text-zinc-600">{requestText.length}/4000</span></div>
          </div>

          <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[.035] p-3.5"><div className="flex items-start gap-2.5"><LockKeyhole size={15} className="mt-0.5 shrink-0 text-amber-200" /><div><div className="text-[11px] font-medium text-amber-100">Safe execution mode</div><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Changes are staged in an isolated DevPilot workspace. Repository test commands are skipped unless explicitly enabled in a sandbox. Nothing is deployed automatically.</p></div></div></div>
          {error && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[.06] p-3 text-xs text-rose-200"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}</motion.div>}
          <button type="button" onClick={launchMission} disabled={!selectedRepoId || !analysis || requestText.trim().length < 8 || running || loadingAnalysis} className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-4 text-sm font-semibold text-white shadow-[0_8px_36px_rgba(225,29,72,.2)] transition hover:brightness-110 disabled:shadow-none">
            {running ? <Loader2 size={17} className="animate-spin" /> : <Play size={16} fill="currentColor" />}{running ? 'Guild is executing mission…' : 'Launch autonomous mission'}{!running && <ArrowRight size={16} className="transition group-hover:translate-x-1" />}
          </button>
        </div>
      </section>

      <section className="glass flex min-h-[650px] flex-col overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-5 sm:px-6"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-zinc-500"><span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-rose-400' : 'bg-emerald-400'}`} /> Guild telemetry</div><h2 className="mt-2 text-lg font-semibold text-white">Mission observability</h2></div>{mission && <StatusPill status={mission.status} />}</div>
        <div className="grid grid-cols-3 border-b border-white/[.06] p-1.5">
          {(['activity', 'memory', 'tools'] as const).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-xl px-3 py-2.5 text-[11px] font-medium capitalize transition ${activeTab === tab ? 'bg-white/[.07] text-white' : 'text-zinc-600 hover:text-zinc-300'}`}>{tab === 'activity' ? 'Activity log' : tab === 'memory' ? 'Shared memory' : 'Tools used'}</button>)}
        </div>
        <div className="min-h-[390px] flex-1 p-4 sm:p-5">
          <AnimatePresence mode="wait">
            {activeTab === 'activity' && <motion.div key="activity" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="space-y-2">
              {events.length === 0 && !running && <div className="flex min-h-[340px] flex-col items-center justify-center text-center"><div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/[.04] text-rose-300"><Bot size={25} /><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#111114] bg-emerald-400" /></div><div className="text-sm font-medium text-zinc-300">The guild awaits your command</div><p className="mt-2 max-w-[260px] text-[11px] leading-relaxed text-zinc-600">Launch a mission to watch agent handoffs, file edits, test feedback, and verification in real time.</p><div className="mt-6 flex items-center gap-2 text-[9px] uppercase tracking-[.17em] text-zinc-700"><span className="h-px w-8 bg-white/[.09]" />Awaiting mission<span className="h-px w-8 bg-white/[.09]" /></div></div>}
              {(events.length > 0 || running) && <div className="mb-3 flex items-center justify-between"><span className="text-[10px] uppercase tracking-[.15em] text-zinc-600">Message bus · {events.length} events</span><span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{running ? 'streaming' : 'saved'}</span></div>}
              <div className="scrollbar-thin max-h-[390px] space-y-2 overflow-y-auto pr-1">
                {events.map((event) => <div key={event.id} className="group flex gap-3 rounded-xl border border-white/[.045] bg-black/15 p-3 transition hover:border-white/[.09]">
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[.07] bg-white/[.03] ${event.level === 'success' ? 'text-emerald-300' : event.level === 'error' ? 'text-rose-300' : event.level === 'warning' ? 'text-amber-200' : 'text-zinc-400'}`}><Activity size={13} /></div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] font-medium text-zinc-300">{event.agent}</span><span className="font-mono text-[9px] tabular-nums text-zinc-700">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div><div className="mt-0.5 text-[9px] uppercase tracking-wider text-zinc-600">{event.action}{event.iteration ? ` · pass ${event.iteration}` : ''}</div><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{event.message}</p></div>
                </div>)}
                {running && <div className="flex items-center gap-2 rounded-xl border border-rose-400/15 bg-rose-400/[.035] px-3 py-3 text-[11px] text-rose-200"><Loader2 size={13} className="animate-spin" />Waiting for the next agent handoff…</div>}
              </div>
            </motion.div>}
            {activeTab === 'memory' && <motion.div key="memory" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="space-y-4">
              {!mission ? <div className="flex min-h-[320px] flex-col items-center justify-center text-center"><Workflow size={25} className="mb-3 text-violet-300" /><p className="text-xs text-zinc-400">MissionMemory has not been initialized.</p><p className="mt-1 text-[10px] text-zinc-600">Start a mission to populate shared state.</p></div> : <>
                <div className="rounded-xl border border-white/[.07] bg-black/20 p-3"><div className="text-[9px] uppercase tracking-[.17em] text-zinc-600">request</div><p className="mt-2 text-xs leading-relaxed text-zinc-300">{mission.memory.request}</p></div>
                <div><div className="mb-2 flex items-center justify-between"><span className="text-[10px] uppercase tracking-[.16em] text-zinc-500">Acceptance criteria</span><span className="text-[10px] text-zinc-600">{mission.memory.criteria.length} items</span></div><div className="space-y-2">{mission.memory.criteria.map((criterion, index) => <div key={criterion} className="flex items-start gap-2.5 rounded-lg border border-white/[.05] bg-white/[.015] p-2.5"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-violet-300/20 bg-violet-300/[.08] font-mono text-[9px] text-violet-200">{index + 1}</span><span className="text-[11px] leading-relaxed text-zinc-400">{criterion}</span></div>)}</div></div>
                <div><div className="mb-2 text-[10px] uppercase tracking-[.16em] text-zinc-500">Task ledger</div><div className="space-y-2">{mission.memory.tasks.map((task) => <div key={task.id} className="flex items-start gap-2 rounded-lg border border-white/[.05] p-2.5"><span className={`mt-0.5 ${task.status === 'completed' ? 'text-emerald-300' : task.status === 'blocked' ? 'text-rose-300' : 'text-zinc-600'}`}>{task.status === 'completed' ? <CheckCircle2 size={13} /> : task.status === 'blocked' ? <XCircle size={13} /> : <CircleDot size={13} />}</span><div><div className="text-[11px] text-zinc-300">{task.title}</div><div className="mt-1 text-[10px] text-zinc-600">{task.owner} · {task.status}</div></div></div>)}</div></div>
                <div className="rounded-xl border border-white/[.07] bg-black/20 p-3"><div className="text-[9px] uppercase tracking-[.17em] text-zinc-600">verifier summary</div><p className="mt-2 text-[11px] leading-relaxed text-zinc-400">{mission.memory.verifierSummary}</p></div>
              </>}
            </motion.div>}
            {activeTab === 'tools' && <motion.div key="tools" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="space-y-3">
              <div className="mb-3 text-[10px] uppercase tracking-[.15em] text-zinc-600">Tool invocation trace</div>
              {[{ name: 'File Search', description: 'Rank repository paths and locate likely change surfaces.', icon: FileSearch }, { name: 'File Read', description: 'Read bounded, non-secret files from the managed workspace.', icon: FileText }, { name: 'File Edit', description: 'Write model-proposed files using path guards and protected-file rules.', icon: FileCode2 }, { name: 'Terminal / Test Runner', description: 'Static syntax checks by default; npm tests only with explicit sandbox opt-in.', icon: Terminal }].map((tool) => {
                const used = toolEvents.some((event) => tool.name === 'File Search' ? /implementation.started|plan.started/.test(event.action) : tool.name === 'File Read' ? /implementation.started/.test(event.action) : tool.name === 'File Edit' ? /file.edit/.test(event.action) : /tests\./.test(event.action));
                return <div key={tool.name} className="flex gap-3 rounded-xl border border-white/[.06] bg-black/20 p-3.5"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${used ? 'border-emerald-400/20 bg-emerald-400/[.07] text-emerald-300' : 'border-white/[.07] bg-white/[.025] text-zinc-600'}`}><tool.icon size={16} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><div className="text-xs font-medium text-zinc-300">{tool.name}</div><span className={`text-[9px] uppercase tracking-wider ${used ? 'text-emerald-300' : 'text-zinc-700'}`}>{used ? 'invoked' : 'standby'}</span></div><p className="mt-1 text-[10px] leading-relaxed text-zinc-600">{tool.description}</p></div></div>;
              })}
              <div className="mt-4 rounded-xl border border-white/[.06] bg-black/20 p-3"><div className="mb-2 flex items-center gap-2 text-[9px] uppercase tracking-[.15em] text-zinc-600"><Terminal size={12} />Last tool events</div>{toolEvents.slice(-5).length ? toolEvents.slice(-5).map((event) => <div key={event.id} className="border-b border-white/[.04] py-2 last:border-0"><div className="font-mono text-[9px] text-violet-300">{event.agent} / {event.action}</div><p className="mt-1 text-[10px] text-zinc-500">{event.message}</p></div>) : <p className="text-[10px] text-zinc-600">Tool telemetry appears after a mission begins.</p>}</div>
            </motion.div>}
          </AnimatePresence>
        </div>
        {mission && <div className="border-t border-white/[.07] p-4 sm:p-5">
          {mission.status === 'awaiting_approval' && <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[.055] p-4"><div className="flex items-start gap-3"><div className="rounded-xl border border-amber-300/20 bg-amber-300/[.08] p-2 text-amber-200"><LockKeyhole size={17} /></div><div className="min-w-0 flex-1"><div className="text-sm font-medium text-amber-100">Human approval required</div><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{mission.filesChanged.length} changed file(s) staged. Review test, security, and code-review results before approving the export.</p></div></div>
            <div className="mt-3 grid grid-cols-3 gap-2">{[{ label: 'Changed files', value: mission.filesChanged.length, state: 'neutral' }, { label: 'Tests', value: mission.memory.testResults.status, state: mission.memory.testResults.status === 'passed' ? 'good' : 'warn' }, { label: 'Security', value: mission.memory.securityResults.status, state: mission.memory.securityResults.status === 'passed' ? 'good' : mission.memory.securityResults.status === 'failed' ? 'bad' : 'warn' }].map((item) => <div key={item.label} className="rounded-xl border border-white/[.06] bg-black/20 p-2.5"><div className="text-[9px] text-zinc-600">{item.label}</div><div className={`mt-1 truncate text-xs font-medium ${item.state === 'good' ? 'text-emerald-300' : item.state === 'bad' ? 'text-rose-300' : item.state === 'warn' ? 'text-amber-200' : 'text-zinc-200'}`}>{item.value}</div></div>)}</div>
            {mission.memory.testResults.status === 'skipped' && <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-amber-100/80"><AlertTriangle size={12} className="mt-0.5 shrink-0" />Repository tests were not executed. Approval acknowledges this evidence gap; consider running checks in an isolated sandbox before using the patch.</p>}
            <button onClick={approveMission} disabled={approving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-xs font-bold text-black transition hover:bg-amber-300 disabled:opacity-60">{approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}Approve changes for export</button>
          </div>}
          {mission.status === 'completed' && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.045] p-4"><div className="flex items-center gap-3"><CheckCircle2 size={19} className="text-emerald-300" /><div className="flex-1"><div className="text-sm font-medium text-emerald-100">Mission approved</div><div className="mt-1 text-[10px] text-zinc-500">Changes remain staged; no remote deployment was performed.</div></div><Check size={15} className="text-emerald-300" /></div><a href={`/api/missions/${mission.id}/export`} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[.08] px-4 py-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/[.13]"><Download size={14} />Download approved changes (.zip)</a></div>}
          {['blocked', 'failed'].includes(mission.status) && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[.04] p-4"><div className="flex items-center gap-2 text-sm font-medium text-rose-200"><AlertTriangle size={16} />Mission blocked</div><p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{mission.memory.verifierSummary}</p></div>}
        </div>}
      </section>
    </div>

    {analysis && <section className="glass rounded-3xl p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[.2em] text-violet-300">Repository intelligence</div><h3 className="mt-2 text-lg font-semibold text-white">{analysis.name}</h3><p className="mt-1 text-xs text-zinc-500">Architecture signals and high-value inspection points.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-lg border border-white/[.07] bg-white/[.025] px-3 py-2 text-[10px] text-zinc-400">{analysis.framework}</span><span className="rounded-lg border border-white/[.07] bg-white/[.025] px-3 py-2 text-[10px] text-zinc-400">{analysis.packageManager}</span><span className="rounded-lg border border-white/[.07] bg-white/[.025] px-3 py-2 text-[10px] text-zinc-400">{formatBytes(analysis.totalBytes)}</span></div></div>
      <div className="grid gap-5 lg:grid-cols-3"><div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-300"><Code2 size={14} className="text-violet-300" />Detected languages</div><div className="flex flex-wrap gap-2">{analysis.language.length ? analysis.language.map((language) => <span key={language} className="rounded-lg border border-violet-300/15 bg-violet-300/[.05] px-2.5 py-1.5 text-[10px] text-violet-100">{language}</span>) : <span className="text-[10px] text-zinc-600">No language fingerprints found.</span>}</div><div className="mt-5 text-[10px] text-zinc-600">{analysis.fileCount} files indexed</div></div>
        <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-300"><GitBranch size={14} className="text-sky-300" />Entry points & test signals</div><div className="space-y-2">{[...analysis.entryPoints.slice(0, 3), ...analysis.testFiles.slice(0, 2)].map((file) => <div key={file} className="flex items-center gap-2 text-[10px] text-zinc-500"><FileCode2 size={12} className="shrink-0 text-zinc-700" /><span className="truncate font-mono">{file}</span></div>)}{!analysis.entryPoints.length && !analysis.testFiles.length && <p className="text-[10px] text-zinc-600">No common entry-point or test naming patterns found.</p>}</div></div>
        <div className="rounded-2xl border border-white/[.06] bg-black/20 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-300"><ShieldCheck size={14} className="text-amber-200" />Risk areas</div><div className="space-y-2">{analysis.riskAreas.slice(0, 4).map((risk) => <div key={`${risk.path}${risk.reason}`} className="flex items-start gap-2"><span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${risk.severity === 'high' ? 'bg-rose-400' : 'bg-amber-300'}`} /><div className="min-w-0"><div className="truncate text-[10px] text-zinc-300">{risk.path}</div><div className="mt-0.5 text-[9px] leading-relaxed text-zinc-600">{risk.reason}</div></div></div>)}{!analysis.riskAreas.length && <p className="text-[10px] text-zinc-600">No file-name based risk signals found.</p>}</div></div>
      </div>
      <div className="mt-5 rounded-xl border border-white/[.05] bg-black/20 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[9px] uppercase tracking-[.15em] text-zinc-600">File map preview</span><span className="text-[9px] text-zinc-700">first {analysis.fileTree.length} paths</span></div><div className="flex flex-wrap gap-1.5">{analysis.fileTree.slice(0, 20).map((file) => <span key={file} className="max-w-full truncate rounded-md border border-white/[.05] bg-white/[.015] px-2 py-1 font-mono text-[9px] text-zinc-600">{file}</span>)}</div></div>
    </section>}

    {!compact && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.78fr)]">
      <section className="glass rounded-3xl p-5 sm:p-6"><div className="flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-[.2em] text-zinc-500">Persistent memory</div><h3 className="mt-2 text-lg font-semibold text-white">Recent missions</h3></div><Clock3 size={18} className="text-zinc-600" /></div>
        <div className="mt-4 space-y-2">{history.slice(0, 5).length ? history.slice(0, 5).map((item) => <button key={item.id} onClick={() => void selectHistory(item.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selectedHistoryId === item.id ? 'border-rose-400/25 bg-rose-400/[.04]' : 'border-white/[.05] bg-black/15 hover:border-white/[.1] hover:bg-white/[.02]'}`}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[.07] bg-white/[.025] text-zinc-500"><Workflow size={15} /></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-zinc-300">{item.request}</div><div className="mt-1 text-[10px] text-zinc-600">{item.repoName} · {timeAgo(item.updatedAt)} · {item.filesChanged.length} file(s)</div></div><StatusPill status={item.status} /></button>) : <div className="rounded-xl border border-dashed border-white/[.08] px-4 py-8 text-center text-xs text-zinc-600">No missions saved yet.</div>}</div>
        {history.length > 5 && <button onClick={() => window.location.assign('/dashboard')} className="mt-3 inline-flex items-center gap-2 text-[10px] text-rose-300 hover:text-rose-200">View all missions <ArrowRight size={12} /></button>}
      </section>
      <section className="glass rounded-3xl p-5 sm:p-6"><div className="flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-[.2em] text-zinc-500">Agent roster</div><h3 className="mt-2 text-lg font-semibold text-white">Six specialists. One guild.</h3></div><Bot size={18} className="text-rose-300" /></div>
        <div className="mt-4 space-y-2">{AGENTS.map((agent) => { const Icon = agent.icon; const latest = agentStatuses.get(agent.name); const active = Boolean(running && latest && Date.now() - new Date(latest.timestamp).getTime() < 180000); return <div key={agent.name} className="flex items-center gap-3 rounded-xl border border-white/[.05] bg-black/15 px-3 py-2.5"><div className={`flex h-8 w-8 items-center justify-center rounded-xl border border-white/[.06] bg-white/[.025] ${agent.color}`}><Icon size={15} /></div><div className="min-w-0 flex-1"><div className="text-[11px] font-medium text-zinc-300">{agent.name}</div><div className="mt-0.5 text-[9px] text-zinc-600">{agent.role}</div></div><span className={`h-1.5 w-1.5 rounded-full ${active ? 'animate-pulse bg-rose-400' : latest ? 'bg-emerald-400/60' : 'bg-zinc-700'}`} /></div>; })}</div>
      </section>
    </div>}
    {!compact && <section className="glass rounded-3xl p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[.2em] text-violet-300">Workflow design comparison</div><h3 className="mt-2 text-lg font-semibold text-white">Single-agent pass vs. multi-agent guild</h3><p className="mt-1 text-[10px] text-zinc-600">Capability profile, not a runtime benchmark. No fabricated latency or quality claims.</p></div><span className="rounded-lg border border-violet-300/15 bg-violet-300/[.04] px-3 py-2 text-[9px] uppercase tracking-wider text-violet-200">Same request · different controls</span></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[600px] border-collapse text-left"><thead><tr className="border-b border-white/[.07] text-[10px] uppercase tracking-wider text-zinc-600"><th className="px-3 py-3 font-medium">Capability</th><th className="px-3 py-3 font-medium">Single agent</th><th className="px-3 py-3 font-medium">DevPilot guild</th></tr></thead><tbody>{[{capability:'Independent code review',single:'Same agent self-checks',multi:'Dedicated reviewer'},{capability:'Security lens',single:'Prompt-dependent',multi:'Separate static scanner'},{capability:'Feedback loops',single:'Usually manual',multi:'Bounded auto-reruns (≤ 5)'},{capability:'Shared state & trace',single:'Conversation context',multi:'MissionMemory + event ledger'},{capability:'Approval gate',single:'App-specific',multi:'Separate approval API transition'}].map((row) => <tr key={row.capability} className="border-b border-white/[.045] last:border-0"><td className="px-3 py-3 text-[11px] text-zinc-300">{row.capability}</td><td className="px-3 py-3 text-[11px] text-zinc-600">{row.single}</td><td className="px-3 py-3 text-[11px] text-emerald-200"><span className="mr-2 text-emerald-300">✓</span>{row.multi}</td></tr>)}</tbody></table></div></section>}
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-1 text-[9px] uppercase tracking-[.14em] text-zinc-700"><span>DevPilot Engineering Guild · Human-approved artifacts only</span><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />{running ? 'Workflow active' : 'Control plane available'}<ArrowDownRight size={12} /></span></div>
  </div>;
}

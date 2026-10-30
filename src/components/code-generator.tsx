'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle, Check, ChevronRight, Code2, Copy, Download, FileCode2,
  Loader2, Sparkles
} from 'lucide-react';

type GeneratedFile = { path: string; language: string; description: string; code: string };
type CodeResult = { title: string; summary: string; files: GeneratedFile[]; runInstructions: string[]; notes: string[] };

const STACKS = [
  'Auto-detect the best stack', 'HTML + CSS + JavaScript', 'React + TypeScript',
  'Next.js 15 + TypeScript + Tailwind CSS', 'Python', 'Node.js + Express',
  'Java', 'C++', 'C#', 'PHP + MySQL'
];

const EXAMPLES = [
  'Create a beautiful responsive login page with email, password, show-password toggle, and a remember-me checkbox.',
  'Build a modern task manager with add, edit, delete, search, and local storage.',
  'Create a responsive portfolio website with hero, about, skills, projects, and contact sections.'
];

export function CodeGenerator() {
  const [prompt, setPrompt] = useState('Create a modern responsive login page with email and password fields, a show-password toggle, and a gradient background.');
  const [stack, setStack] = useState(STACKS[0]);
  const [result, setResult] = useState<CodeResult | null>(null);
  const [selectedFile, setSelectedFile] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [bundleLoading, setBundleLoading] = useState(false);

  const activeFile = result?.files[selectedFile] ?? null;
  const lineCount = useMemo(() => activeFile ? activeFile.code.split('\n').length : 0, [activeFile]);

  async function generateCode() {
    if (prompt.trim().length < 8) {
      setError('Please describe what you want to build.');
      return;
    }
    setLoading(true);
    setError('');
    setCopyError('');
    setCopied(false);
    try {
      const response = await fetch('/api/code/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), stack })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not generate code.');
      setResult(body.result as CodeResult);
      setSelectedFile(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Code generation failed.');
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.code);
      setCopied(true);
      setCopyError('');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError('Clipboard access was blocked. Select the code and copy it manually.');
    }
  }

  function downloadFile(file: GeneratedFile) {
    const blob = new Blob([file.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.path.split('/').pop() || 'generated-code.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadBundle() {
    if (!result || bundleLoading) return;
    setBundleLoading(true);
    setError('');
    try {
      const response = await fetch('/api/code/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Could not create the project ZIP.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'devpilot-generated-project.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Project export failed.');
    } finally {
      setBundleLoading(false);
    }
  }

  return <section id="code-studio" className="glass relative overflow-hidden rounded-3xl">
    <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/[.10] blur-[90px]" />
    <div className="relative border-b border-white/[.07] px-5 py-5 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/[.08] text-violet-200"><Sparkles size={20} /></div>
          <div><div className="text-[10px] font-semibold uppercase tracking-[.2em] text-violet-300">Prompt → source code</div><h2 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">Code Studio</h2><p className="mt-1 text-xs text-zinc-500">Describe it in plain English. Get real files you can inspect, copy, and download.</p></div>
        </div>
        <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[.05] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-200">AI code generator</span>
      </div>
    </div>

    <div className="relative grid gap-5 p-5 sm:p-7 xl:grid-cols-[.92fr_1.08fr]">
      <div className="min-w-0">
        <label htmlFor="code-prompt" className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-200"><span>What do you want to build?</span><span className="text-[10px] text-zinc-600">{prompt.length}/4000</span></label>
        <textarea id="code-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value.slice(0, 4000))} maxLength={4000} rows={8} placeholder="Example: Build a responsive website for a coffee shop with a menu, gallery, and contact form…" className="w-full resize-y rounded-2xl border border-white/[.09] bg-black/35 px-4 py-4 text-sm leading-relaxed text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-violet-300/35 focus:bg-black/45" />
        <div className="mt-4">
          <label htmlFor="code-stack" className="mb-2 block text-xs font-medium text-zinc-300">Preferred language / framework</label>
          <select id="code-stack" value={stack} onChange={(event) => setStack(event.target.value)} className="w-full rounded-xl border border-white/[.09] bg-[#111114] px-3 py-3 text-xs text-zinc-200 outline-none focus:border-violet-300/35">
            {STACKS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="mt-4"><div className="mb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-600">Try an example</div><div className="flex flex-wrap gap-2">{EXAMPLES.map((example, index) => <button key={example} type="button" onClick={() => setPrompt(example)} className="rounded-full border border-white/[.08] bg-white/[.025] px-3 py-2 text-left text-[10px] text-zinc-400 transition hover:border-violet-300/25 hover:text-violet-100">{['Login page', 'Task manager', 'Portfolio'][index]}</button>)}</div></div>
        <button type="button" onClick={generateCode} disabled={loading || prompt.trim().length < 8} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-rose-600 px-5 py-4 text-sm font-semibold text-white shadow-[0_10px_32px_rgba(139,92,246,.19)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={16} />}{loading ? 'Generating your code…' : 'Generate code'}{!loading && <ChevronRight size={16} />}
        </button>
        <p className="mt-3 text-center text-[10px] leading-relaxed text-zinc-600">Generated code is displayed only. DevPilot does not execute it automatically.</p>
        {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[.06] p-3 text-xs leading-relaxed text-rose-200"><AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-white/[.08] bg-[#09090b]">
        <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3">
          <div className="flex items-center gap-2"><Code2 size={15} className="text-violet-300" /><span className="text-xs font-semibold text-zinc-200">Generated output</span></div>
          {result && <span className="text-[9px] uppercase tracking-wider text-emerald-300">{result.files.length} file(s) ready</span>}
        </div>
        {!result ? <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-300/[.05] text-violet-200"><FileCode2 size={27} /></div>
          <h3 className="text-sm font-semibold text-zinc-200">Your code will appear here</h3>
          <p className="mt-2 max-w-[290px] text-xs leading-relaxed text-zinc-600">Enter a prompt and choose Generate code. DevPilot will return complete source files, not just suggestions.</p>
          <div className="mt-6 flex items-center gap-2 text-[9px] uppercase tracking-[.16em] text-zinc-700"><span className="h-px w-8 bg-white/[.08]" />Waiting for prompt<span className="h-px w-8 bg-white/[.08]" /></div>
        </div> : <>
          <div className="border-b border-white/[.06] px-4 py-3"><h3 className="text-sm font-semibold text-zinc-100">{result.title}</h3><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{result.summary}</p></div>
          <div className="flex items-center gap-1 overflow-x-auto border-b border-white/[.06] px-2 pt-2">{result.files.map((file, index) => <button key={file.path} type="button" onClick={() => { setSelectedFile(index); setCopied(false); }} className={`flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3 py-2 text-[10px] transition ${selectedFile === index ? 'border-violet-400 bg-violet-400/[.07] text-violet-100' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`}><FileCode2 size={12} />{file.path.split('/').pop()}</button>)}</div>
          {activeFile && <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.05] px-4 py-2"><div className="min-w-0"><div className="truncate text-[10px] text-zinc-300">{activeFile.path}</div><div className="mt-0.5 text-[9px] text-zinc-600">{activeFile.language} · {lineCount} lines{activeFile.description ? ` · ${activeFile.description}` : ''}</div></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => void copyCode()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[.09] px-2.5 py-1.5 text-[10px] text-zinc-300 transition hover:bg-white/[.06]">{copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}</button><button type="button" onClick={() => downloadFile(activeFile)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[.09] px-2.5 py-1.5 text-[10px] text-zinc-300 transition hover:bg-white/[.06]"><Download size={12} />Download</button></div></div>
            <pre className="scrollbar-thin max-h-[520px] min-h-[320px] overflow-auto p-4 text-[11px] leading-[1.75] text-[#d4d4dc]"><code>{activeFile.code}</code></pre>
          </>}
          {copyError && <div className="border-t border-amber-400/15 px-4 py-2 text-[10px] text-amber-200">{copyError}</div>}
          {(result.runInstructions.length > 0 || result.notes.length > 0) && <div className="border-t border-white/[.07] p-4"><div className="grid gap-4 sm:grid-cols-2">{result.runInstructions.length > 0 && <div><div className="mb-2 text-[9px] font-semibold uppercase tracking-[.15em] text-emerald-300">Run instructions</div><ol className="space-y-1.5">{result.runInstructions.map((item, index) => <li key={`${index}-${item}`} className="text-[10px] leading-relaxed text-zinc-400">{index + 1}. {item}</li>)}</ol></div>}{result.notes.length > 0 && <div><div className="mb-2 text-[9px] font-semibold uppercase tracking-[.15em] text-amber-200">Notes</div><ul className="space-y-1.5">{result.notes.map((item) => <li key={item} className="text-[10px] leading-relaxed text-zinc-500">• {item}</li>)}</ul></div>}</div></div>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[.07] bg-white/[.015] px-4 py-3"><span className="text-[9px] text-zinc-600">Review dependencies and security before running generated code.</span><button type="button" onClick={() => void downloadBundle()} disabled={bundleLoading} className="inline-flex items-center gap-2 rounded-lg border border-violet-300/20 bg-violet-300/[.06] px-3 py-2 text-[10px] font-medium text-violet-100 transition hover:bg-violet-300/[.11] disabled:opacity-50">{bundleLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}{bundleLoading ? 'Preparing ZIP…' : 'Download project (.zip)'}</button></div>
        </>}
      </div>
    </div>
  </section>;
}

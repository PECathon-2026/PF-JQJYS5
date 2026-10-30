import Link from 'next/link';
import { ArrowLeft, Code2, Workflow } from 'lucide-react';
import { CodeGenerator } from '@/components/code-generator';

export default function StudioPage() {
  return <div className="mx-auto max-w-[1500px] px-5 py-10 sm:px-10 lg:py-14">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-violet-300"><Code2 size={13} /> AI development workspace</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Prompt to code<span className="text-violet-300">.</span></h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">Describe an app, page, feature, component, or script. DevPilot generates complete source files you can inspect, copy, and download.</p>
      </div>
      <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-white/[.09] bg-white/[.025] px-4 py-2.5 text-xs text-zinc-300 transition hover:bg-white/[.06]"><Workflow size={14} className="text-rose-300" /> Open Mission Mode</Link>
    </div>
    <CodeGenerator />
    <div className="mt-5 flex items-start gap-2 rounded-2xl border border-amber-300/10 bg-amber-300/[.025] p-4 text-[11px] leading-relaxed text-zinc-500"><span className="mt-0.5 text-amber-200">Note:</span><p>Code Studio displays generated code; it does not execute it or change your computer. To modify and verify an existing repository with the six-agent team, use Mission Mode.</p></div>
  </div>;
}

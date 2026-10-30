import Link from 'next/link';
import { Code2 } from 'lucide-react';
import { MissionConsole } from '@/components/mission-console';

export default function DashboardPage() {
  return <div className="mx-auto max-w-[1500px] px-5 py-10 sm:px-10 lg:py-14">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-rose-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> Engineering command center</div><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Mission dashboard<span className="text-rose-400">.</span></h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">Observe the six-agent guild, inspect shared mission memory, review checks, and approve exportable change sets.</p></div><div className="flex flex-wrap items-center gap-2"><Link href="/studio" className="inline-flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-300/[.05] px-3 py-2 text-[10px] font-medium text-violet-100 transition hover:bg-violet-300/[.1]"><Code2 size={13} /> Generate code from a prompt</Link><div className="rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-2 text-[10px] text-zinc-500">SQLite · Persistent history</div></div></div>
    <MissionConsole />
  </div>;
}

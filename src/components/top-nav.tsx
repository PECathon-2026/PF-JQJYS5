'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Activity, Code2, GitBranch, LayoutDashboard, Shield, Swords } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Command Center', icon: LayoutDashboard },
  { href: '/studio', label: 'Code Studio', icon: Code2 },
  { href: '/dashboard', label: 'Missions', icon: Activity },
  { href: '/architecture', label: 'Architecture', icon: GitBranch }
];

export function TopNav() {
  const pathname = usePathname();
  return <header className="sticky top-0 z-50 border-b border-white/[.07] bg-[#0a0a0a]/85 backdrop-blur-xl">
    <div className="mx-auto flex h-[70px] max-w-[1500px] items-center justify-between px-5 lg:px-10">
      <Link href="/" className="group flex items-center gap-3" aria-label="DevPilot command center">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 red-glow">
          <Swords size={20} strokeWidth={1.7} /><span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-4 ring-[#0a0a0a]" />
        </div>
        <div><div className="text-[15px] font-semibold tracking-[.16em] text-white">DEVPILOT<span className="text-rose-400">.</span></div><div className="text-[9px] font-medium tracking-[.22em] text-zinc-500">THE MYSTIC MIKADO&apos;S GUILD</div></div>
      </Link>
      <nav className="flex items-center gap-1 rounded-2xl border border-white/[.07] bg-white/[.025] p-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return <Link key={href} href={href} className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}>
            {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl border border-white/[.08] bg-white/[.06]" transition={{ type: 'spring', stiffness: 360, damping: 30 }} />}
            <Icon size={14} className={`relative z-10 ${active ? 'text-rose-400' : ''}`} /><span className="relative z-10 hidden sm:inline">{label}</span>
          </Link>;
        })}
      </nav>
      <div className="hidden items-center gap-2 md:flex"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /><span className="text-[10px] uppercase tracking-[.18em] text-zinc-500">Guild systems online</span><span className="ml-1 rounded-lg border border-white/10 p-2 text-zinc-500"><Shield size={14} /></span></div>
    </div>
  </header>;
}

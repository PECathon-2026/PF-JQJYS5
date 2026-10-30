import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';
const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors', {
  variants: { variant: { default: 'border-rose-500/25 bg-rose-500/10 text-rose-200', secondary: 'border-white/10 bg-white/[.04] text-zinc-300', outline: 'border-white/15 text-zinc-300', success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200', warning: 'border-amber-400/25 bg-amber-400/10 text-amber-200' } },
  defaultVariants: { variant: 'default' }
});
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) { return <div className={cn(badgeVariants({ variant }), className)} {...props} />; }

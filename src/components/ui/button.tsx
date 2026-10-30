import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: {
      default: 'bg-rose-600 text-white hover:bg-rose-500',
      secondary: 'border border-white/10 bg-white/[.04] text-zinc-100 hover:bg-white/[.08]',
      outline: 'border border-white/10 bg-transparent text-zinc-200 hover:bg-white/[.045]',
      ghost: 'text-zinc-300 hover:bg-white/[.06] hover:text-white',
      destructive: 'bg-red-500/15 text-red-200 hover:bg-red-500/25'
    },
    size: { default: 'h-10 px-4 py-2', sm: 'h-8 rounded-lg px-3 text-xs', lg: 'h-12 px-5', icon: 'h-10 w-10' }
  },
  defaultVariants: { variant: 'default', size: 'default' }
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean; }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';
export { buttonVariants };

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { TopNav } from '@/components/top-nav';

export const metadata: Metadata = {
  title: 'DevPilot — Autonomous AI Engineering Guild',
  description: 'Plan like a Shogun. Build like a Samurai. Test like a Sentinel.',
  applicationName: 'DevPilot',
  metadataBase: new URL('http://localhost:3000')
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body><TopNav /><main>{children}</main></body></html>;
}

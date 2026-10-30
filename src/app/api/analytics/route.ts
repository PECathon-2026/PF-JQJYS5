import { NextResponse } from 'next/server';
import { getAnalytics } from '@/lib/db/database';

export const runtime = 'nodejs';
export async function GET() { return NextResponse.json(getAnalytics()); }

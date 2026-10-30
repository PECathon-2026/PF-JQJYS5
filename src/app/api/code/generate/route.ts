import { NextResponse } from 'next/server';
import { activeProvider, generateJson } from '@/lib/services/llm';
import { buildCodeGenerationPrompt, codeGenerationSchema } from '@/lib/services/code-generation';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  let input: { prompt?: unknown; stack?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON request.' }, { status: 400 });
  }

  if (typeof input.prompt !== 'string' || input.prompt.trim().length < 8 || input.prompt.trim().length > 4000) {
    return NextResponse.json({ error: 'Describe what you want to build in 8 to 4,000 characters.' }, { status: 400 });
  }
  const stack = typeof input.stack === 'string' && input.stack.trim().length <= 80 ? input.stack.trim() : 'Auto-detect the best stack';
  const provider = activeProvider();
  if (provider === 'mock') {
    return NextResponse.json({
      error: 'AI code generation is not configured yet. Add an OpenAI or Gemini API key to .env.local, set DEVPILOT_MODEL_PROVIDER to openai or gemini, and restart the server.'
    }, { status: 503 });
  }

  try {
    const raw = await generateJson<unknown>(buildCodeGenerationPrompt(input.prompt.trim(), stack), { maxOutputTokens: 12000 });
    if (!raw) return NextResponse.json({ error: 'The AI provider returned an empty response. Try again.' }, { status: 502 });
    const parsed = codeGenerationSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'The AI response was incomplete or contained an unsafe file path. Try a more specific prompt.' }, { status: 502 });
    }
    return NextResponse.json({ result: parsed.data, provider }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Code generation failed.';
    return NextResponse.json({ error: message.slice(0, 400) }, { status: 502 });
  }
}

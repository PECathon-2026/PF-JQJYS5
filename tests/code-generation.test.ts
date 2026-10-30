import { codeGenerationSchema, buildCodeGenerationPrompt } from '@/lib/services/code-generation';

describe('Code Studio output validation', () => {
  const valid = {
    title: 'Login page',
    summary: 'A responsive login page.',
    files: [{ path: 'src/app/page.tsx', language: 'tsx', description: 'Main page', code: 'export default function Page() { return <main />; }' }],
    runInstructions: ['npm run dev'],
    notes: []
  };

  it('accepts safe relative source files', () => {
    expect(codeGenerationSchema.safeParse(valid).success).toBe(true);
  });

  it.each(['../outside.ts', '/root/file.ts', 'C:/secret.ts', 'src\\..\\secret.ts', '.env.local', 'keys/private.pem'])('rejects unsafe path %s', (path) => {
    const result = codeGenerationSchema.safeParse({ ...valid, files: [{ ...valid.files[0], path }] });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate paths and too many files', () => {
    expect(codeGenerationSchema.safeParse({ ...valid, files: [valid.files[0], valid.files[0]] }).success).toBe(false);
    expect(codeGenerationSchema.safeParse({ ...valid, files: Array.from({ length: 9 }, (_, index) => ({ ...valid.files[0], path: `src/file-${index}.ts` })) }).success).toBe(false);
  });

  it('includes the requested stack and asks for complete source code', () => {
    const prompt = buildCodeGenerationPrompt('Make a calculator app', 'React + TypeScript');
    expect(prompt).toContain('Make a calculator app');
    expect(prompt).toContain('React + TypeScript');
    expect(prompt).toContain('complete source code');
  });
});

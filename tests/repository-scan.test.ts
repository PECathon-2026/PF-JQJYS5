import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanRepository } from '@/lib/repository/scan';

const temporaryRoots: string[] = [];

function temporaryRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devpilot-scan-'));
  temporaryRoots.push(root);
  fs.mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', '__tests__'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { next: '15.5.6' }, scripts: { test: 'jest' } }));
  fs.writeFileSync(path.join(root, 'src', 'app', 'page.tsx'), 'export default function Page(){ return null; }');
  fs.writeFileSync(path.join(root, 'src', '__tests__', 'page.test.ts'), 'test("ok", () => {});');
  return root;
}

afterEach(() => {
  // Remove only fixture directories created by this test file.
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('detects Next.js and test files without traversing generated folders', () => {
  const root = temporaryRepo();
  fs.mkdirSync(path.join(root, 'node_modules', 'large'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', 'large', 'ignore.js'), 'bad');
  const analysis = scanRepository(root, '00000000-0000-4000-8000-000000000000', 'fixture');
  expect(analysis.framework).toBe('Next.js');
  expect(analysis.packageManager).toBe('npm');
  expect(analysis.testFiles).toContain('src/__tests__/page.test.ts');
  expect(analysis.fileTree.some((file) => file.includes('node_modules'))).toBe(false);
});

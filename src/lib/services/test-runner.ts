import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { RepositoryAnalysis, TestResult } from '@/lib/types';
import { assertAllowedTerminalCommand } from '@/lib/security/terminal-middleware';
import { listRepositoryFiles } from '@/lib/services/file-tools';

const TEST_TIMEOUT = Math.max(5000, Math.min(Number(process.env.DEVPILOT_TEST_TIMEOUT_MS || 60000), 120000));

function inspectSyntax(root: string, files: string[]): TestResult['checks'] {
  const checks: TestResult['checks'] = [];
  for (const relative of files.filter((f) => /\.(tsx?|jsx?|mjs|cjs)$/.test(f)).slice(0, 100)) {
    try {
      const source = fs.readFileSync(path.join(root, relative), 'utf8');
      const result = ts.transpileModule(source, {
        fileName: relative,
        reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }
      });
      const errors = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
      if (errors.length) checks.push({ name: `Syntax: ${relative}`, status: 'failed', detail: errors.slice(0, 2).map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ') });
    } catch (error) {
      checks.push({ name: `Syntax: ${relative}`, status: 'failed', detail: error instanceof Error ? error.message : 'Could not inspect file.' });
    }
  }
  if (!checks.some((c) => c.status === 'failed')) checks.push({ name: 'TypeScript/JavaScript syntax', status: 'passed', detail: `Inspected ${files.filter((f) => /\.(tsx?|jsx?|mjs|cjs)$/.test(f)).length} source files with the TypeScript parser.` });
  return checks;
}

async function runRestrictedTestCommand(root: string): Promise<{ code: number | null; output: string; durationMs: number }> {
  const command = ['npm', 'test', '--', '--runInBand'];
  assertAllowedTerminalCommand(command);
  const started = Date.now();
  const output = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: root,
      shell: false,
      windowsHide: true,
      timeout: TEST_TIMEOUT,
      env: {
        PATH: process.env.PATH || '',
        SystemRoot: process.env.SystemRoot || '',
        HOME: process.env.HOME || '',
        CI: '1',
        NO_COLOR: '1',
        npm_config_audit: 'false',
        npm_config_fund: 'false'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let combined = '';
    child.stdout.on('data', (chunk: Buffer) => { combined = (combined + chunk.toString()).slice(-16000); });
    child.stderr.on('data', (chunk: Buffer) => { combined = (combined + chunk.toString()).slice(-16000); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output: combined }));
  });
  return { ...output, durationMs: Date.now() - started };
}

export async function runTests(root: string, analysis: RepositoryAnalysis, changedFiles: string[]): Promise<TestResult> {
  const started = Date.now();
  const currentFiles = listRepositoryFiles(root, 500);
  const checks = inspectSyntax(root, [...new Set([...currentFiles, ...changedFiles])]);
  const syntaxFailed = checks.some((c) => c.status === 'failed');
  if (syntaxFailed) return { status: 'failed', summary: 'One or more source files failed syntax inspection.', checks, durationMs: Date.now() - started };

  const pkgPath = path.join(root, 'package.json');
  let hasTestScript = false;
  try { hasTestScript = Boolean(JSON.parse(fs.readFileSync(pkgPath, 'utf8'))?.scripts?.test); } catch { /* Non-Node repository. */ }

  if (process.env.DEVPILOT_ENABLE_TEST_EXECUTION !== 'true') {
    checks.push({ name: 'Repository tests', status: 'skipped', detail: 'Execution is disabled by policy. Set DEVPILOT_ENABLE_TEST_EXECUTION=true only inside an isolated sandbox with network access disabled.' });
    checks.push({ name: 'Repository framework', status: analysis.testFiles.length ? 'warning' : 'skipped', detail: analysis.testFiles.length ? `${analysis.testFiles.length} test file(s) discovered; not executed.` : 'No recognizable test files were discovered.' });
    return { status: 'skipped', summary: 'Static syntax checks passed; repository tests were not executed due to the safe default policy.', checks, durationMs: Date.now() - started };
  }

  if (!hasTestScript) {
    checks.push({ name: 'Repository tests', status: 'skipped', detail: 'No npm test script found; tests were not executed.' });
    return { status: 'skipped', summary: 'Static checks passed, but no supported npm test script was available.', checks, durationMs: Date.now() - started };
  }

  try {
    const result = await runRestrictedTestCommand(root);
    checks.push({ name: 'npm test -- --runInBand', status: result.code === 0 ? 'passed' : 'failed', detail: result.output || `Process exited with code ${result.code}.` });
    return { status: result.code === 0 ? 'passed' : 'failed', summary: result.code === 0 ? 'Static checks and repository tests passed.' : 'Repository test command failed.', checks, durationMs: result.durationMs, command: 'npm test -- --runInBand' };
  } catch (error) {
    checks.push({ name: 'Repository tests', status: 'failed', detail: error instanceof Error ? error.message : 'Test runner failed.' });
    return { status: 'failed', summary: 'The repository test command could not complete.', checks, durationMs: Date.now() - started, command: 'npm test -- --runInBand' };
  }
}

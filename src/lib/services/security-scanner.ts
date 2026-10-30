import fs from 'node:fs';
import path from 'node:path';
import type { RepositoryAnalysis, SecurityResult } from '@/lib/types';
import { listRepositoryFiles } from '@/lib/services/file-tools';

const SECRET_RULES: { name: string; regex: RegExp; severity: 'critical' | 'high' }[] = [
  { name: 'private-key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, severity: 'critical' },
  { name: 'cloud-access-key', regex: /\bAKIA[0-9A-Z]{16}\b/, severity: 'critical' },
  { name: 'github-token', regex: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/, severity: 'critical' },
  { name: 'openai-token', regex: /\bsk-[A-Za-z0-9_-]{24,}\b/, severity: 'high' },
  { name: 'hardcoded-password', regex: /(?:password|passwd|client_secret)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, severity: 'high' }
];

export function scanSecurity(root: string, analysis: RepositoryAnalysis, changedFiles: string[]): SecurityResult {
  const files = [...new Set([...analysis.fileTree, ...changedFiles, ...listRepositoryFiles(root, 500)])].slice(0, 800);
  const findings: SecurityResult['findings'] = [];
  for (const relative of files) {
    if (/\.(lock|map|min\.[cm]?js)$/i.test(relative)) continue;
    let content: string;
    try {
      const stat = fs.statSync(path.join(root, relative));
      if (!stat.isFile() || stat.size > 1_000_000) continue;
      content = fs.readFileSync(path.join(root, relative), 'utf8');
    } catch { continue; }
    if (content.includes('YOUR_API_KEY') || content.includes('example-token') || content.includes('replace-me')) continue;
    for (const rule of SECRET_RULES) {
      if (rule.regex.test(content)) findings.push({ severity: rule.severity, path: relative, rule: rule.name, message: 'Potential hard-coded secret. Move credentials to environment variables and rotate exposed credentials.' });
    }
    if (/\beval\s*\(/.test(content) || /new\s+Function\s*\(/.test(content)) findings.push({ severity: 'high', path: relative, rule: 'dynamic-code-execution', message: 'Dynamic code execution found; verify inputs cannot be controlled by untrusted users.' });
    if (/\b(child_process|execSync|exec\s*\(|spawn\s*\()/.test(content)) findings.push({ severity: 'medium', path: relative, rule: 'process-execution', message: 'Process execution primitive found; validate arguments and avoid shell interpolation.' });
    if (/\b(?:SELECT|UPDATE|INSERT|DELETE)\b.{0,100}\+\s*(?:req\.|request\.|params\.|query\.)/is.test(content)) findings.push({ severity: 'high', path: relative, rule: 'possible-sql-injection', message: 'Possible SQL built from request data; use parameterized queries.' });
    if (findings.length >= 80) break;
  }
  const critical = findings.some((f) => f.severity === 'critical');
  const high = findings.some((f) => f.severity === 'high');
  const status: SecurityResult['status'] = critical || high ? 'failed' : findings.length ? 'warning' : 'passed';
  const summary = critical ? 'Critical secret exposure detected.' : high ? 'High-severity security findings require remediation.' : findings.length ? `${findings.length} lower-severity signal(s) require human review.` : 'No matches found by the built-in static security rules.';
  return { status, summary, findings };
}

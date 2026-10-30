import fs from 'node:fs';
import path from 'node:path';
import { MAX_FILE_BYTES } from '@/lib/config';

const FORBIDDEN_SEGMENTS = new Set(['.git', 'node_modules', '.next', '.devpilot', '.devpilot-data', '.env', 'secrets', '.ssh', '.aws', '.gnupg']);
const FORBIDDEN_NAMES = new Set(['.env', '.env.local', '.env.production', '.npmrc', '.pypirc', 'id_rsa', 'id_ed25519', 'credentials', 'credentials.json', 'service-account.json', 'service_account.json', 'secrets.json']);
const PRIVATE_MATERIAL_EXTENSIONS = /\.(?:pem|key|p12|pfx|ppk|jks|keystore)$/i;

export function isSensitiveRepositoryPath(input: string): boolean {
  const normalized = input.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const lowerParts = parts.map((part) => part.toLowerCase());
  const filename = lowerParts[lowerParts.length - 1] || '';
  return lowerParts.some((part) => FORBIDDEN_SEGMENTS.has(part))
    || FORBIDDEN_NAMES.has(filename)
    || filename.startsWith('.env.')
    || PRIVATE_MATERIAL_EXTENSIONS.test(filename);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeRelativePath(input: string): string {
  const normalized = input.replace(/\\/g, '/');
  if (!normalized || normalized.includes('\0') || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error('Path must be repository-relative.');
  }
  const parts = normalized.split('/');
  if (parts.some((part) => part === '..' || part === '.' || part === '')) throw new Error('Path traversal is not allowed.');
  if (isSensitiveRepositoryPath(normalized)) throw new Error('Secrets, private-key material, and protected repository paths are excluded.');
  return parts.join('/');
}

export function resolveInsideRoot(root: string, relativePath: string): string {
  const safeRelative = normalizeRelativePath(relativePath);
  const rootPath = path.resolve(root);
  const target = path.resolve(rootPath, ...safeRelative.split('/'));
  if (target !== rootPath && !target.startsWith(`${rootPath}${path.sep}`)) throw new Error('Path escaped repository root.');
  return target;
}

export function assertInsideRoot(root: string, target: string): void {
  const rootPath = path.resolve(root);
  const resolved = path.resolve(target);
  if (resolved !== rootPath && !resolved.startsWith(`${rootPath}${path.sep}`)) throw new Error('Access outside repository root is forbidden.');
}

export function assertNoSymlinkTraversal(root: string, target: string): void {
  assertInsideRoot(root, target);
  const relative = path.relative(path.resolve(root), path.resolve(target));
  let current = path.resolve(root);
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error('Symbolic links are not allowed in the repository workspace.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

export function safeReadFile(root: string, relativePath: string, maxBytes = MAX_FILE_BYTES): string {
  const target = resolveInsideRoot(root, relativePath);
  assertNoSymlinkTraversal(root, target);
  const stat = fs.statSync(target);
  if (!stat.isFile()) throw new Error('Only regular files can be read.');
  if (stat.size > maxBytes) throw new Error(`File exceeds the ${maxBytes} byte read limit.`);
  return fs.readFileSync(target, 'utf8');
}

export function safeWriteFile(root: string, relativePath: string, content: string): void {
  const target = resolveInsideRoot(root, relativePath);
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) throw new Error('Generated file exceeds the file size limit.');
  assertNoSymlinkTraversal(root, target);
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  assertNoSymlinkTraversal(root, target);
  if (fs.existsSync(target) && !fs.statSync(target).isFile()) throw new Error('Target is not a regular file.');
  fs.writeFileSync(target, content, { encoding: 'utf8', mode: 0o600, flag: 'w' });
}

export function safeDeleteFile(root: string, relativePath: string): never {
  resolveInsideRoot(root, relativePath);
  throw new Error('Delete operations are disabled in DevPilot.');
}

export function validateTerminalCommand(command: string[]): { allowed: boolean; reason: string } {
  if (!Array.isArray(command) || command.length === 0 || command.length > 4) return { allowed: false, reason: 'Empty or oversized command.' };
  const joined = command.join(' ');
  if (/[;&|`$<>\n\r]/.test(joined)) return { allowed: false, reason: 'Shell operators and expansions are forbidden.' };
  if (/\b(rm|sudo|su|chmod|chown|dd|mkfs|shutdown|reboot|kill|pkill|curl|wget|nc|ncat|ssh|scp|ftp|telnet|powershell|cmd|bash|sh|zsh|git\s+clean)\b/i.test(joined)) {
    return { allowed: false, reason: 'Destructive, privileged, shell, or network commands are forbidden.' };
  }
  const exactNpmTest = command[0] === 'npm' && (
    (command.length === 2 && command[1] === 'test') ||
    (command.length === 4 && command[1] === 'test' && command[2] === '--' && command[3] === '--runInBand')
  );
  if (!exactNpmTest) return { allowed: false, reason: 'Only the exact npm test command (optionally with --runInBand) is supported.' };
  return { allowed: true, reason: 'Command matches the restricted test-runner allowlist.' };
}

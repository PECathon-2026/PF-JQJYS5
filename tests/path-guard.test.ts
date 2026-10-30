import { isSensitiveRepositoryPath, normalizeRelativePath, resolveInsideRoot, validateTerminalCommand } from '@/lib/security/path-guard';
import { assertAllowedTerminalCommand } from '@/lib/security/terminal-middleware';

describe('repository path guard', () => {
  test('accepts repository-relative source files', () => {
    expect(normalizeRelativePath('src/components/button.tsx')).toBe('src/components/button.tsx');
  });
  test('rejects traversal and absolute paths', () => {
    expect(() => normalizeRelativePath('../secrets.txt')).toThrow(/traversal|repository-relative/i);
    expect(() => normalizeRelativePath('/etc/passwd')).toThrow(/repository-relative/i);
    expect(() => normalizeRelativePath('src/../../escape.ts')).toThrow(/traversal/i);
  });
  test('rejects environment files, private-key material, and protected directories', () => {
    expect(() => normalizeRelativePath('.env')).toThrow(/excluded/i);
    expect(() => normalizeRelativePath('node_modules/pkg/index.js')).toThrow(/excluded/i);
    expect(() => normalizeRelativePath('config/server.pem')).toThrow(/excluded/i);
    expect(isSensitiveRepositoryPath('.ssh/id_ed25519')).toBe(true);
    expect(isSensitiveRepositoryPath('src/components/button.tsx')).toBe(false);
  });
  test('resolves targets only inside the configured root', () => {
    expect(resolveInsideRoot('/tmp/devpilot-repo', 'src/index.ts')).toBe('/tmp/devpilot-repo/src/index.ts');
  });
});

describe('terminal command allowlist', () => {
  test('allows bounded npm test command', () => {
    expect(validateTerminalCommand(['npm', 'test', '--', '--runInBand']).allowed).toBe(true);
  });
  test('guard middleware blocks commands outside the allowlist', () => {
    expect(() => assertAllowedTerminalCommand(['npm', 'test', '--', '--runInBand'])).not.toThrow();
    expect(() => assertAllowedTerminalCommand(['curl', 'https://example.com'])).toThrow(/blocked/i);
  });
  test('rejects shell chaining, network tools, and destructive commands', () => {
    expect(validateTerminalCommand(['npm', 'test', ';', 'curl', 'https://example.com']).allowed).toBe(false);
    expect(validateTerminalCommand(['rm', '-rf', '/']).allowed).toBe(false);
    expect(validateTerminalCommand(['curl', 'https://example.com']).allowed).toBe(false);
    expect(validateTerminalCommand(['bash', '-c', 'echo hello']).allowed).toBe(false);
  });
});

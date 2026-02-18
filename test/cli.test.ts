import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync, spawnSync, spawn } from 'child_process';

const rootDir = process.cwd();
const cliPath = join(rootDir, 'dist', 'cli.js');

function runCli(args: string[], stdinInput?: string) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: rootDir,
    encoding: 'utf-8',
    input: stdinInput,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await sleep(50);
  }
  throw new Error('Timed out waiting for condition');
}

describe('CLI integration', () => {
  beforeAll(() => {
    execFileSync(process.execPath, [join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc')], {
      cwd: rootDir,
      stdio: 'inherit',
    });
  });

  it('prints --version and exits 0', () => {
    const res = runCli(['--version']);
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prints --help and exits 0', () => {
    const res = runCli(['--help']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Usage:');
    expect(res.stdout).toContain('hxml build <input> [options]');
  });

  it('returns exit code 2 for invalid mode', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hxml-cli-'));
    try {
      const inFile = join(tmp, 'in.hxml');
      writeFileSync(inFile, '<div>ok</div>', 'utf-8');
      const res = runCli(['build', inFile, '--mode', 'bad-mode']);
      expect(res.status).toBe(2);
      expect(res.stderr).toContain('Invalid emit mode');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('returns exit code 2 for missing option value', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hxml-cli-'));
    try {
      const inFile = join(tmp, 'in.hxml');
      writeFileSync(inFile, '<div>ok</div>', 'utf-8');
      const res = runCli(['build', inFile, '--mode']);
      expect(res.status).toBe(2);
      expect(res.stderr).toContain('Missing value for --mode');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('supports check --format json', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hxml-cli-'));
    try {
      const inFile = join(tmp, 'bad.hxml');
      writeFileSync(inFile, '<data:record>text</data:record>', 'utf-8');
      const res = runCli(['check', inFile, '--format', 'json']);
      expect(res.status).toBe(1);
      const parsed = JSON.parse(res.stdout);
      expect(parsed.summary.errors).toBeGreaterThan(0);
      expect(Array.isArray(parsed.diagnostics)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('supports --stdin input for build', () => {
    const res = runCli(['build', '--stdin'], '<div>stdin</div>');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('<div>stdin</div>');
  });

  it('supports fmt --indent option', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hxml-cli-'));
    try {
      const inFile = join(tmp, 'fmt.hxml');
      writeFileSync(inFile, '<div><p>hello</p></div>', 'utf-8');
      const res = runCli(['fmt', inFile, '--indent', '4']);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('\n    <p>hello</p>\n');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('supports fmt --sort-attrs option', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hxml-cli-'));
    try {
      const inFile = join(tmp, 'fmt-sort.hxml');
      writeFileSync(inFile, '<div z="3" a="1" m="2"></div>', 'utf-8');
      const res = runCli(['fmt', inFile, '--sort-attrs']);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('<div a="1" m="2" z="3"></div>');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('supports fmt --preserve-quotes option', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hxml-cli-'));
    try {
      const inFile = join(tmp, 'fmt-quotes.hxml');
      writeFileSync(inFile, `<div a='x' b="y"></div>`, 'utf-8');
      const res = runCli(['fmt', inFile, '--preserve-quotes']);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(`a='x'`);
      expect(res.stdout).toContain(`b="y"`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('writes external sourcemap with build --sourcemap', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hxml-cli-'));
    try {
      const inFile = join(tmp, 'in.hxml');
      const outFile = join(tmp, 'out.html');
      writeFileSync(inFile, '<div>map</div>', 'utf-8');
      const res = runCli(['build', inFile, '--sourcemap', '-o', outFile]);
      expect(res.status).toBe(0);
      const html = readFileSync(outFile, 'utf-8');
      const map = readFileSync(`${outFile}.map`, 'utf-8');
      expect(html).toContain('sourceMappingURL=out.html.map');
      expect(JSON.parse(map).version).toBe(3);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('builds multiple files from a glob into an output directory', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hxml-cli-'));
    try {
      const srcDir = join(tmp, 'src');
      const outDir = join(tmp, 'dist');
      const aFile = join(srcDir, 'a.hxml');
      const nestedFile = join(srcDir, 'nested', 'b.hxml');

      mkdirSync(join(srcDir, 'nested'), { recursive: true });
      writeFileSync(aFile, '<div>A</div>', 'utf-8');
      writeFileSync(nestedFile, '<div>B</div>', 'utf-8');

      const glob = join(srcDir, '**', '*.hxml');
      const res = runCli(['build', glob, '-o', outDir]);

      expect(res.status).toBe(0);
      expect(readFileSync(join(outDir, 'a.html'), 'utf-8')).toContain('<div>A</div>');
      expect(readFileSync(join(outDir, 'nested', 'b.html'), 'utf-8')).toContain('<div>B</div>');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('rebuilds in watch mode when input changes', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hxml-cli-watch-'));
    const inFile = join(tmp, 'watch.hxml');
    const outFile = join(tmp, 'watch.html');
    writeFileSync(inFile, '<div>one</div>', 'utf-8');

    const proc = spawn(process.execPath, [cliPath, 'build', inFile, '-o', outFile, '--watch'], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    try {
      await waitFor(() => {
        try {
          return readFileSync(outFile, 'utf-8').includes('one');
        } catch {
          return false;
        }
      }, 6000);

      writeFileSync(inFile, '<div>two</div>', 'utf-8');

      await waitFor(() => {
        try {
          return readFileSync(outFile, 'utf-8').includes('two');
        } catch {
          return false;
        }
      }, 6000);
    } finally {
      proc.kill('SIGINT');
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

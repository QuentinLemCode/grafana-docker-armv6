import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function cleanTmp(tmpDir: string) {
  if (!fs.existsSync(tmpDir)) return;
  const entries = fs.readdirSync(tmpDir);
  for (const entry of entries) {
    const full = path.join(tmpDir, entry);
    if (entry.endsWith('.tar.gz') || entry === 'metadata.json') {
      try { fs.unlinkSync(full); } catch {}
    }
  }
}

test('downloads latest Grafana ARMv6 tarball into tmp and writes metadata', { timeout: 600000 }, async () => {
  const projectRoot = process.cwd();
  const tmpDir = path.join(projectRoot, 'tmp');
  await ensureDir(tmpDir);
  await cleanTmp(tmpDir);

  const indexJs = path.join(projectRoot, 'dist', 'index.js');
  assert.ok(fs.existsSync(indexJs), 'dist/index.js must exist; run npm run build first');

  const { stdout } = await execFileAsync(process.execPath, [indexJs, '--download'], { cwd: projectRoot, maxBuffer: 1024 * 1024 * 20 });
  const lines = stdout.trim().split(/\r?\n/);
  const destPath = lines[lines.length - 1];
  assert.ok(destPath && destPath.startsWith(tmpDir), 'CLI must print destination path inside tmp/');
  assert.ok(fs.existsSync(destPath), 'Downloaded tarball must exist');

  const stat = fs.statSync(destPath);
  assert.ok(stat.size > 1_000_000, `Downloaded file seems too small (${stat.size} bytes)`);
  assert.match(path.basename(destPath), /(linux|rpi).*arm-6.*\.tar\.gz$/i, 'Tarball name should indicate ARMv6');

  const metadataPath = path.join(tmpDir, 'metadata.json');
  assert.ok(fs.existsSync(metadataPath), 'metadata.json should be written');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as { version: string; url: string };
  assert.ok(metadata.version && metadata.version.length > 0, 'metadata.version must be set');
  assert.ok(metadata.url && metadata.url.startsWith('http'), 'metadata.url must be a URL');
});



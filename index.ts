#!/usr/bin/env node
import { createRequire } from 'node:module';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as os from 'os';
import * as https from 'node:https';

const DOWNLOAD_PAGE = 'https://grafana.com/grafana/download?edition=oss&platform=arm';

type ScrapeResult = {
  version: string;
  url: string;
  sha256?: string | null;
};

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // follow redirect
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => reject(err));
    });
  });
}

const require = createRequire(import.meta.url);

async function scrape(): Promise<ScrapeResult> {
  const { chromium } = require('playwright') as any;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(DOWNLOAD_PAGE, { waitUntil: 'domcontentloaded' });

  // Wait for text anchors that include ARMv6 Standalone Linux Binaries section
  // Strategy: find the link whose href ends with linux_arm-6.tar.gz or linux_arm-6.tar.gz (escaped underscores may appear on page as %5F)
  const armv6Link = await page.locator('a[href*="linux"][href*="arm-6"][href$=".tar.gz"]').first();
  await armv6Link.waitFor({ state: 'visible', timeout: 15000 });

  const url = await armv6Link.getAttribute('href');
  if (!url) {
    await browser.close();
    throw new Error('ARMv6 tar.gz link not found');
  }

  // Try to extract version from URL pattern: .../release/<version>/grafana_..._linux_arm-6.tar.gz or grafana-rpi_..._linux_arm-6.tar.gz
  const versionMatch = url.match(/\/release\/([^/]+)\//);
  const version = versionMatch ? versionMatch[1] : 'unknown';

  // Try to find SHA256 text near the section
  let sha256: string | null = null;
  try {
    const section = armv6Link.locator('xpath=ancestor::section[1]');
    const shaText = await section.locator('text=SHA256').nth(0).locator('xpath=following::text()[1]').textContent({ timeout: 2000 });
    if (shaText) {
      const hashMatch = shaText.match(/[a-fA-F0-9]{64}/);
      sha256 = hashMatch ? hashMatch[0] : null;
    }
  } catch {
    sha256 = null;
  }

  await browser.close();
  return { version, url, sha256 };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const printJson = args.has('--print-json');
  const doDownload = args.has('--download');

  const result = await scrape();

  if (printJson) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result));
  }

  if (doDownload) {
    const tmpDir = path.join(process.cwd(), 'tmp');
    ensureDir(tmpDir);
    const fileName = path.basename(new URL(result.url).pathname);
    const destPath = path.join(tmpDir, fileName);
    await downloadFile(result.url, destPath);
    // Persist metadata for CI usage
    try {
      fs.writeFileSync(path.join(tmpDir, 'metadata.json'), JSON.stringify(result, null, 2));
    } catch {}
    // eslint-disable-next-line no-console
    console.log(destPath);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}


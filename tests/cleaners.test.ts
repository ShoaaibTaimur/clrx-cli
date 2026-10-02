// ============================================================
// ClrX — Cleaner Availability Tests
// ============================================================
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { CachesCleaner } from '../src/cleaners/caches.js';
import { LogsCleaner } from '../src/cleaners/logs.js';
import { BrowserCleaner } from '../src/cleaners/browser.js';
import { TrashCleaner } from '../src/cleaners/trash.js';
import { DownloadsCleaner } from '../src/cleaners/downloads.js';
import { IosBackupsCleaner } from '../src/cleaners/ios-backups.js';
import { SafetyLevel } from '../src/types/cleaner.js';

const HOME = os.homedir();

describe('CachesCleaner', () => {
  const cleaner = new CachesCleaner();

  it('has correct id', () => expect(cleaner.id).toBe('user-caches'));
  it('has SAFE safety level', () => expect(cleaner.safety).toBe(SafetyLevel.SAFE));
  it('targets ~/Library/Caches', () => {
    const targets = cleaner['getTargetPaths']();
    expect(targets[0]).toBe(path.join(HOME, 'Library', 'Caches'));
  });
});

describe('LogsCleaner', () => {
  const cleaner = new LogsCleaner();

  it('has correct id', () => expect(cleaner.id).toBe('user-logs'));
  it('has SAFE safety level', () => expect(cleaner.safety).toBe(SafetyLevel.SAFE));
  it('targets ~/Library/Logs', () => {
    const targets = cleaner['getTargetPaths']();
    expect(targets[0]).toBe(path.join(HOME, 'Library', 'Logs'));
  });
});

describe('BrowserCleaner', () => {
  const cleaner = new BrowserCleaner();

  it('has correct id', () => expect(cleaner.id).toBe('browser-caches'));
  it('has SAFE safety level', () => expect(cleaner.safety).toBe(SafetyLevel.SAFE));
  it('includes Chrome, Firefox, Safari', () => {
    const targets = cleaner['getTargetPaths']();
    const joined = targets.join('|');
    expect(joined).toContain('Google');
    expect(joined).toContain('Mozilla');
    expect(joined).toContain('Safari');
  });
});

describe('TrashCleaner', () => {
  const cleaner = new TrashCleaner();

  it('has correct id', () => expect(cleaner.id).toBe('trash'));
  it('has CAUTION safety level', () => expect(cleaner.safety).toBe(SafetyLevel.CAUTION));
  it('targets ~/.Trash', () => {
    const targets = cleaner['getTargetPaths']();
    expect(targets[0]).toBe(path.join(HOME, '.Trash'));
  });
});

describe('DownloadsCleaner', () => {
  const cleaner = new DownloadsCleaner();

  it('has correct id', () => expect(cleaner.id).toBe('downloads'));
  it('has CONFIRMATION_REQUIRED safety level', () =>
    expect(cleaner.safety).toBe(SafetyLevel.CONFIRMATION_REQUIRED));

  it('clean() never deletes — always skips', async () => {
    const result = await cleaner.clean({
      dryRun: false,
      yes: true, // even with --yes
      verbose: false,
      quiet: true,
    });

    // Should always skip, never remove
    expect(result.removed).toBe(0);
    expect(result.bytesFreed).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('clean() dry-run also never deletes', async () => {
    const result = await cleaner.clean({
      dryRun: true,
      yes: true,
      verbose: false,
      quiet: true,
    });

    expect(result.removed).toBe(0);
    expect(result.bytesFreed).toBe(0);
  });
});

describe('IosBackupsCleaner', () => {
  const cleaner = new IosBackupsCleaner();

  it('has correct id', () => expect(cleaner.id).toBe('ios-backups'));
  it('has CONFIRMATION_REQUIRED safety level', () =>
    expect(cleaner.safety).toBe(SafetyLevel.CONFIRMATION_REQUIRED));

  it('clean() never auto-deletes iOS backups', async () => {
    const result = await cleaner.clean({
      dryRun: false,
      yes: true, // even with --yes, should not delete
      verbose: false,
      quiet: true,
    });

    expect(result.removed).toBe(0);
    expect(result.bytesFreed).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

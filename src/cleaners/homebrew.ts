// ============================================================
// ClrX — Homebrew Cleaner
// Uses: `brew cleanup --prune=all`
// Safety: CAUTION — removes old formula versions
// ============================================================
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SafetyLevel } from '../types/cleaner.js';
import type { CleanOptions, CleanResult, ScanResult } from '../types/cleaner.js';
import { BaseCleaner } from './base.js';
import { pathExists, getPathSizeBytes } from '../core/filesystem.js';
import { commandExists } from '../utils/platform.js';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

const BREW_CACHE_PATHS = [
  '/opt/homebrew/Cellar', // Apple Silicon
  '/usr/local/Cellar', // Intel
  '/home/linuxbrew/.linuxbrew/Cellar', // Linux
];

export class HomebrewCleaner extends BaseCleaner {
  readonly id = 'homebrew';
  readonly name = 'Homebrew Cache';
  readonly description = 'Homebrew package cache. Removes old formula versions and downloads.';
  readonly safety = SafetyLevel.CAUTION;

  private brewCachePath = `${process.env.HOME}/Library/Caches/Homebrew`;

  protected getTargetPaths(): string[] {
    return [this.brewCachePath];
  }

  override async isAvailable(): Promise<boolean> {
    return commandExists('brew');
  }

  override async scan(): Promise<ScanResult> {
    this.registerTargets();

    const hasBrew = await commandExists('brew');

    if (!hasBrew) {
      return {
        cleanerId: this.id,
        name: this.name,
        sizeBytes: 0,
        itemCount: 0,
        safety: this.safety,
        isAvailable: false,
        note: 'Homebrew not installed',
        paths: [],
      };
    }

    let totalBytes = 0;
    const paths = [];

    // Check Homebrew cache
    const cacheExists = await pathExists(this.brewCachePath);
    if (cacheExists) {
      const sz = await getPathSizeBytes(this.brewCachePath);
      totalBytes += sz;
      paths.push({ path: this.brewCachePath, sizeBytes: sz, exists: true });
    }

    // Try to get `brew cleanup --dry-run` output for accurate estimate
    try {
      const { stdout } = await execFileAsync('brew', ['cleanup', '--dry-run']);
      logger.verbose(`brew cleanup --dry-run:\n${stdout}`);
    } catch {
      // Non-fatal
    }

    return {
      cleanerId: this.id,
      name: this.name,
      sizeBytes: totalBytes,
      itemCount: 0,
      safety: this.safety,
      isAvailable: hasBrew,
      note: 'Runs: brew cleanup --prune=all',
      paths,
    };
  }

  override async clean(options: CleanOptions): Promise<CleanResult> {
    this.registerTargets();

    const hasBrew = await commandExists('brew');
    if (!hasBrew) {
      return this.skipResult(options.dryRun, 'Homebrew not installed');
    }

    if (options.dryRun) {
      logger.info('  [DRY RUN] Would run: brew cleanup --prune=all');
      const sizeBytes = await getPathSizeBytes(this.brewCachePath);
      return {
        cleanerId: this.id,
        name: this.name,
        bytesFreed: sizeBytes,
        removed: 1,
        skipped: 0,
        failed: 0,
        dryRun: true,
        errors: [],
        actions: [{ path: this.brewCachePath, sizeBytes, status: 'would-remove' }],
      };
    }

    const sizeBefore = await getPathSizeBytes(this.brewCachePath);

    try {
      logger.verbose('Running: brew cleanup --prune=all');
      await execFileAsync('brew', ['cleanup', '--prune=all']);

      const sizeAfter = await getPathSizeBytes(this.brewCachePath);
      const bytesFreed = Math.max(0, sizeBefore - sizeAfter);

      return {
        cleanerId: this.id,
        name: this.name,
        bytesFreed,
        removed: 1,
        skipped: 0,
        failed: 0,
        dryRun: false,
        errors: [],
        actions: [{ path: this.brewCachePath, sizeBytes: bytesFreed, status: 'removed' }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Homebrew cleanup failed: ${msg}`);
      return {
        cleanerId: this.id,
        name: this.name,
        bytesFreed: 0,
        removed: 0,
        skipped: 0,
        failed: 1,
        dryRun: false,
        errors: [{ path: this.brewCachePath, message: msg }],
        actions: [{ path: this.brewCachePath, sizeBytes: 0, status: 'failed', reason: msg }],
      };
    }
  }

  private skipResult(dryRun: boolean, reason: string): CleanResult {
    return {
      cleanerId: this.id,
      name: this.name,
      bytesFreed: 0,
      removed: 0,
      skipped: 1,
      failed: 0,
      dryRun,
      errors: [],
      actions: [{ path: this.brewCachePath, sizeBytes: 0, status: 'skipped', reason }],
    };
  }
}

export const homebrewCleaner = new HomebrewCleaner();

// Export path array for reference
export { BREW_CACHE_PATHS };

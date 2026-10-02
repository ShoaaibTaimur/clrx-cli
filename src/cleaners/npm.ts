// ============================================================
// ClrX — npm Cache Cleaner
// Target: ~/.npm/_cacache (via `npm cache clean --force`)
// Safety: SAFE — npm rebuilds its cache automatically
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

export class NpmCleaner extends BaseCleaner {
  readonly id = 'npm-cache';
  readonly name = 'npm Cache';
  readonly description = 'npm package cache (~/.npm). Rebuilt automatically on demand.';
  readonly safety = SafetyLevel.SAFE;

  protected getTargetPaths(): string[] {
    return [this.homeJoin('.npm')];
  }

  override async isAvailable(): Promise<boolean> {
    return commandExists('npm');
  }

  override async scan(): Promise<ScanResult> {
    this.registerTargets();

    const hasNpm = await commandExists('npm');
    const npmPath = this.homeJoin('.npm');

    if (!hasNpm) {
      return {
        cleanerId: this.id,
        name: this.name,
        sizeBytes: 0,
        itemCount: 0,
        safety: this.safety,
        isAvailable: false,
        note: 'npm not installed',
        paths: [{ path: npmPath, sizeBytes: 0, exists: false, skipReason: 'npm not installed' }],
      };
    }

    const exists = await pathExists(npmPath);
    const sizeBytes = exists ? await getPathSizeBytes(npmPath) : 0;

    return {
      cleanerId: this.id,
      name: this.name,
      sizeBytes,
      itemCount: 0,
      safety: this.safety,
      isAvailable: exists,
      paths: [{ path: npmPath, sizeBytes, exists }],
    };
  }

  override async clean(options: CleanOptions): Promise<CleanResult> {
    this.registerTargets();

    const hasNpm = await commandExists('npm');
    if (!hasNpm) {
      return this.skipResult(options.dryRun, 'npm not installed');
    }

    const npmPath = this.homeJoin('.npm');
    const exists = await pathExists(npmPath);
    if (!exists) {
      return this.skipResult(options.dryRun, 'npm cache directory not found');
    }

    const sizeBefore = await getPathSizeBytes(npmPath);

    if (options.dryRun) {
      logger.info(`  [DRY RUN] Would run: npm cache clean --force`);
      return {
        cleanerId: this.id,
        name: this.name,
        bytesFreed: sizeBefore,
        removed: 1,
        skipped: 0,
        failed: 0,
        dryRun: true,
        errors: [],
        actions: [{ path: npmPath, sizeBytes: sizeBefore, status: 'would-remove' }],
      };
    }

    try {
      logger.verbose('Running: npm cache clean --force');
      await execFileAsync('npm', ['cache', 'clean', '--force']);

      const sizeAfter = await getPathSizeBytes(npmPath);
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
        actions: [{ path: npmPath, sizeBytes: bytesFreed, status: 'removed' }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`npm cache clean failed: ${msg}`);
      return {
        cleanerId: this.id,
        name: this.name,
        bytesFreed: 0,
        removed: 0,
        skipped: 0,
        failed: 1,
        dryRun: false,
        errors: [{ path: npmPath, message: msg }],
        actions: [{ path: npmPath, sizeBytes: 0, status: 'failed', reason: msg }],
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
      actions: [{ path: this.homeJoin('.npm'), sizeBytes: 0, status: 'skipped', reason }],
    };
  }
}

export const npmCleaner = new NpmCleaner();

// ============================================================
// ClrX — pnpm Cache Cleaner
// Target: ~/Library/pnpm (pnpm store)
// Safety: SAFE — pnpm rebuilds its store on demand
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

export class PnpmCleaner extends BaseCleaner {
  readonly id = 'pnpm-cache';
  readonly name = 'pnpm Cache';
  readonly description = 'pnpm package store (~/Library/pnpm). Rebuilt on demand.';
  readonly safety = SafetyLevel.SAFE;

  protected getTargetPaths(): string[] {
    return [this.homeJoin('Library', 'pnpm')];
  }

  override async isAvailable(): Promise<boolean> {
    return commandExists('pnpm');
  }

  override async scan(): Promise<ScanResult> {
    this.registerTargets();

    const hasPnpm = await commandExists('pnpm');
    const pnpmPath = this.homeJoin('Library', 'pnpm');

    if (!hasPnpm) {
      return {
        cleanerId: this.id,
        name: this.name,
        sizeBytes: 0,
        itemCount: 0,
        safety: this.safety,
        isAvailable: false,
        note: 'pnpm not installed',
        paths: [{ path: pnpmPath, sizeBytes: 0, exists: false, skipReason: 'pnpm not installed' }],
      };
    }

    const exists = await pathExists(pnpmPath);
    const sizeBytes = exists ? await getPathSizeBytes(pnpmPath) : 0;

    return {
      cleanerId: this.id,
      name: this.name,
      sizeBytes,
      itemCount: 0,
      safety: this.safety,
      isAvailable: exists,
      paths: [{ path: pnpmPath, sizeBytes, exists }],
    };
  }

  override async clean(options: CleanOptions): Promise<CleanResult> {
    this.registerTargets();

    const hasPnpm = await commandExists('pnpm');
    if (!hasPnpm) {
      return this.skipResult(options.dryRun, 'pnpm not installed');
    }

    const pnpmPath = this.homeJoin('Library', 'pnpm');
    const exists = await pathExists(pnpmPath);
    if (!exists) {
      return this.skipResult(options.dryRun, 'pnpm store not found');
    }

    const sizeBefore = await getPathSizeBytes(pnpmPath);

    if (options.dryRun) {
      logger.info(`  [DRY RUN] Would run: pnpm store prune`);
      return {
        cleanerId: this.id,
        name: this.name,
        bytesFreed: sizeBefore,
        removed: 1,
        skipped: 0,
        failed: 0,
        dryRun: true,
        errors: [],
        actions: [{ path: pnpmPath, sizeBytes: sizeBefore, status: 'would-remove' }],
      };
    }

    try {
      logger.verbose('Running: pnpm store prune');
      await execFileAsync('pnpm', ['store', 'prune']);

      const sizeAfter = await getPathSizeBytes(pnpmPath);
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
        actions: [{ path: pnpmPath, sizeBytes: bytesFreed, status: 'removed' }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`pnpm store prune failed: ${msg}`);
      return {
        cleanerId: this.id,
        name: this.name,
        bytesFreed: 0,
        removed: 0,
        skipped: 0,
        failed: 1,
        dryRun: false,
        errors: [{ path: pnpmPath, message: msg }],
        actions: [{ path: pnpmPath, sizeBytes: 0, status: 'failed', reason: msg }],
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
      actions: [
        { path: this.homeJoin('Library', 'pnpm'), sizeBytes: 0, status: 'skipped', reason },
      ],
    };
  }
}

export const pnpmCleaner = new PnpmCleaner();

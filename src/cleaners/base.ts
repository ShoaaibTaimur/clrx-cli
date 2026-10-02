// ============================================================
// ClrX — Base Cleaner (abstract)
// ============================================================
import path from 'node:path';
import os from 'node:os';
import type {
  Cleaner,
  CleanOptions,
  CleanResult,
  ScanResult,
  PathScanResult,
} from '../types/cleaner.js';
import { SafetyLevel } from '../types/cleaner.js';
import {
  getPathSizeBytes,
  countDirectChildren,
  pathExists,
  clearDirectoryContents,
  resolvePath,
} from '../core/filesystem.js';
import { validateDeletionTarget, registerCleanupTarget } from '../core/safety.js';
import logger from '../utils/logger.js';

export abstract class BaseCleaner implements Cleaner {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly safety: SafetyLevel;

  /**
   * Return the list of root paths this cleaner is responsible for.
   * These will be registered as cleanup targets.
   */
  protected abstract getTargetPaths(): string[];

  /**
   * Resolve a path, substituting ~ with the home directory.
   */
  protected resolve(p: string): string {
    return resolvePath(p);
  }

  protected home(): string {
    return os.homedir();
  }

  protected homeJoin(...parts: string[]): string {
    return path.join(os.homedir(), ...parts);
  }

  /**
   * Register all target paths in the safety system.
   * Call this in the constructor or lazily.
   */
  protected registerTargets(): void {
    for (const p of this.getTargetPaths()) {
      const resolved = this.resolve(p);
      registerCleanupTarget(resolved);
    }
  }

  /**
   * Default isAvailable(): checks if at least one target path exists.
   * Override for tool-dependent cleaners.
   */
  async isAvailable(): Promise<boolean> {
    for (const p of this.getTargetPaths()) {
      if (await pathExists(this.resolve(p))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Default scan(): measure sizes of all target paths.
   */
  async scan(): Promise<ScanResult> {
    this.registerTargets();

    const pathResults: PathScanResult[] = [];
    let totalBytes = 0;
    let totalItems = 0;

    for (const rawPath of this.getTargetPaths()) {
      const resolved = this.resolve(rawPath);
      const exists = await pathExists(resolved);

      if (!exists) {
        pathResults.push({ path: resolved, sizeBytes: 0, exists: false });
        continue;
      }

      const sizeBytes = await getPathSizeBytes(resolved);
      const itemCount = await countDirectChildren(resolved);

      pathResults.push({ path: resolved, sizeBytes, exists: true });
      totalBytes += sizeBytes;
      totalItems += itemCount;
    }

    const isAvailable = pathResults.some((p) => p.exists);

    return {
      cleanerId: this.id,
      name: this.name,
      sizeBytes: totalBytes,
      itemCount: totalItems,
      safety: this.safety,
      isAvailable,
      paths: pathResults,
    };
  }

  /**
   * Default clean(): clear contents of all target paths.
   */
  async clean(options: CleanOptions): Promise<CleanResult> {
    this.registerTargets();

    const actions: CleanResult['actions'] = [];
    const errors: CleanResult['errors'] = [];
    let bytesFreed = 0;
    let removed = 0;
    let skipped = 0;
    let failed = 0;

    for (const rawPath of this.getTargetPaths()) {
      const resolved = this.resolve(rawPath);

      if (!(await pathExists(resolved))) {
        skipped++;
        actions.push({
          path: resolved,
          sizeBytes: 0,
          status: 'skipped',
          reason: 'Path does not exist',
        });
        continue;
      }

      // Safety validation
      const validation = await validateDeletionTarget(resolved);
      if (!validation.safe) {
        skipped++;
        logger.warn(`Skipped: ${resolved}\n  Reason: ${validation.reason}`);
        actions.push({
          path: resolved,
          sizeBytes: 0,
          status: 'skipped',
          reason: validation.reason,
        });
        continue;
      }

      const sizeBefore = await getPathSizeBytes(resolved);

      if (options.dryRun) {
        // List what would be removed
        const { removed: wouldRemove } = await clearDirectoryContents(resolved, true);
        for (const p of wouldRemove) {
          const sz = await getPathSizeBytes(p);
          actions.push({ path: p, sizeBytes: sz, status: 'would-remove' });
          bytesFreed += sz;
        }
        removed += wouldRemove.length;
      } else {
        if (options.verbose) {
          logger.verbose(`Clearing contents of ${resolved}`);
        }

        const { removed: removedPaths, failed: failedPaths } = await clearDirectoryContents(
          resolved,
          false,
        );

        for (const p of removedPaths) {
          actions.push({ path: p, sizeBytes: 0, status: 'removed' });
          removed++;
        }

        for (const { path: fp, error } of failedPaths) {
          failed++;
          errors.push({ path: fp, message: error });
          actions.push({ path: fp, sizeBytes: 0, status: 'failed', reason: error });
          logger.verbose(`  ⚠ Skipped: ${fp}\n    Reason: ${error}`);
        }

        const sizeAfter = await getPathSizeBytes(resolved);
        bytesFreed += Math.max(0, sizeBefore - sizeAfter);
      }
    }

    return {
      cleanerId: this.id,
      name: this.name,
      bytesFreed,
      removed,
      skipped,
      failed,
      dryRun: options.dryRun,
      errors,
      actions,
    };
  }
}

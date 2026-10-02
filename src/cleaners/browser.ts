// ============================================================
// ClrX — Browser Caches Cleaner
// Targets: Chrome, Firefox, Safari cache directories
// Safety: SAFE — browser caches are rebuilt automatically
// Note: Advise closing browsers before cleaning
// ============================================================
import { SafetyLevel } from '../types/cleaner.js';
import type { ScanResult, CleanOptions, CleanResult, PathScanResult } from '../types/cleaner.js';
import { BaseCleaner } from './base.js';
import {
  pathExists,
  getPathSizeBytes,
  countDirectChildren,
  clearDirectoryContents,
} from '../core/filesystem.js';
import { validateDeletionTarget } from '../core/safety.js';
import logger from '../utils/logger.js';

interface BrowserTarget {
  browser: string;
  path: string;
}

export class BrowserCleaner extends BaseCleaner {
  readonly id = 'browser-caches';
  readonly name = 'Browser Caches';
  readonly description =
    'Cache files for Chrome, Firefox, and Safari. Safe to clear — browsers rebuild them.';
  readonly safety = SafetyLevel.SAFE;

  private get browsers(): BrowserTarget[] {
    return [
      {
        browser: 'Chrome',
        path: this.homeJoin('Library', 'Caches', 'Google', 'Chrome'),
      },
      {
        browser: 'Firefox',
        path: this.homeJoin('Library', 'Caches', 'Mozilla'),
      },
      {
        browser: 'Safari',
        path: this.homeJoin('Library', 'Caches', 'com.apple.Safari'),
      },
    ];
  }

  protected getTargetPaths(): string[] {
    return this.browsers.map((b) => b.path);
  }

  override async scan(): Promise<ScanResult> {
    this.registerTargets();

    const pathResults: PathScanResult[] = [];
    let totalBytes = 0;
    let totalItems = 0;
    const notes: string[] = [];

    for (const { browser, path: bp } of this.browsers) {
      const exists = await pathExists(bp);

      if (!exists) {
        pathResults.push({
          path: bp,
          sizeBytes: 0,
          exists: false,
          skipReason: `${browser} not installed`,
        });
        notes.push(`${browser}: not installed`);
        continue;
      }

      const sizeBytes = await getPathSizeBytes(bp);
      const itemCount = await countDirectChildren(bp);
      pathResults.push({ path: bp, sizeBytes, exists: true });
      totalBytes += sizeBytes;
      totalItems += itemCount;
    }

    const installedBrowsers = pathResults.filter((p) => p.exists);
    const isAvailable = installedBrowsers.length > 0;

    let note: string | undefined;
    if (notes.length > 0 && notes.length < this.browsers.length) {
      note = notes.join('; ');
    } else if (notes.length === this.browsers.length) {
      note = 'No supported browsers installed';
    }

    return {
      cleanerId: this.id,
      name: this.name,
      sizeBytes: totalBytes,
      itemCount: totalItems,
      safety: this.safety,
      isAvailable,
      note,
      paths: pathResults,
    };
  }

  override async clean(options: CleanOptions): Promise<CleanResult> {
    this.registerTargets();

    const actions: CleanResult['actions'] = [];
    const errors: CleanResult['errors'] = [];
    let bytesFreed = 0;
    let removed = 0;
    let skipped = 0;
    let failed = 0;

    if (!options.quiet) {
      logger.info('  ℹ Close your browsers before cleaning for best results.');
    }

    for (const { browser, path: bp } of this.browsers) {
      if (!(await pathExists(bp))) {
        logger.verbose(`${browser}: not installed — skipped`);
        skipped++;
        continue;
      }

      const validation = await validateDeletionTarget(bp);
      if (!validation.safe) {
        skipped++;
        logger.warn(`Skipped ${browser} cache: ${validation.reason}`);
        continue;
      }

      const sizeBefore = await getPathSizeBytes(bp);

      if (options.dryRun) {
        const { removed: wouldRemove } = await clearDirectoryContents(bp, true);
        for (const p of wouldRemove) {
          const sz = await getPathSizeBytes(p);
          actions.push({ path: p, sizeBytes: sz, status: 'would-remove' });
          bytesFreed += sz;
        }
        removed += wouldRemove.length;
        logger.verbose(`[DRY RUN] Would clear ${browser} cache: ${bp}`);
      } else {
        const { removed: removedPaths, failed: failedPaths } = await clearDirectoryContents(
          bp,
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
        }

        const sizeAfter = await getPathSizeBytes(bp);
        bytesFreed += Math.max(0, sizeBefore - sizeAfter);
        logger.verbose(`Cleared ${browser} cache`);
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

export const browserCleaner = new BrowserCleaner();

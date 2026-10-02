// ============================================================
// ClrX — Xcode Cleaner
// Targets:
//   - ~/Library/Developer/Xcode/DerivedData  (CAUTION)
//   - ~/Library/Developer/Xcode/Archives      (CONFIRMATION_REQUIRED)
//   - ~/Library/Developer/CoreSimulator       (CAUTION — simulator data)
// Safety: CAUTION for DerivedData/Simulators, CONFIRMATION_REQUIRED for Archives
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
import { validateDeletionTarget, registerCleanupTarget } from '../core/safety.js';
import logger from '../utils/logger.js';

export class XcodeCleaner extends BaseCleaner {
  readonly id = 'xcode';
  readonly name = 'Xcode Developer Data';
  readonly description =
    'Xcode DerivedData and Simulator caches. Archives require explicit confirmation.';
  readonly safety = SafetyLevel.CAUTION;

  private get derivedDataPath(): string {
    return this.homeJoin('Library', 'Developer', 'Xcode', 'DerivedData');
  }

  private get archivesPath(): string {
    return this.homeJoin('Library', 'Developer', 'Xcode', 'Archives');
  }

  private get simulatorPath(): string {
    return this.homeJoin('Library', 'Developer', 'CoreSimulator');
  }

  protected getTargetPaths(): string[] {
    return [this.derivedDataPath, this.simulatorPath];
    // Archives are NOT in the default clean targets — require separate explicit action
  }

  override async isAvailable(): Promise<boolean> {
    return (
      (await pathExists(this.derivedDataPath)) ||
      (await pathExists(this.simulatorPath)) ||
      (await pathExists(this.archivesPath))
    );
  }

  override async scan(): Promise<ScanResult> {
    this.registerTargets();
    registerCleanupTarget(this.archivesPath); // Register for info purposes

    const targets = [
      {
        label: 'DerivedData',
        path: this.derivedDataPath,
        safety: SafetyLevel.CAUTION,
      },
      {
        label: 'Simulator',
        path: this.simulatorPath,
        safety: SafetyLevel.CAUTION,
      },
      {
        label: 'Archives',
        path: this.archivesPath,
        safety: SafetyLevel.CONFIRMATION_REQUIRED,
      },
    ];

    const pathResults: PathScanResult[] = [];
    let totalBytes = 0;
    let totalItems = 0;

    for (const { path: tp } of targets) {
      const exists = await pathExists(tp);
      if (!exists) {
        pathResults.push({ path: tp, sizeBytes: 0, exists: false });
        continue;
      }

      const sizeBytes = await getPathSizeBytes(tp);
      const itemCount = await countDirectChildren(tp);
      pathResults.push({ path: tp, sizeBytes, exists: true });
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
      note: 'Archives are NOT auto-deleted. DerivedData and Simulator caches are safe to clear.',
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

    // Only clean DerivedData and Simulator — NOT Archives
    const safeTargets = [this.derivedDataPath, this.simulatorPath];

    for (const tp of safeTargets) {
      if (!(await pathExists(tp))) {
        skipped++;
        continue;
      }

      const validation = await validateDeletionTarget(tp);
      if (!validation.safe) {
        skipped++;
        logger.warn(`Skipped: ${tp}\n  Reason: ${validation.reason}`);
        continue;
      }

      const sizeBefore = await getPathSizeBytes(tp);

      if (options.dryRun) {
        const { removed: wouldRemove } = await clearDirectoryContents(tp, true);
        for (const p of wouldRemove) {
          const sz = await getPathSizeBytes(p);
          actions.push({ path: p, sizeBytes: sz, status: 'would-remove' });
          bytesFreed += sz;
        }
        removed += wouldRemove.length;
      } else {
        const { removed: removedPaths, failed: failedPaths } = await clearDirectoryContents(
          tp,
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

        const sizeAfter = await getPathSizeBytes(tp);
        bytesFreed += Math.max(0, sizeBefore - sizeAfter);
      }
    }

    // Always skip Archives with an explanation
    logger.verbose('Xcode Archives skipped — require explicit manual management');
    actions.push({
      path: this.archivesPath,
      sizeBytes: 0,
      status: 'skipped',
      reason: 'Archives not auto-deleted — manage via Xcode Organizer',
    });
    skipped++;

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

export const xcodeCleaner = new XcodeCleaner();

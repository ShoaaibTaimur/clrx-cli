// ============================================================
// ClrX — iOS Backups Inspector
// Target: ~/Library/Application Support/MobileSync/Backup
// Safety: CONFIRMATION_REQUIRED — irreplaceable device backups
// Note: ClrX reports but does NOT delete iOS backups.
// ============================================================
import { SafetyLevel } from '../types/cleaner.js';
import type { ScanResult, CleanOptions, CleanResult } from '../types/cleaner.js';
import { BaseCleaner } from './base.js';
import { pathExists, getPathSizeBytes, listDirectChildren } from '../core/filesystem.js';
import logger from '../utils/logger.js';

export class IosBackupsCleaner extends BaseCleaner {
  readonly id = 'ios-backups';
  readonly name = 'iPhone/iPad Backups';
  readonly description =
    'Local device backups in ~/Library/Application Support/MobileSync/Backup. Report only — not auto-deleted.';
  readonly safety = SafetyLevel.CONFIRMATION_REQUIRED;

  private get backupPath(): string {
    return this.homeJoin('Library', 'Application Support', 'MobileSync', 'Backup');
  }

  protected getTargetPaths(): string[] {
    return [this.backupPath];
  }

  override async scan(): Promise<ScanResult> {
    this.registerTargets();

    const exists = await pathExists(this.backupPath);

    if (!exists) {
      return {
        cleanerId: this.id,
        name: this.name,
        sizeBytes: 0,
        itemCount: 0,
        safety: this.safety,
        isAvailable: false,
        note: 'No local iPhone/iPad backups found',
        paths: [{ path: this.backupPath, sizeBytes: 0, exists: false }],
      };
    }

    const sizeBytes = await getPathSizeBytes(this.backupPath);
    const children = await listDirectChildren(this.backupPath);
    const itemCount = children.length;

    return {
      cleanerId: this.id,
      name: this.name,
      sizeBytes,
      itemCount,
      safety: this.safety,
      isAvailable: true,
      note: 'Requires explicit confirmation — manage backups in Finder or iTunes',
      paths: [{ path: this.backupPath, sizeBytes, exists: true }],
    };
  }

  /**
   * iOS backups are NEVER auto-deleted.
   * They require users to manage them explicitly via iTunes/Finder.
   */
  override async clean(options: CleanOptions): Promise<CleanResult> {
    logger.info('  Note: iPhone/iPad backups are not automatically deleted.');
    logger.info('  Manage backups via Finder or iTunes.');

    return {
      cleanerId: this.id,
      name: this.name,
      bytesFreed: 0,
      removed: 0,
      skipped: 1,
      failed: 0,
      dryRun: options.dryRun,
      errors: [],
      actions: [
        {
          path: this.backupPath,
          sizeBytes: 0,
          status: 'skipped',
          reason: 'iOS backups require explicit manual management',
        },
      ],
    };
  }
}

export const iosBackupsCleaner = new IosBackupsCleaner();

// ============================================================
// ClrX — Downloads Inspector
// Targets: ~/Downloads
// Safety: CONFIRMATION_REQUIRED — user-created content
// Note: ClrX REPORTS on Downloads but does NOT automatically delete them.
//       Users must explicitly confirm.
// ============================================================
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SafetyLevel } from '../types/cleaner.js';
import type { ScanResult, CleanOptions, CleanResult } from '../types/cleaner.js';
import { BaseCleaner } from './base.js';
import { pathExists, getPathSizeBytes } from '../core/filesystem.js';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export class DownloadsCleaner extends BaseCleaner {
  readonly id = 'downloads';
  readonly name = 'Downloads';
  readonly description =
    'Files in ~/Downloads. Requires explicit confirmation. ClrX never auto-deletes Downloads.';
  readonly safety = SafetyLevel.CONFIRMATION_REQUIRED;

  protected getTargetPaths(): string[] {
    return [this.homeJoin('Downloads')];
  }

  override async scan(): Promise<ScanResult> {
    this.registerTargets();

    const downloadsPath = this.homeJoin('Downloads');
    const exists = await pathExists(downloadsPath);

    if (!exists) {
      return {
        cleanerId: this.id,
        name: this.name,
        sizeBytes: 0,
        itemCount: 0,
        safety: this.safety,
        isAvailable: false,
        note: 'Downloads folder not found',
        paths: [],
      };
    }

    const sizeBytes = await getPathSizeBytes(downloadsPath);

    // Get top 10 largest items for informational display
    let topItems: string[] = [];
    try {
      const { stdout } = await execFileAsync('/usr/bin/du', ['-sh', '--', downloadsPath]);
      topItems = [stdout.trim()];
    } catch {
      topItems = [];
    }

    logger.verbose(`Downloads top items: ${topItems.join(', ')}`);

    return {
      cleanerId: this.id,
      name: this.name,
      sizeBytes,
      itemCount: 0, // We don't eagerly count — it can be large
      safety: this.safety,
      isAvailable: true,
      note: 'Requires explicit confirmation — ClrX will not auto-delete Downloads',
      paths: [{ path: downloadsPath, sizeBytes, exists: true }],
    };
  }

  /**
   * Downloads are never deleted automatically.
   * Even with --yes, this cleaner returns a skip result.
   * Users must explicitly invoke this with --yes AND --category downloads.
   */
  override async clean(options: CleanOptions): Promise<CleanResult> {
    // Downloads are never auto-cleaned — this is intentional
    logger.info('  ℹ Downloads require explicit manual review.');
    logger.info("    Use 'clrx info' to inspect Downloads contents.");

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
          path: this.homeJoin('Downloads'),
          sizeBytes: 0,
          status: 'skipped',
          reason: 'Downloads require manual review — not auto-cleaned',
        },
      ],
    };
  }
}

export const downloadsCleaner = new DownloadsCleaner();

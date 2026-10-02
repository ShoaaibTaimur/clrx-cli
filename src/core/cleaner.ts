// ============================================================
// ClrX — Cleaner Engine
// ============================================================
import type { Cleaner, CleanOptions, CleanResult } from '../types/cleaner.js';
import { SafetyLevel } from '../types/cleaner.js';
import logger from '../utils/logger.js';
import { formatBytes } from '../utils/size.js';

export interface CleanSummary {
  totalBytesFreed: number;
  totalRemoved: number;
  totalSkipped: number;
  totalFailed: number;
  results: CleanResult[];
  dryRun: boolean;
}

/**
 * Run cleanup on a set of cleaners.
 */
export async function runClean(cleaners: Cleaner[], options: CleanOptions): Promise<CleanSummary> {
  const results: CleanResult[] = [];

  for (const cleaner of cleaners) {
    // Skip PROTECTED cleaners always
    if (cleaner.safety === SafetyLevel.PROTECTED) {
      logger.verbose(`Skipping protected cleaner: ${cleaner.name}`);
      continue;
    }

    // Check availability
    const available = await cleaner.isAvailable();
    if (!available) {
      logger.verbose(`${cleaner.name}: Not available — skipped`);
      continue;
    }

    try {
      logger.verbose(`Running cleaner: ${cleaner.name}`);
      const result = await cleaner.clean(options);
      results.push(result);

      if (!options.quiet) {
        if (result.dryRun) {
          logger.info(`  [DRY RUN] ${result.name}: would remove ${formatBytes(result.bytesFreed)}`);
        } else if (result.bytesFreed > 0) {
          logger.success(`${result.name}: freed ${formatBytes(result.bytesFreed)}`);
        } else if (result.skipped > 0) {
          logger.info(`  ${result.name}: nothing to clean`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`${cleaner.name} failed: ${msg}`);
      results.push({
        cleanerId: cleaner.id,
        name: cleaner.name,
        bytesFreed: 0,
        removed: 0,
        skipped: 0,
        failed: 1,
        dryRun: options.dryRun,
        errors: [{ path: '', message: msg }],
        actions: [],
      });
    }
  }

  const summary: CleanSummary = {
    totalBytesFreed: results.reduce((s, r) => s + r.bytesFreed, 0),
    totalRemoved: results.reduce((s, r) => s + r.removed, 0),
    totalSkipped: results.reduce((s, r) => s + r.skipped, 0),
    totalFailed: results.reduce((s, r) => s + r.failed, 0),
    results,
    dryRun: options.dryRun,
  };

  return summary;
}

/**
 * Print a clean summary to the terminal.
 */
export function printCleanSummary(summary: CleanSummary): void {
  logger.blank();

  if (summary.dryRun) {
    logger.info('── Dry Run Complete ──────────────────────────');
    logger.info(`  Estimated reclaimable: ${formatBytes(summary.totalBytesFreed)}`);
  } else {
    logger.info('── Cleanup Complete ──────────────────────────');
    logger.success(`Removed: ${formatBytes(summary.totalBytesFreed)}`);
  }

  if (summary.totalSkipped > 0) {
    logger.info(`  Skipped: ${summary.totalSkipped} items`);
  }
  if (summary.totalFailed > 0) {
    logger.warn(`Failed: ${summary.totalFailed} items`);
  }

  logger.blank();
  logger.info("  Run 'clrx scan' to inspect remaining reclaimable space.");
  logger.blank();
}

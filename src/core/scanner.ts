// ============================================================
// ClrX — Scanner Engine
// ============================================================
import type { Cleaner, ScanResult, ScanSummary } from '../types/cleaner.js';
import { getArchitecture } from '../utils/platform.js';
import logger from '../utils/logger.js';

export interface ScanOptions {
  /** Only scan specific cleaner ids */
  only?: string[];
}

/**
 * Run all cleaners' scan() in parallel and aggregate results.
 */
export async function runScan(
  cleaners: Cleaner[],
  options: ScanOptions = {},
): Promise<ScanResult[]> {
  let targets = cleaners;

  if (options.only && options.only.length > 0) {
    targets = cleaners.filter((c) => options.only!.includes(c.id));
  }

  const results = await Promise.allSettled(targets.map((c) => c.scan()));

  const scanResults: ScanResult[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const cleaner = targets[i];

    if (result.status === 'fulfilled') {
      scanResults.push(result.value);
    } else {
      logger.verbose(`Scan failed for ${cleaner.name}: ${result.reason}`);
      // Push a zero-size placeholder so the cleaner still shows up
      scanResults.push({
        cleanerId: cleaner.id,
        name: cleaner.name,
        sizeBytes: 0,
        itemCount: 0,
        safety: cleaner.safety,
        isAvailable: false,
        note: `Scan error: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        paths: [],
      });
    }
  }

  return scanResults;
}

/**
 * Aggregate scan results into a JSON-serializable summary.
 */
export function buildScanSummary(results: ScanResult[]): ScanSummary {
  const totalReclaimableBytes = results
    .filter((r) => r.isAvailable)
    .reduce((sum, r) => sum + r.sizeBytes, 0);

  return {
    platform: process.platform,
    architecture: getArchitecture(),
    scannedAt: new Date().toISOString(),
    categories: results.map((r) => ({
      id: r.cleanerId,
      name: r.name,
      sizeBytes: r.sizeBytes,
      itemCount: r.itemCount,
      safety: r.safety,
      isAvailable: r.isAvailable,
      note: r.note,
    })),
    totalReclaimableBytes,
  };
}

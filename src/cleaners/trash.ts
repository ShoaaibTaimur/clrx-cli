// ============================================================
// ClrX — Trash Cleaner
// Targets: ~/.Trash and /Volumes/*/.Trashes/<uid>
// Safety: CAUTION — trash can contain user-created files
// ============================================================
import path from 'node:path';
import fsp from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SafetyLevel } from '../types/cleaner.js';
import type { CleanOptions, CleanResult, ScanResult, PathScanResult } from '../types/cleaner.js';
import { BaseCleaner } from './base.js';
import {
  pathExists,
  getPathSizeBytes,
  countDirectChildren,
  clearDirectoryContents,
} from '../core/filesystem.js';
import { validateDeletionTarget, registerCleanupTarget } from '../core/safety.js';
import { getCurrentUID, getMountedVolumes } from '../utils/platform.js';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

interface FinderTrashItem {
  name: string;
  sizeBytes: number;
}

/**
 * Retrieve trash items and sizes via macOS Finder AppleScript.
 * Used as a fallback when Terminal / Node lacks Full Disk Access to ~/.Trash.
 */
async function getFinderTrashItems(): Promise<FinderTrashItem[]> {
  try {
    const script = `
      tell application "Finder"
        set nameList to name of every item of trash
        set sizeList to {}
        repeat with aName in nameList
          try
            set aSize to size of item aName of trash
            set end of sizeList to (aName & "::" & (aSize as integer))
          on error
            set end of sizeList to (aName & "::0")
          end try
        end repeat
        set AppleScript's text item delimiters to linefeed
        return sizeList as string
      end tell
    `;
    const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', script]);
    const lines = stdout.trim().split('\n').filter(Boolean);
    const items: FinderTrashItem[] = [];
    for (const line of lines) {
      const idx = line.lastIndexOf('::');
      if (idx !== -1) {
        const name = line.slice(0, idx);
        const sizeBytes = parseInt(line.slice(idx + 2), 10) || 0;
        items.push({ name, sizeBytes });
      }
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * Empty trash via macOS Finder AppleScript.
 */
async function emptyFinderTrash(): Promise<boolean> {
  try {
    const script = `
      tell application "Finder"
        set originalWarn to warns before emptying of trash
        set warns before emptying of trash to false
        try
          empty trash
        end try
        set warns before emptying of trash to originalWarn
      end tell
    `;
    await execFileAsync('/usr/bin/osascript', ['-e', script]);
    return true;
  } catch {
    return false;
  }
}

export class TrashCleaner extends BaseCleaner {
  readonly id = 'trash';
  readonly name = 'Trash';
  readonly description = 'macOS Trash on all detected volumes. Contents are permanently deleted.';
  readonly safety = SafetyLevel.CAUTION;

  protected getTargetPaths(): string[] {
    // The main trash is always registered; volume trash paths are dynamic
    return [this.homeJoin('.Trash')];
  }

  /**
   * Get all trash paths including external volumes.
   */
  private async getAllTrashPaths(): Promise<string[]> {
    const uid = await getCurrentUID();
    const paths: string[] = [this.homeJoin('.Trash')];

    const volumes = await getMountedVolumes();
    for (const vol of volumes) {
      const trashPath = path.join(vol, '.Trashes', uid);
      paths.push(trashPath);
    }

    return paths;
  }

  override async isAvailable(): Promise<boolean> {
    const trashPath = this.homeJoin('.Trash');
    return pathExists(trashPath);
  }

  override async scan(): Promise<ScanResult> {
    this.registerTargets();

    const trashPaths = await this.getAllTrashPaths();
    const pathResults: PathScanResult[] = [];
    let totalBytes = 0;
    let totalItems = 0;

    for (const tp of trashPaths) {
      // Register dynamically discovered volume trash paths
      registerCleanupTarget(tp);

      const exists = await pathExists(tp);
      if (!exists) {
        pathResults.push({ path: tp, sizeBytes: 0, exists: false });
        continue;
      }

      let sizeBytes = 0;
      let itemCount = 0;

      // Check if direct readdir is permitted
      let canReadDirect = false;
      try {
        await fsp.readdir(tp);
        canReadDirect = true;
      } catch {
        canReadDirect = false;
      }

      if (canReadDirect) {
        sizeBytes = await getPathSizeBytes(tp);
        itemCount = await countDirectChildren(tp);
      } else if (tp === this.homeJoin('.Trash')) {
        // macOS TCC sandbox protection fallback via Finder
        const finderItems = await getFinderTrashItems();
        itemCount = finderItems.length;
        sizeBytes = finderItems.reduce((acc, item) => acc + item.sizeBytes, 0);
      }

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
      paths: pathResults,
    };
  }

  override async clean(options: CleanOptions): Promise<CleanResult> {
    this.registerTargets();

    const trashPaths = await this.getAllTrashPaths();
    const actions: CleanResult['actions'] = [];
    const errors: CleanResult['errors'] = [];
    let bytesFreed = 0;
    let removed = 0;
    let skipped = 0;
    let failed = 0;

    for (const tp of trashPaths) {
      // Register dynamically discovered paths
      registerCleanupTarget(tp);

      if (!(await pathExists(tp))) {
        skipped++;
        continue;
      }

      const validation = await validateDeletionTarget(tp);
      if (!validation.safe) {
        skipped++;
        logger.warn(`Skipped trash path: ${tp}\n  Reason: ${validation.reason}`);
        continue;
      }

      let canReadDirect = false;
      try {
        await fsp.readdir(tp);
        canReadDirect = true;
      } catch {
        canReadDirect = false;
      }

      if (canReadDirect) {
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
      } else if (tp === this.homeJoin('.Trash')) {
        // macOS TCC sandbox protection fallback via Finder
        const finderItems = await getFinderTrashItems();
        const totalFinderBytes = finderItems.reduce((acc, i) => acc + i.sizeBytes, 0);

        if (options.dryRun) {
          for (const item of finderItems) {
            const p = path.join(tp, item.name);
            actions.push({ path: p, sizeBytes: item.sizeBytes, status: 'would-remove' });
            bytesFreed += item.sizeBytes;
          }
          removed += finderItems.length;
        } else {
          const emptied = await emptyFinderTrash();
          if (emptied) {
            for (const item of finderItems) {
              const p = path.join(tp, item.name);
              actions.push({ path: p, sizeBytes: item.sizeBytes, status: 'removed' });
              removed++;
            }
            bytesFreed += totalFinderBytes;
          } else {
            failed += finderItems.length;
            errors.push({ path: tp, message: 'Could not empty Trash via Finder' });
            actions.push({
              path: tp,
              sizeBytes: 0,
              status: 'failed',
              reason: 'Could not empty Trash via Finder',
            });
          }
        }
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

export const trashCleaner = new TrashCleaner();

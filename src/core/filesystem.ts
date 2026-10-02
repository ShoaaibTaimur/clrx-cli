// ============================================================
// ClrX — Filesystem Core
// ============================================================
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

/**
 * Check if a path exists and is accessible.
 */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a path is a directory.
 */
export async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fsp.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get the total size of a path in bytes using `du`.
 * Returns 0 if path doesn't exist or access is denied.
 *
 * Uses macOS `du -sk` (512-byte blocks → convert to bytes).
 */
export async function getPathSizeBytes(p: string): Promise<number> {
  try {
    await fsp.access(p, fs.constants.R_OK);
  } catch {
    return 0;
  }

  let output = '';
  try {
    // du -sk gives size in 1024-byte blocks on macOS
    const { stdout } = await execFileAsync('/usr/bin/du', ['-sk', p]);
    output = stdout;
  } catch (err: unknown) {
    // du exits with code 1 if any subpath is unreadable (e.g. SIP/TCC protected dirs in ~/Library/Caches)
    // but still outputs the readable total on stdout
    if (err && typeof err === 'object' && 'stdout' in err && typeof err.stdout === 'string') {
      output = err.stdout;
    }
  }

  const match = output.trim().match(/(\d+)\s+[^\n]*$/);
  if (match) {
    return parseInt(match[1], 10) * 1024;
  }
  return 0;
}

/**
 * Count the number of direct children (files + dirs) in a directory.
 * Returns 0 if not accessible.
 */
export async function countDirectChildren(dirPath: string): Promise<number> {
  try {
    const entries = await fsp.readdir(dirPath);
    return entries.length;
  } catch {
    return 0;
  }
}

/**
 * List direct children of a directory with their paths.
 */
export async function listDirectChildren(dirPath: string): Promise<string[]> {
  try {
    const entries = await fsp.readdir(dirPath);
    return entries.map((e) => path.join(dirPath, e));
  } catch {
    return [];
  }
}

/**
 * Resolve and normalize a path.
 */
export function resolvePath(p: string): string {
  return path.resolve(p.replace(/^~/, process.env.HOME ?? ''));
}

/**
 * Resolve symlinks fully.
 * Returns null if resolution fails.
 */
export async function realPath(p: string): Promise<string | null> {
  try {
    return await fsp.realpath(p);
  } catch {
    return null;
  }
}

/**
 * Remove a path (file or directory) permanently.
 * Uses Node.js fs.rm — no shell interpolation.
 */
export async function removePath(p: string): Promise<{ success: boolean; error?: string }> {
  try {
    await fsp.rm(p, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Remove all direct children of a directory, preserving the directory itself.
 * Returns counts of { removed, failed }.
 */
export async function clearDirectoryContents(
  dirPath: string,
  dryRun = false,
): Promise<{ removed: string[]; failed: Array<{ path: string; error: string }> }> {
  const removed: string[] = [];
  const failed: Array<{ path: string; error: string }> = [];

  if (!(await isDirectory(dirPath))) {
    return { removed, failed };
  }

  let children: string[];
  try {
    const entries = await fsp.readdir(dirPath);
    children = entries.map((e) => path.join(dirPath, e));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.verbose(`Could not read directory ${dirPath}: ${msg}`);
    return { removed, failed };
  }

  for (const child of children) {
    if (dryRun) {
      removed.push(child);
      continue;
    }

    const result = await removePath(child);
    if (result.success) {
      removed.push(child);
    } else {
      failed.push({ path: child, error: result.error ?? 'Unknown error' });
      logger.verbose(`⚠ Skipped: ${child}\n  Reason: ${result.error}`);
    }
  }

  return { removed, failed };
}

/**
 * Get sizes of multiple paths in parallel, capped for performance.
 */
export async function getMultiplePathSizes(paths: string[]): Promise<Map<string, number>> {
  const results = await Promise.all(
    paths.map(async (p) => [p, await getPathSizeBytes(p)] as [string, number]),
  );
  return new Map(results);
}

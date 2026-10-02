// ============================================================
// ClrX — Permissions Checker
// ============================================================
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import logger from '../utils/logger.js';

export interface PermissionCheckResult {
  path: string;
  readable: boolean;
  writable: boolean;
  exists: boolean;
  error?: string;
}

/**
 * Check read/write permissions for a path.
 */
export async function checkPermissions(p: string): Promise<PermissionCheckResult> {
  let exists = false;
  let readable = false;
  let writable = false;
  let error: string | undefined;

  try {
    await fsp.access(p, fs.constants.F_OK);
    exists = true;
  } catch {
    return { path: p, readable: false, writable: false, exists: false };
  }

  try {
    await fsp.access(p, fs.constants.R_OK);
    readable = true;
  } catch {
    error = `Read permission denied: ${p}`;
    logger.verbose(error);
  }

  try {
    await fsp.access(p, fs.constants.W_OK);
    writable = true;
  } catch {
    if (!error) error = `Write permission denied: ${p}`;
    logger.verbose(`Write permission denied: ${p}`);
  }

  return { path: p, readable, writable, exists, error };
}

/**
 * Check if ClrX is running with elevated (root) privileges.
 * ClrX should never require or assume root.
 */
export function isRunningAsRoot(): boolean {
  return process.getuid?.() === 0;
}

/**
 * Warn if running as root — ClrX does not need it.
 */
export function warnIfRoot(): void {
  if (isRunningAsRoot()) {
    logger.warn('ClrX is running as root. This is not recommended.');
    logger.warn('ClrX is designed to run as a normal user.');
  }
}

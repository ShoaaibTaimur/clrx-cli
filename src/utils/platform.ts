// ============================================================
// ClrX — Platform Utilities
// ============================================================
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const execFileAsync = promisify(execFile);

/**
 * Assert that we're running on macOS. Exits with an error otherwise.
 */
export function assertMacOS(): void {
  if (process.platform !== 'darwin') {
    process.stderr.write('ClrX only supports macOS.\n');
    process.exit(1);
  }
}

/**
 * Returns true if macOS (darwin).
 */
export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/**
 * Returns 'arm64' or 'x64' (or other).
 */
export function getArchitecture(): string {
  return os.arch();
}

/**
 * Returns the current user's home directory.
 */
export function getHomeDir(): string {
  return os.homedir();
}

/**
 * Returns the current user's numeric UID.
 */
export async function getCurrentUID(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('/usr/bin/id', ['-u']);
    return stdout.trim();
  } catch {
    return '501'; // fallback default UID
  }
}

/**
 * Check if a CLI tool is available in PATH.
 */
export async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync('/usr/bin/which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all mounted volume paths from /Volumes.
 */
export async function getMountedVolumes(): Promise<string[]> {
  try {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir('/Volumes', { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => `/Volumes/${e.name}`);
  } catch {
    return [];
  }
}

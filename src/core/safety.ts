// ============================================================
// ClrX — Safety System
// ============================================================
import path from 'node:path';
import os from 'node:os';
import { realPath } from './filesystem.js';
import { SafetyLevel } from '../types/cleaner.js';

// Paths that must NEVER be deleted by ClrX
const PROTECTED_ABSOLUTE_PATHS = new Set([
  '/',
  '/System',
  '/Library',
  '/usr',
  '/bin',
  '/sbin',
  '/etc',
  '/var',
  '/private',
  '/Applications',
  '/cores',
]);

// Home-relative paths that must NEVER be deleted
const PROTECTED_HOME_RELATIVE = [
  'Documents',
  'Desktop',
  'Pictures',
  'Movies',
  'Music',
  'Public',
  '.ssh',
  '.gnupg',
  '.aws',
  '.config',
  '.local',
  'Library/Keychains',
  'Library/Application Support', // general — specific subdirs are allowed via cleaners
  'Library/Preferences',
  'Library/Cookies',
  'Library/Saved Application State',
  'Library/Safari', // history/bookmarks — cache subdir is fine
];

/**
 * Registered cleanup targets — only these root paths can be operated on.
 */
const registeredTargets = new Set<string>();

/**
 * Register a path as a legitimate cleanup target.
 * Must be called by each cleaner during initialization.
 */
export function registerCleanupTarget(resolvedPath: string): void {
  registeredTargets.add(normalizePath(resolvedPath));
}

/**
 * Clear all registered targets (for testing).
 */
export function clearRegisteredTargets(): void {
  registeredTargets.clear();
}

/**
 * Get all currently registered targets.
 */
export function getRegisteredTargets(): ReadonlySet<string> {
  return registeredTargets;
}

/**
 * Normalize a path: resolve, strip trailing slash.
 */
export function normalizePath(p: string): string {
  return path.normalize(path.resolve(p)).replace(/\/+$/, '');
}

/**
 * Check if a given path is inside one of the protected absolute paths.
 */
export function isAbsoluteProtectedPath(resolvedPath: string): boolean {
  // Handle bare '/' before normalization strips it
  const stripped = resolvedPath.replace(/\/+$/, '') || '/';
  const normalized = path.normalize(path.resolve(stripped));

  if (normalized === '/') return true;

  for (const protected_ of PROTECTED_ABSOLUTE_PATHS) {
    if (normalized === protected_ || normalized.startsWith(protected_ + '/')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a given path is inside one of the protected home-relative paths.
 */
export function isHomeProtectedPath(resolvedPath: string): boolean {
  const home = os.homedir();
  const normalized = normalizePath(resolvedPath);

  for (const rel of PROTECTED_HOME_RELATIVE) {
    const full = normalizePath(path.join(home, rel));
    if (normalized === full || normalized.startsWith(full + '/')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a path is exactly the home directory.
 */
export function isHomeDirectory(resolvedPath: string): boolean {
  return normalizePath(resolvedPath) === normalizePath(os.homedir());
}

/**
 * Validate that a path traversal is not occurring.
 * Rejects '..', null bytes, and other suspicious patterns.
 */
export function hasPathTraversal(p: string): boolean {
  if (p.includes('\0')) return true;
  // Check raw string for '..' segments before normalization collapses them
  if (p.includes('..')) return true;
  return false;
}

/**
 * Check whether a target path is a registered cleanup target.
 * A path is valid if it is equal to a registered target or is a direct
 * child of a registered target (depth 1 only — no deeper).
 */
export function isRegisteredTarget(resolvedPath: string): boolean {
  const normalized = normalizePath(resolvedPath);

  // Exact match
  if (registeredTargets.has(normalized)) return true;

  // Direct parent must be a registered target
  const parent = normalizePath(path.dirname(normalized));
  return registeredTargets.has(parent);
}

/**
 * Full safety validation before any deletion.
 *
 * Returns { safe: true } or { safe: false, reason: string }.
 */
export async function validateDeletionTarget(
  rawPath: string,
): Promise<{ safe: true } | { safe: false; reason: string }> {
  // 1. Reject path traversal
  if (hasPathTraversal(rawPath)) {
    return { safe: false, reason: 'Path traversal detected' };
  }

  // 2. Resolve the path
  const normalized = normalizePath(rawPath);

  // 3. Reject root
  if (normalized === '/') {
    return { safe: false, reason: 'Refusing to delete root directory' };
  }

  // 4. Reject home directory itself
  if (isHomeDirectory(normalized)) {
    return { safe: false, reason: 'Refusing to delete home directory' };
  }

  // 5. Reject absolute protected paths
  if (isAbsoluteProtectedPath(normalized)) {
    return { safe: false, reason: `Protected system path: ${normalized}` };
  }

  // 6. Reject home-protected paths
  if (isHomeProtectedPath(normalized)) {
    return { safe: false, reason: `Protected user path: ${normalized}` };
  }

  // 7. Check if the path is a registered cleanup target
  if (!isRegisteredTarget(normalized)) {
    return {
      safe: false,
      reason: `Path is not a registered cleanup target: ${normalized}`,
    };
  }

  // 8. Resolve symlinks and re-check
  const real = await realPath(normalized);
  if (real && real !== normalized) {
    // The symlink resolves somewhere else — validate that destination too
    if (isAbsoluteProtectedPath(real)) {
      return {
        safe: false,
        reason: `Symlink resolves to protected path: ${real}`,
      };
    }
    if (isHomeDirectory(real)) {
      return {
        safe: false,
        reason: `Symlink resolves to home directory: ${real}`,
      };
    }
  }

  return { safe: true };
}

/**
 * Get the safety label color for display.
 */
export function safetyLevelToString(level: SafetyLevel): string {
  switch (level) {
    case SafetyLevel.SAFE:
      return 'SAFE';
    case SafetyLevel.CAUTION:
      return 'CAUTION';
    case SafetyLevel.CONFIRMATION_REQUIRED:
      return 'CONFIRMATION REQUIRED';
    case SafetyLevel.PROTECTED:
      return 'PROTECTED';
  }
}

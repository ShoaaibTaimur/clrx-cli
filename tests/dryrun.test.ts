// ============================================================
// ClrX — Dry-Run Tests
// Critical: verify dry-run NEVER deletes anything
// ============================================================
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { registerCleanupTarget, clearRegisteredTargets } from '../src/core/safety.js';
import { clearDirectoryContents } from '../src/core/filesystem.js';

let testDir: string;

beforeEach(async () => {
  // Create a temporary directory for each test
  testDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'clrx-test-'));

  // Create some test files
  await fsp.writeFile(path.join(testDir, 'file1.txt'), 'test content 1');
  await fsp.writeFile(path.join(testDir, 'file2.txt'), 'test content 2');
  await fsp.mkdir(path.join(testDir, 'subdir'));
  await fsp.writeFile(path.join(testDir, 'subdir', 'nested.txt'), 'nested');

  // Register the test dir as a valid cleanup target
  clearRegisteredTargets();
  registerCleanupTarget(testDir);
});

afterEach(async () => {
  // Clean up test dir
  clearRegisteredTargets();
  try {
    await fsp.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe('dry-run NEVER deletes', () => {
  it('dry-run leaves files intact', async () => {
    const { removed } = await clearDirectoryContents(testDir, true /* dryRun */);

    // Files reported as "would remove"
    expect(removed.length).toBeGreaterThan(0);

    // But files still exist
    expect(fs.existsSync(path.join(testDir, 'file1.txt'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'file2.txt'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'subdir'))).toBe(true);
  });

  it('non-dry-run removes files', async () => {
    const { removed } = await clearDirectoryContents(testDir, false);

    expect(removed.length).toBeGreaterThan(0);

    // Files should be gone
    expect(fs.existsSync(path.join(testDir, 'file1.txt'))).toBe(false);
    expect(fs.existsSync(path.join(testDir, 'file2.txt'))).toBe(false);
    expect(fs.existsSync(path.join(testDir, 'subdir'))).toBe(false);

    // But the directory itself remains
    expect(fs.existsSync(testDir)).toBe(true);
  });

  it('dry-run returns the same paths that would be removed', async () => {
    const { removed: wouldRemove } = await clearDirectoryContents(testDir, true);
    const entries = await fsp.readdir(testDir);
    const expectedPaths = entries.map((e) => path.join(testDir, e)).sort();

    expect(wouldRemove.sort()).toEqual(expectedPaths);
  });
});

describe('missing directory handling', () => {
  it('gracefully handles non-existent directory', async () => {
    const nonExistent = path.join(os.tmpdir(), 'clrx-does-not-exist-' + Date.now());
    const { removed, failed } = await clearDirectoryContents(nonExistent, false);
    expect(removed).toHaveLength(0);
    expect(failed).toHaveLength(0);
  });

  it('dry-run on non-existent directory returns empty', async () => {
    const nonExistent = path.join(os.tmpdir(), 'clrx-does-not-exist-' + Date.now());
    const { removed } = await clearDirectoryContents(nonExistent, true);
    expect(removed).toHaveLength(0);
  });
});

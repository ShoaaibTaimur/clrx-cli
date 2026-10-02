// ============================================================
// ClrX — Safety System Tests
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import {
  isAbsoluteProtectedPath,
  isHomeProtectedPath,
  isHomeDirectory,
  hasPathTraversal,
  registerCleanupTarget,
  isRegisteredTarget,
  clearRegisteredTargets,
  validateDeletionTarget,
} from '../src/core/safety.js';

const HOME = os.homedir();

describe('isAbsoluteProtectedPath', () => {
  it('protects root', () => {
    expect(isAbsoluteProtectedPath('/')).toBe(true);
  });

  it('protects /System', () => {
    expect(isAbsoluteProtectedPath('/System')).toBe(true);
    expect(isAbsoluteProtectedPath('/System/Library')).toBe(true);
  });

  it('protects /Library', () => {
    expect(isAbsoluteProtectedPath('/Library')).toBe(true);
  });

  it('does not protect arbitrary paths', () => {
    expect(isAbsoluteProtectedPath('/tmp/test')).toBe(false);
    expect(isAbsoluteProtectedPath(path.join(HOME, 'Library', 'Caches'))).toBe(false);
  });
});

describe('isHomeProtectedPath', () => {
  it('protects Documents', () => {
    expect(isHomeProtectedPath(path.join(HOME, 'Documents'))).toBe(true);
    expect(isHomeProtectedPath(path.join(HOME, 'Documents', 'important.pdf'))).toBe(true);
  });

  it('protects Desktop', () => {
    expect(isHomeProtectedPath(path.join(HOME, 'Desktop'))).toBe(true);
  });

  it('protects SSH keys', () => {
    expect(isHomeProtectedPath(path.join(HOME, '.ssh'))).toBe(true);
    expect(isHomeProtectedPath(path.join(HOME, '.ssh', 'id_rsa'))).toBe(true);
  });

  it('protects Keychain', () => {
    expect(isHomeProtectedPath(path.join(HOME, 'Library', 'Keychains'))).toBe(true);
  });

  it('does not protect Caches', () => {
    expect(isHomeProtectedPath(path.join(HOME, 'Library', 'Caches'))).toBe(false);
  });

  it('does not protect Logs', () => {
    expect(isHomeProtectedPath(path.join(HOME, 'Library', 'Logs'))).toBe(false);
  });
});

describe('isHomeDirectory', () => {
  it('detects home directory', () => {
    expect(isHomeDirectory(HOME)).toBe(true);
  });

  it('does not flag subdirectories', () => {
    expect(isHomeDirectory(path.join(HOME, 'Library'))).toBe(false);
  });
});

describe('hasPathTraversal', () => {
  it('detects .. patterns', () => {
    expect(hasPathTraversal('../etc/passwd')).toBe(true);
    expect(hasPathTraversal('/tmp/../../etc')).toBe(true);
  });

  it('detects null bytes', () => {
    expect(hasPathTraversal('/tmp/test\0.txt')).toBe(true);
  });

  it('allows normal paths', () => {
    expect(hasPathTraversal('/tmp/test')).toBe(false);
    expect(hasPathTraversal(path.join(HOME, 'Library', 'Caches'))).toBe(false);
  });
});

describe('registered targets', () => {
  beforeEach(() => {
    clearRegisteredTargets();
  });

  it('allows registered targets', () => {
    const target = path.join(HOME, 'Library', 'Caches');
    registerCleanupTarget(target);
    expect(isRegisteredTarget(target)).toBe(true);
  });

  it('allows children of registered targets', () => {
    const target = path.join(HOME, 'Library', 'Caches');
    registerCleanupTarget(target);
    const child = path.join(target, 'com.apple.example');
    expect(isRegisteredTarget(child)).toBe(true);
  });

  it('rejects unregistered paths', () => {
    expect(isRegisteredTarget(path.join(HOME, 'Documents'))).toBe(false);
  });
});

describe('validateDeletionTarget', () => {
  beforeEach(() => {
    clearRegisteredTargets();
  });

  it('rejects root', async () => {
    const result = await validateDeletionTarget('/');
    expect(result.safe).toBe(false);
  });

  it('rejects home directory', async () => {
    const result = await validateDeletionTarget(HOME);
    expect(result.safe).toBe(false);
  });

  it('rejects /System paths', async () => {
    const result = await validateDeletionTarget('/System/Library');
    expect(result.safe).toBe(false);
  });

  it('rejects Documents', async () => {
    const result = await validateDeletionTarget(path.join(HOME, 'Documents'));
    expect(result.safe).toBe(false);
  });

  it('rejects .ssh', async () => {
    const result = await validateDeletionTarget(path.join(HOME, '.ssh'));
    expect(result.safe).toBe(false);
  });

  it('rejects path traversal', async () => {
    const result = await validateDeletionTarget('../etc/passwd');
    expect(result.safe).toBe(false);
  });

  it('rejects unregistered paths', async () => {
    const result = await validateDeletionTarget(path.join(HOME, 'Library', 'Caches'));
    // Even Caches — not registered yet
    expect(result.safe).toBe(false);
  });

  it('allows registered Caches path', async () => {
    const cachesPath = path.join(HOME, 'Library', 'Caches');
    registerCleanupTarget(cachesPath);
    const result = await validateDeletionTarget(cachesPath);
    expect(result.safe).toBe(true);
  });
});

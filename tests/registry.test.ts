// ============================================================
// ClrX — Registry Tests
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';
import { CleanerRegistry } from '../src/core/registry-test-helper.js';
import type { Cleaner, CleanOptions, CleanResult, ScanResult } from '../src/types/cleaner.js';
import { SafetyLevel } from '../src/types/cleaner.js';

// Create a mock cleaner for testing
function makeMockCleaner(id: string): Cleaner {
  return {
    id,
    name: `Mock Cleaner ${id}`,
    description: 'A test cleaner',
    safety: SafetyLevel.SAFE,
    isAvailable: async () => true,
    scan: async (): Promise<ScanResult> => ({
      cleanerId: id,
      name: `Mock Cleaner ${id}`,
      sizeBytes: 1024,
      itemCount: 1,
      safety: SafetyLevel.SAFE,
      isAvailable: true,
      paths: [],
    }),
    clean: async (_opts: CleanOptions): Promise<CleanResult> => ({
      cleanerId: id,
      name: `Mock Cleaner ${id}`,
      bytesFreed: 0,
      removed: 0,
      skipped: 0,
      failed: 0,
      dryRun: _opts.dryRun,
      errors: [],
      actions: [],
    }),
  };
}

// We need a test-only registry class — let's test its behavior
describe('CleanerRegistry', () => {
  let reg: InstanceType<typeof CleanerRegistry>;

  beforeEach(() => {
    reg = new CleanerRegistry();
  });

  it('registers cleaners', () => {
    const c = makeMockCleaner('test-1');
    reg.register(c);
    expect(reg.has('test-1')).toBe(true);
    expect(reg.size).toBe(1);
  });

  it('throws on duplicate registration', () => {
    const c = makeMockCleaner('test-1');
    reg.register(c);
    expect(() => reg.register(c)).toThrow();
  });

  it('getAll returns all cleaners', () => {
    reg.register(makeMockCleaner('a'));
    reg.register(makeMockCleaner('b'));
    expect(reg.getAll()).toHaveLength(2);
  });

  it('get returns undefined for unknown id', () => {
    expect(reg.get('nonexistent')).toBeUndefined();
  });

  it('getMany throws for unknown ids', () => {
    reg.register(makeMockCleaner('a'));
    expect(() => reg.getMany(['a', 'nonexistent'])).toThrow();
  });

  it('clear empties the registry', () => {
    reg.register(makeMockCleaner('a'));
    reg.clear();
    expect(reg.size).toBe(0);
  });
});

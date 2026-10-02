// ============================================================
// ClrX — Update Checker Tests
// ============================================================
import { describe, it, expect } from 'vitest';
import { isNewer } from '../src/utils/update-check.js';

describe('isNewer', () => {
  it('returns true when remote major is higher', () => {
    expect(isNewer('1.0.0', '2.0.0')).toBe(true);
  });

  it('returns true when remote minor is higher', () => {
    expect(isNewer('1.0.0', '1.1.0')).toBe(true);
  });

  it('returns true when remote patch is higher', () => {
    expect(isNewer('1.0.0', '1.0.1')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false);
  });

  it('returns false when current is newer (major)', () => {
    expect(isNewer('2.0.0', '1.9.9')).toBe(false);
  });

  it('returns false when current is newer (minor)', () => {
    expect(isNewer('1.5.0', '1.4.9')).toBe(false);
  });

  it('returns false when current is newer (patch)', () => {
    expect(isNewer('1.0.5', '1.0.4')).toBe(false);
  });

  it('handles v-prefixed versions', () => {
    expect(isNewer('v1.0.0', 'v1.0.1')).toBe(true);
    expect(isNewer('v1.0.1', 'v1.0.0')).toBe(false);
  });

  it('handles mixed v-prefix', () => {
    expect(isNewer('1.0.0', 'v1.0.1')).toBe(true);
  });

  it('correctly handles multi-digit version numbers', () => {
    expect(isNewer('1.0.9', '1.0.10')).toBe(true);
    expect(isNewer('1.9.0', '1.10.0')).toBe(true);
  });
});

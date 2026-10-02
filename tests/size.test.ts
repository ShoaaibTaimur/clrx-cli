// ============================================================
// ClrX — Size Formatting Tests
// ============================================================
import { describe, it, expect } from 'vitest';
import { formatBytes, parseBytes } from '../src/utils/size.js';

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1536)).toBe('1.50 KB');
    expect(formatBytes(10240)).toBe('10.00 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1024 * 1024 * 42.8)).toMatch(/42\.\d+ MB/);
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1024 ** 3)).toBe('1.00 GB');
    expect(formatBytes(1024 ** 3 * 2.41)).toMatch(/2\.41 GB/);
  });

  it('formats terabytes', () => {
    expect(formatBytes(1024 ** 4)).toBe('1.00 TB');
    expect(formatBytes(1024 ** 4 * 1.5)).toMatch(/1\.50 TB/);
  });

  it('handles negative values by treating as 0', () => {
    expect(formatBytes(-100)).toBe('0 B');
  });
});

describe('parseBytes', () => {
  it('parses B', () => {
    expect(parseBytes('512 B')).toBe(512);
  });

  it('parses KB', () => {
    expect(parseBytes('1.00 KB')).toBe(1024);
  });

  it('parses MB', () => {
    expect(parseBytes('1.00 MB')).toBe(1024 * 1024);
  });

  it('parses GB', () => {
    expect(parseBytes('2.41 GB')).toBeCloseTo(1024 ** 3 * 2.41, -3);
  });

  it('returns 0 for invalid input', () => {
    expect(parseBytes('invalid')).toBe(0);
    expect(parseBytes('')).toBe(0);
  });
});

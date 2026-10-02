// ============================================================
// ClrX — Size Formatting Utilities
// ============================================================

/**
 * Convert bytes to a human-readable string.
 * Always uses bytes internally; this is display-only.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 0) bytes = 0;

  const TB = 1024 ** 4;
  const GB = 1024 ** 3;
  const MB = 1024 ** 2;
  const KB = 1024;

  if (bytes >= TB) return `${(bytes / TB).toFixed(2)} TB`;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(2)} KB`;
  return `${bytes} B`;
}

/**
 * Parse a human-readable size string back to bytes.
 * Used in tests and validation only.
 */
export function parseBytes(str: string): number {
  const match = str.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  switch (unit) {
    case 'TB':
      return Math.round(value * 1024 ** 4);
    case 'GB':
      return Math.round(value * 1024 ** 3);
    case 'MB':
      return Math.round(value * 1024 ** 2);
    case 'KB':
      return Math.round(value * 1024);
    default:
      return Math.round(value);
  }
}

/**
 * Right-pad a string to width with spaces.
 */
export function padRight(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

/**
 * Left-pad a string to width with spaces.
 */
export function padLeft(str: string, width: number): string {
  return str.length >= width ? str : ' '.repeat(width - str.length) + str;
}

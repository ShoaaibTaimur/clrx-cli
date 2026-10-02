// ============================================================
// ClrX — Formatting Utilities
// ============================================================
import chalk from 'chalk';
import { SafetyLevel } from '../types/cleaner.js';

/**
 * Color-code a safety level for terminal output.
 */
export function formatSafetyLevel(level: SafetyLevel): string {
  switch (level) {
    case SafetyLevel.SAFE:
      return chalk.green('SAFE');
    case SafetyLevel.CAUTION:
      return chalk.yellow('CAUTION');
    case SafetyLevel.CONFIRMATION_REQUIRED:
      return chalk.red('DANGEROUS');
    case SafetyLevel.PROTECTED:
      return chalk.gray('PROTECTED');
  }
}

/**
 * Color-code a safety level badge for terminal selection lists.
 */
export function formatSafetyBadge(level: SafetyLevel): string {
  switch (level) {
    case SafetyLevel.SAFE:
      return chalk.green.bold('[SAFE]');
    case SafetyLevel.CAUTION:
      return chalk.yellow.bold('[CAUTION]');
    case SafetyLevel.CONFIRMATION_REQUIRED:
      return chalk.red.bold('[DANGEROUS]');
    case SafetyLevel.PROTECTED:
      return chalk.dim('[PROTECTED]');
  }
}

/**
 * Format a Date as a local ISO-like string.
 */
export function formatDate(date: Date): string {
  return date.toLocaleString();
}

/**
 * Create a horizontal divider line.
 */
export function divider(width = 50, char = '─'): string {
  return char.repeat(width);
}

/**
 * Wrap text in a box (single-line).
 */
export function boxLine(text: string, width = 50): string {
  const padding = Math.max(0, width - text.length - 2);
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return `│ ${' '.repeat(left)}${text}${' '.repeat(right)} │`;
}

/**
 * Print the ClrX banner.
 */
export function printBanner(): void {
  const width = 48;
  const top = '╭' + '─'.repeat(width) + '╮';
  const bottom = '╰' + '─'.repeat(width) + '╯';
  const empty = '│' + ' '.repeat(width) + '│';

  const title = 'ClrX';
  const subtitle = 'Safe macOS Storage Cleaner';

  const titlePad = Math.floor((width - title.length) / 2);
  const subtitlePad = Math.floor((width - subtitle.length) / 2);

  const titleLine =
    '│' +
    ' '.repeat(titlePad) +
    chalk.cyan(chalk.bold(title)) +
    ' '.repeat(width - titlePad - title.length) +
    '│';

  const subtitleLine =
    '│' +
    ' '.repeat(subtitlePad) +
    chalk.dim(subtitle) +
    ' '.repeat(width - subtitlePad - subtitle.length) +
    '│';

  console.log();
  console.log(chalk.cyan(top));
  console.log(chalk.cyan(empty));
  console.log(titleLine);
  console.log(subtitleLine);
  console.log(chalk.cyan(empty));
  console.log(chalk.cyan(bottom));
  console.log();
}

/**
 * Truncate a string to maxLen, adding '…' if needed.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

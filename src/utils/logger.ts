// ============================================================
// ClrX — Logger
// ============================================================
import chalk from 'chalk';

export type LogLevel = 'quiet' | 'normal' | 'verbose';

let currentLevel: LogLevel = 'normal';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

const logger = {
  /** Always printed unless quiet */
  info(msg: string): void {
    if (currentLevel !== 'quiet') {
      process.stdout.write(msg + '\n');
    }
  },

  /** Only printed in verbose mode */
  verbose(msg: string): void {
    if (currentLevel === 'verbose') {
      process.stdout.write(chalk.dim(msg) + '\n');
    }
  },

  /** Warnings — always shown */
  warn(msg: string): void {
    process.stderr.write(chalk.yellow(msg) + '\n');
  },

  /** Errors — always shown */
  error(msg: string): void {
    process.stderr.write(chalk.red(msg) + '\n');
  },

  /** Success messages */
  success(msg: string): void {
    if (currentLevel !== 'quiet') {
      process.stdout.write(chalk.green(msg) + '\n');
    }
  },

  /** Raw output (no prefix, no formatting) */
  raw(msg: string): void {
    if (currentLevel !== 'quiet') {
      process.stdout.write(msg + '\n');
    }
  },

  /** Blank line */
  blank(): void {
    if (currentLevel !== 'quiet') {
      process.stdout.write('\n');
    }
  },
};

export default logger;

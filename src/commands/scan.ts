// ============================================================
// ClrX — Scan Command
// ============================================================
import type { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import { registry } from '../core/registry.js';
import { runScan, buildScanSummary } from '../core/scanner.js';
import { formatBytes } from '../utils/size.js';
import { formatSafetyLevel, divider } from '../utils/formatting.js';
import { SafetyLevel } from '../types/cleaner.js';
import logger from '../utils/logger.js';

interface ScanCommandOptions {
  json?: boolean;
  category?: string;
}

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Scan your Mac and report reclaimable space by category')
    .option('--json', 'Output results as JSON')
    .option('--category <category>', 'Scan only a specific category (id)')
    .action(async (opts: ScanCommandOptions) => {
      await runScanCommand(opts);
    });
}

export async function runScanCommand(opts: ScanCommandOptions = {}): Promise<void> {
  const cleaners = registry.getAll();

  let targets = cleaners;
  if (opts.category) {
    targets = cleaners.filter(
      (c) => c.id === opts.category || c.name.toLowerCase().includes(opts.category!.toLowerCase()),
    );
    if (targets.length === 0) {
      logger.error(`Unknown category: ${opts.category}`);
      logger.info(`Available categories: ${cleaners.map((c) => c.id).join(', ')}`);
      process.exit(1);
    }
  }

  const spinner = ora({
    text: chalk.dim('Scanning your Mac...'),
    color: 'cyan',
  }).start();

  const results = await runScan(targets);
  spinner.stop();

  if (opts.json) {
    const summary = buildScanSummary(results);
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    return;
  }

  // Terminal output
  console.log();
  console.log(chalk.bold('ClrX Scan Results'));
  console.log(chalk.dim(divider(58)));
  console.log();

  const table = new Table({
    head: [
      chalk.cyan('Category'),
      chalk.cyan('Size'),
      chalk.cyan('Items'),
      chalk.cyan('Safety'),
      chalk.cyan('Status'),
    ],
    style: {
      head: [],
      border: ['dim'],
    },
    colWidths: [24, 12, 8, 23, 14],
  });

  let totalReclaimable = 0;

  for (const result of results) {
    const safetyStr = formatSafetyLevel(result.safety);
    const sizeStr =
      result.sizeBytes > 0 ? chalk.white(formatBytes(result.sizeBytes)) : chalk.dim('—');
    const itemStr = result.itemCount > 0 ? String(result.itemCount) : '—';

    let statusStr: string;
    if (!result.isAvailable) {
      statusStr = chalk.dim('Not available');
    } else if (result.sizeBytes === 0) {
      statusStr = chalk.green('Clean');
    } else {
      statusStr = chalk.yellow('Reclaimable');
      totalReclaimable += result.sizeBytes;
    }

    const nameStr =
      result.safety === SafetyLevel.SAFE
        ? chalk.white(result.name)
        : result.safety === SafetyLevel.CAUTION
          ? chalk.yellow(result.name)
          : chalk.red(result.name);

    table.push([nameStr, sizeStr, itemStr, safetyStr, statusStr]);

    if (result.note) {
      logger.verbose(`  - ${result.name}: ${result.note}`);
    }
  }

  console.log(table.toString());
  console.log();
  console.log(chalk.bold('Potentially reclaimable: ') + chalk.cyan(formatBytes(totalReclaimable)));
  console.log();
  console.log(chalk.dim("Run 'clrx clean --dry-run' to preview what would be removed."));
  console.log(chalk.dim("Run 'clrx clean' to start interactive cleanup."));
  console.log();
}

// ============================================================
// ClrX — Clean Command
// ============================================================
import type { Command } from 'commander';
import chalk from 'chalk';
import { checkbox, select, Separator } from '@inquirer/prompts';
import ora from 'ora';
import { registry } from '../core/registry.js';
import { runScan } from '../core/scanner.js';
import { runClean, printCleanSummary } from '../core/cleaner.js';
import { SafetyLevel } from '../types/cleaner.js';
import type { Cleaner, CleanOptions } from '../types/cleaner.js';
import { formatBytes } from '../utils/size.js';
import { formatSafetyLevel } from '../utils/formatting.js';
import { setLogLevel } from '../utils/logger.js';
import logger from '../utils/logger.js';

interface CleanCommandOptions {
  dryRun?: boolean;
  yes?: boolean;
  safe?: boolean;
  category?: string;
  verbose?: boolean;
  quiet?: boolean;
}

export function registerCleanCommand(program: Command): void {
  program
    .command('clean')
    .description('Clean reclaimable space (interactive by default)')
    .option('--dry-run', 'Preview what would be removed — nothing is deleted')
    .option('--yes', 'Auto-confirm prompts (safety rules still apply)')
    .option('--safe', 'Only clean SAFE-rated categories')
    .option('--category <id>', 'Clean only a specific category by id')
    .option('--verbose', 'Verbose output')
    .option('--quiet', 'Suppress non-essential output')
    .action(async (opts: CleanCommandOptions) => {
      await runCleanCommand(opts);
    });
}

export async function runCleanCommand(
  opts: CleanCommandOptions = {},
): Promise<{ cancelled?: boolean } | void> {
  // Configure log level
  if (opts.verbose) setLogLevel('verbose');
  if (opts.quiet) setLogLevel('quiet');

  const cleanOptions: CleanOptions = {
    dryRun: opts.dryRun ?? false,
    yes: opts.yes ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };

  if (cleanOptions.dryRun) {
    console.log();
    console.log(chalk.yellow(chalk.bold('DRY RUN — Nothing will be deleted')));
    console.log(chalk.dim('Showing what would be removed...\n'));
  }

  // Determine which cleaners to run
  let allCleaners = registry.getAll();

  if (opts.category) {
    allCleaners = allCleaners.filter(
      (c) => c.id === opts.category || c.name.toLowerCase().includes(opts.category!.toLowerCase()),
    );
    if (allCleaners.length === 0) {
      logger.error(`Unknown category: ${opts.category}`);
      process.exit(1);
    }
  }

  if (opts.safe) {
    allCleaners = allCleaners.filter((c) => c.safety === SafetyLevel.SAFE);
  }

  // Filter out PROTECTED cleaners (they should never appear in clean)
  allCleaners = allCleaners.filter((c) => c.safety !== SafetyLevel.PROTECTED);

  // Scan first to know what's available
  const spinner = ora({ text: chalk.dim('Scanning...'), color: 'cyan' }).start();
  const scanResults = await runScan(allCleaners);
  spinner.stop();

  const availableCleaners = allCleaners.filter((c) => {
    const result = scanResults.find((r) => r.cleanerId === c.id);
    return result?.isAvailable ?? false;
  });

  if (availableCleaners.length === 0) {
    console.log();
    console.log(chalk.green('Nothing to clean. Your Mac is already tidy!'));
    console.log();
    return;
  }

  let selectedCleaners: Cleaner[];

  // If --yes flag and not interactive, use available cleaners directly
  if (cleanOptions.yes || opts.safe) {
    // For --yes --safe, run all safe available cleaners without prompting
    selectedCleaners = availableCleaners;

    if (!cleanOptions.dryRun && !cleanOptions.yes) {
      // Interactive confirmation
      const totalBytes = scanResults
        .filter((r) => availableCleaners.some((c) => c.id === r.cleanerId))
        .reduce((s, r) => s + r.sizeBytes, 0);

      console.log();
      console.log(`Found ${chalk.cyan(formatBytes(totalBytes))} of reclaimable space.`);
      console.log();

      const action = await select({
        message: 'Proceed with cleanup?',
        choices: [
          { name: chalk.green('Proceed with cleanup'), value: 'proceed' },
          { name: chalk.yellow('Cancel and return to menu'), value: 'cancel' },
          { name: chalk.dim('Exit ClrX'), value: 'exit' },
        ],
        loop: false,
      });

      if (action === 'exit') {
        console.log(chalk.cyan('\nGoodbye!\n'));
        process.exit(0);
      }
      if (action === 'cancel') {
        return { cancelled: true };
      }
    }
  } else if (!cleanOptions.dryRun) {
    // Interactive mode — let user select what to clean
    console.log();
    console.log(chalk.bold('Available categories to clean:'));
    console.log();

    const choices = [
      ...availableCleaners.map((c) => {
        const result = scanResults.find((r) => r.cleanerId === c.id);
        const size = result ? formatBytes(result.sizeBytes) : '—';
        const safetyLabel = formatSafetyLevel(c.safety);

        return {
          name: `${chalk.white(c.name.padEnd(22))} ${chalk.dim(size.padStart(10))}  ${safetyLabel}`,
          value: c.id,
          checked: c.safety === SafetyLevel.SAFE,
        };
      }),
      new Separator('─────────────────────────────────────────'),
      {
        name: chalk.yellow('← Cancel / Return to menu'),
        value: '__cancel__',
        checked: false,
      },
      {
        name: chalk.dim('✖ Exit ClrX'),
        value: '__exit__',
        checked: false,
      },
    ];

    const selectedIds = await checkbox({
      message: 'Select categories to clean (Space to toggle, Enter to confirm):',
      choices,
      loop: false,
      pageSize: 15,
    });

    if (selectedIds.includes('__exit__')) {
      console.log(chalk.cyan('\nGoodbye!\n'));
      process.exit(0);
    }

    const validSelectedIds = selectedIds.filter((id) => !id.startsWith('__'));
    if (selectedIds.includes('__cancel__') || validSelectedIds.length === 0) {
      return { cancelled: true };
    }

    selectedCleaners = availableCleaners.filter((c) => validSelectedIds.includes(c.id));

    // Show what's selected and ask final confirmation
    const totalBytes = scanResults
      .filter((r) => validSelectedIds.includes(r.cleanerId))
      .reduce((s, r) => s + r.sizeBytes, 0);

    console.log();
    console.log(
      `Selected ${chalk.cyan(selectedCleaners.length)} categories, ` +
        `estimated ${chalk.cyan(formatBytes(totalBytes))}.`,
    );

    // Warn about CAUTION items
    const cautionItems = selectedCleaners.filter((c) => c.safety === SafetyLevel.CAUTION);
    if (cautionItems.length > 0) {
      console.log();
      console.log(chalk.yellow('⚠ CAUTION items selected:'));
      for (const c of cautionItems) {
        console.log(chalk.yellow(`  • ${c.name}: ${c.description}`));
      }
    }

    console.log();
    const action = await select({
      message: 'Proceed with cleanup?',
      choices: [
        { name: chalk.green('Proceed with cleanup'), value: 'proceed' },
        { name: chalk.yellow('Cancel and return to menu'), value: 'cancel' },
        { name: chalk.dim('Exit ClrX'), value: 'exit' },
      ],
      loop: false,
    });

    if (action === 'exit') {
      console.log(chalk.cyan('\nGoodbye!\n'));
      process.exit(0);
    }
    if (action === 'cancel') {
      return { cancelled: true };
    }
  } else {
    // Dry run — preview everything
    selectedCleaners = availableCleaners;
  }

  console.log();

  if (cleanOptions.dryRun) {
    console.log(chalk.bold('Would remove:'));
    console.log();
    for (const result of scanResults) {
      const cleaner = selectedCleaners.find((c) => c.id === result.cleanerId);
      if (!cleaner || !result.isAvailable || result.sizeBytes === 0) continue;
      console.log(
        `  ${chalk.cyan('→')} ${chalk.white(result.name.padEnd(22))} ${formatBytes(result.sizeBytes)}`,
      );
      for (const path of result.paths.filter((p) => p.exists && p.sizeBytes > 0)) {
        console.log(`     ${chalk.dim(path.path)}  ${chalk.dim(formatBytes(path.sizeBytes))}`);
      }
    }
    console.log();
  } else {
    console.log(chalk.cyan(chalk.bold('Cleaning...')));
    console.log();
  }

  const summary = await runClean(selectedCleaners, cleanOptions);
  printCleanSummary(summary);
}

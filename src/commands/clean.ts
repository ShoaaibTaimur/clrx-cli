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
import { formatSafetyBadge, printBanner } from '../utils/formatting.js';
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
    console.log(chalk.yellow.bold('DRY RUN — Nothing will be deleted'));
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

  // 1. Scan first
  const spinner = ora({ text: chalk.dim('Scanning your Mac...'), color: 'cyan' }).start();
  const scanResults = await runScan(allCleaners);
  spinner.stop();

  const availableCleaners = allCleaners.filter((c) => {
    const result = scanResults.find((r) => r.cleanerId === c.id);
    return Boolean(result?.isAvailable && (result.sizeBytes > 0 || opts.category));
  });

  if (availableCleaners.length === 0) {
    console.clear();
    printBanner();
    console.log(chalk.green('Nothing to clean. Your Mac is already tidy!\n'));
    return;
  }

  let selectedCleaners: Cleaner[];

  // If --yes flag and non-interactive
  if (cleanOptions.yes || opts.safe) {
    selectedCleaners = availableCleaners;

    if (!cleanOptions.dryRun && !cleanOptions.yes) {
      const totalBytes = scanResults
        .filter((r) => availableCleaners.some((c) => c.id === r.cleanerId))
        .reduce((s, r) => s + r.sizeBytes, 0);

      console.log();
      console.log(`Found ${chalk.cyan.bold(formatBytes(totalBytes))} of reclaimable space.`);
      console.log();

      const action = await select({
        message: 'Proceed with cleanup?',
        choices: [
          { name: chalk.green('Proceed with cleanup'), value: 'proceed' },
          { name: chalk.dim('Cancel'), value: 'cancel' },
        ],
        loop: false,
      });

      if (action === 'cancel') {
        console.clear();
        return { cancelled: true };
      }
    }
  } else if (!cleanOptions.dryRun) {
    // 2. Interactive mode: Show list with checkboxes and warnings
    const totalReclaimable = scanResults
      .filter((r) => availableCleaners.some((c) => c.id === r.cleanerId))
      .reduce((s, r) => s + r.sizeBytes, 0);

    console.log();
    console.log(
      chalk.bold('Found ') +
        chalk.cyan.bold(formatBytes(totalReclaimable)) +
        chalk.bold(` reclaimable space across ${availableCleaners.length} categories:`),
    );
    console.log();

    const choices = [
      ...availableCleaners.map((c) => {
        const result = scanResults.find((r) => r.cleanerId === c.id);
        const size = result ? formatBytes(result.sizeBytes) : '—';
        const safetyBadge = formatSafetyBadge(c.safety);

        let desc = c.description;
        if (c.safety === SafetyLevel.CONFIRMATION_REQUIRED) {
          desc = `[DANGEROUS] ${c.description}`;
        } else if (c.safety === SafetyLevel.CAUTION) {
          desc = `[CAUTION] ${c.description}`;
        } else {
          desc = `[SAFE] ${c.description}`;
        }

        return {
          name: `${chalk.white(c.name.padEnd(24))} ${chalk.cyan(size.padStart(10))}  ${safetyBadge}`,
          value: c.id,
          description: desc,
          checked: c.safety === SafetyLevel.SAFE,
        };
      }),
      new Separator('─────────────────────────────────────────'),
      {
        name: chalk.dim('Cancel / Exit'),
        value: '__cancel__',
        checked: false,
      },
    ];

    const selectedIds = await checkbox({
      message: 'Select items to remove (Space to toggle, Enter to confirm):',
      choices,
      loop: false,
      pageSize: 15,
    });

    if (selectedIds.includes('__cancel__') || selectedIds.length === 0) {
      console.clear();
      return { cancelled: true };
    }

    const validSelectedIds = selectedIds.filter((id) => !id.startsWith('__'));
    if (validSelectedIds.length === 0) {
      console.clear();
      return { cancelled: true };
    }

    selectedCleaners = availableCleaners.filter((c) => validSelectedIds.includes(c.id));

    // Calculate total bytes for selected
    const totalBytes = scanResults
      .filter((r) => validSelectedIds.includes(r.cleanerId))
      .reduce((s, r) => s + r.sizeBytes, 0);

    // 3. Highlight warnings for CAUTION and DANGEROUS items
    const dangerousItems = selectedCleaners.filter(
      (c) => c.safety === SafetyLevel.CONFIRMATION_REQUIRED,
    );
    const cautionItems = selectedCleaners.filter((c) => c.safety === SafetyLevel.CAUTION);

    if (dangerousItems.length > 0) {
      console.log();
      console.log(chalk.red.bold('DANGEROUS items selected:'));
      for (const c of dangerousItems) {
        console.log(chalk.red(`  - ${c.name}: ${c.description}`));
      }
    }

    if (cautionItems.length > 0) {
      console.log();
      console.log(chalk.yellow.bold('CAUTION items selected:'));
      for (const c of cautionItems) {
        console.log(chalk.yellow(`  - ${c.name}: ${c.description}`));
      }
    }

    console.log();
    console.log(
      `Selected ${chalk.bold.cyan(selectedCleaners.length)} categories. Estimated reclaimable: ${chalk.bold.cyan(formatBytes(totalBytes))}.`,
    );
    console.log();

    const action = await select({
      message: 'Proceed with cleanup?',
      choices: [
        { name: chalk.green.bold('Clean selected items'), value: 'proceed' },
        { name: chalk.yellow('Dry Run (preview only, nothing deleted)'), value: 'dry-run' },
        { name: chalk.dim('Cancel'), value: 'cancel' },
      ],
      loop: false,
    });

    if (action === 'cancel') {
      console.clear();
      return { cancelled: true };
    }

    if (action === 'dry-run') {
      cleanOptions.dryRun = true;
    }
  } else {
    // Dry run passed as flag — preview everything
    selectedCleaners = availableCleaners;
  }

  if (cleanOptions.dryRun) {
    console.clear();
    printBanner();
    console.log(chalk.yellow.bold('DRY RUN — Nothing was deleted\n'));
    console.log(chalk.bold('Would remove:'));
    console.log();
    for (const result of scanResults) {
      const cleaner = selectedCleaners.find((c) => c.id === result.cleanerId);
      if (!cleaner || !result.isAvailable || result.sizeBytes === 0) continue;
      console.log(`  - ${chalk.white(result.name.padEnd(24))} ${formatBytes(result.sizeBytes)}`);
      for (const path of result.paths.filter((p) => p.exists && p.sizeBytes > 0)) {
        console.log(`     ${chalk.dim(path.path)}  ${chalk.dim(formatBytes(path.sizeBytes))}`);
      }
    }
    console.log();
  } else {
    console.clear();
    printBanner();
    console.log(chalk.cyan.bold('Cleaning...\n'));
  }

  const summary = await runClean(selectedCleaners, cleanOptions);

  console.clear();
  printBanner();
  printCleanSummary(summary);
}

#!/usr/bin/env node
// ============================================================
// ClrX — CLI Entry Point
// ============================================================
import { Command } from 'commander';
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import ora from 'ora';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Register all cleaners (side-effect: populates the registry)
import './cleaners/index.js';

import { registry } from './core/registry.js';
import { runScan } from './core/scanner.js';
import { formatBytes } from './utils/size.js';
import { printBanner, divider } from './utils/formatting.js';
import { assertMacOS } from './utils/platform.js';
import { warnIfRoot } from './core/permissions.js';
import {
  registerScanCommand,
  registerCleanCommand,
  registerInfoCommand,
} from './commands/index.js';
import { runScanCommand } from './commands/scan.js';
import { runCleanCommand } from './commands/clean.js';
import { runInfoCommand } from './commands/info.js';
import { checkForUpdates } from './utils/update-check.js';
import logger from './utils/logger.js';

// ── Version ──────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
let version = '1.0.3';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
    version: string;
  };
  version = pkg.version;
} catch {
  // fallback
}

// ── Startup checks ────────────────────────────────────────────
assertMacOS();
warnIfRoot();

// ── Commander program ─────────────────────────────────────────
const program = new Command();

program
  .name('clrx')
  .description('ClrX — Safe macOS Storage Cleaner')
  .version(version, '-v, --version', 'Show version number')
  .helpOption('-h, --help', 'Show help')
  .addHelpText(
    'after',
    `
Examples:
  $ clrx                    Launch interactive dashboard
  $ clrx scan               Scan and report reclaimable space
  $ clrx scan --json        Output scan results as JSON
  $ clrx clean --dry-run    Preview what would be removed
  $ clrx clean              Interactive cleanup
  $ clrx clean --safe       Clean only SAFE-rated categories
  $ clrx clean --safe --yes Auto-confirm SAFE cleanup
  $ clrx info               System information and overview
`,
  );

// Register subcommands
registerScanCommand(program);
registerCleanCommand(program);
registerInfoCommand(program);

// ── Interactive dashboard (default when no subcommand) ────────
async function runDashboard(): Promise<void> {
  while (true) {
    console.clear();
    printBanner();

    // Quick scan for the overview
    const spinner = ora({ text: chalk.dim('Scanning your Mac...'), color: 'cyan' }).start();
    const results = await runScan(registry.getAll());
    spinner.stop();

    // Storage overview
    console.log(chalk.bold('Storage Overview'));
    console.log(chalk.dim(divider(50)));

    let totalReclaimable = 0;

    for (const result of results) {
      if (!result.isAvailable) continue;
      if (result.sizeBytes === 0 && result.cleanerId !== 'trash') continue;
      const sizeStr = formatBytes(result.sizeBytes);
      const coloredSize =
        result.sizeBytes > 0 ? chalk.cyan(sizeStr.padStart(10)) : chalk.dim(sizeStr.padStart(10));
      console.log(`  ${result.name.padEnd(30)} ${coloredSize}`);
      totalReclaimable += result.sizeBytes;
    }

    console.log(chalk.dim(divider(50)));
    console.log(
      `  ${'Potentially reclaimable'.padEnd(30)} ${chalk.bold(chalk.cyan(formatBytes(totalReclaimable).padStart(10)))}`,
    );
    console.log();

    // Main menu
    let choice: string;
    try {
      choice = await select({
        message: 'What would you like to do?',
        choices: [
          {
            name: chalk.white('Scan'),
            value: 'scan',
            description: 'Detailed scan of all categories',
          },
          { name: chalk.cyan('Clean'), value: 'clean', description: 'Interactive cleanup' },
          {
            name: chalk.green('Clean Safe'),
            value: 'clean-safe',
            description: 'Clean SAFE-rated items only',
          },
          {
            name: chalk.yellow('Dry Run'),
            value: 'dry-run',
            description: 'Preview what would be removed (nothing deleted)',
          },
          {
            name: chalk.white('System Info'),
            value: 'info',
            description: 'System information and overview',
          },
          { name: chalk.dim('Exit ClrX'), value: 'exit' },
        ],
        loop: false,
      });
    } catch {
      console.log(chalk.cyan('\nGoodbye!\n'));
      process.exit(0);
    }

    console.log();

    let runResult: { cancelled?: boolean } | void = undefined;
    try {
      switch (choice) {
        case 'scan':
          await runScanCommand({});
          break;

        case 'clean':
          runResult = await runCleanCommand({});
          break;

        case 'clean-safe':
          runResult = await runCleanCommand({ safe: true });
          break;

        case 'dry-run':
          await runCleanCommand({ dryRun: true });
          break;

        case 'info':
          await runInfoCommand();
          break;

        case 'exit':
          console.log(chalk.cyan('\nGoodbye!\n'));
          process.exit(0);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === 'ExitPromptError' ||
          err.message.includes('SIGINT') ||
          err.message.includes('ExitPromptError'))
      ) {
        continue;
      } else {
        throw err;
      }
    }

    // If sub-command explicitly cancelled back to menu, loop back immediately
    if (runResult && runResult.cancelled) {
      continue;
    }

    // Selectable next action prompt
    console.log();
    try {
      const nextAction = await select({
        message: 'What would you like to do next?',
        choices: [
          { name: chalk.cyan('Return to Menu'), value: 'menu' },
          { name: chalk.dim('Exit ClrX'), value: 'exit' },
        ],
        loop: false,
      });

      if (nextAction === 'exit') {
        console.log(chalk.cyan('\nGoodbye!\n'));
        process.exit(0);
      }
    } catch {
      console.log(chalk.cyan('\nGoodbye!\n'));
      process.exit(0);
    }
  }
}

// ── Main entrypoint ────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // If no subcommand → launch interactive dashboard
  if (args.length === 0 || (args.length === 1 && (args[0] === '--help' || args[0] === '-h'))) {
    if (args.length === 0) {
      if (!process.stdout.isTTY) {
        logger.error('ClrX requires an interactive terminal. Use --help for usage.');
        process.exit(1);
      }

      // Check for updates once before launching the dashboard.
      // Non-blocking: times out after 4 s, never crashes on network failure.
      await checkForUpdates(version);

      await runDashboard();
      return;
    }
  }

  // Otherwise delegate to Commander
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  if (
    err instanceof Error &&
    (err.name === 'ExitPromptError' ||
      err.message.includes('ExitPromptError') ||
      err.message.includes('SIGINT'))
  ) {
    // Graceful exit
    console.log(chalk.dim('\n\nGoodbye!'));
    process.exit(0);
  }
  logger.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

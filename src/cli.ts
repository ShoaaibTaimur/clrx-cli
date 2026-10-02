#!/usr/bin/env node
// ============================================================
// ClrX — CLI Entry Point
// ============================================================
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Register all cleaners (side-effect: populates the registry)
import './cleaners/index.js';

import { printBanner } from './utils/formatting.js';
import { assertMacOS } from './utils/platform.js';
import { warnIfRoot } from './core/permissions.js';
import {
  registerScanCommand,
  registerCleanCommand,
  registerInfoCommand,
} from './commands/index.js';
import { runCleanCommand } from './commands/clean.js';
import { checkForUpdates } from './utils/update-check.js';
import logger from './utils/logger.js';

// ── Version ──────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
let version = '1.0.5';
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
  $ clrx                    Interactive scan & clean
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

// ── Main entrypoint ────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // If no subcommand → launch direct interactive workflow (scan -> select -> clean)
  if (args.length === 0 || (args.length === 1 && (args[0] === '--help' || args[0] === '-h'))) {
    if (args.length === 0) {
      if (!process.stdout.isTTY) {
        logger.error('ClrX requires an interactive terminal. Use --help for usage.');
        process.exit(1);
      }

      await checkForUpdates(version);

      printBanner();
      await runCleanCommand({});
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
    console.clear();
    process.exit(0);
  }
  logger.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

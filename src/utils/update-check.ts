// ============================================================
// ClrX — Update Checker
// Checks npm registry for a newer version on startup.
// Non-blocking: uses a timeout so a slow/unavailable network
// never delays the CLI.
// ============================================================
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import https from 'node:https';
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import logger from './logger.js';

const execFileAsync = promisify(execFile);

const REGISTRY_URL = 'https://registry.npmjs.org/@shoaaib_taimur/clrx/latest';
const CHECK_TIMEOUT_MS = 4000;

/**
 * Fetch the latest published version of @shoaaib_taimur/clrx from the npm registry.
 * Returns null on any network/parse failure.
 */
async function fetchLatestVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), CHECK_TIMEOUT_MS);

    const req = https.get(REGISTRY_URL, { timeout: CHECK_TIMEOUT_MS }, (res) => {
      let data = '';

      res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });

      res.on('end', () => {
        clearTimeout(timer);
        try {
          const json = JSON.parse(data) as { version?: string };
          resolve(json.version ?? null);
        } catch {
          resolve(null);
        }
      });

      res.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });
    });

    req.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      clearTimeout(timer);
      resolve(null);
    });
  });
}

/**
 * Simple semver comparison.
 * Returns true if `remote` is strictly newer than `current`.
 */
export function isNewer(current: string, remote: string): boolean {
  const parse = (v: string): number[] =>
    v
      .replace(/^v/, '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const [cMaj, cMin, cPat] = parse(current);
  const [rMaj, rMin, rPat] = parse(remote);

  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPat > cPat;
}

/**
 * Upgrade @shoaaib_taimur/clrx globally via npm.
 */
async function performUpgrade(): Promise<void> {
  const ora = (await import('ora')).default;
  const spinner = ora({ text: chalk.dim('Upgrading ClrX...'), color: 'cyan' }).start();

  try {
    await execFileAsync('npm', ['install', '-g', '@shoaaib_taimur/clrx']);
    spinner.succeed(chalk.green('ClrX upgraded successfully! Please re-run clrx.'));
    process.exit(0);
  } catch (err) {
    spinner.fail(chalk.red('Upgrade failed.'));
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(msg);
    logger.info(chalk.dim('  You can upgrade manually: npm install -g @shoaaib_taimur/clrx'));
  }
}

/**
 * Check for updates and prompt the user if one is available.
 * - Silently no-ops if the network is unavailable or times out.
 * - Never delays the CLI startup by more than CHECK_TIMEOUT_MS.
 */
export async function checkForUpdates(currentVersion: string): Promise<void> {
  let latestVersion: string | null = null;

  try {
    latestVersion = await fetchLatestVersion();
  } catch {
    return; // Never crash on update check failure
  }

  if (!latestVersion) return; // Network unavailable or parse error
  if (!isNewer(currentVersion, latestVersion)) return; // Already up-to-date

  // ── A newer version is available ─────────────────────────────
  console.log();
  console.log(chalk.yellow('┌─────────────────────────────────────────────────────┐'));
  console.log(
    chalk.yellow('│') +
      chalk.bold('  Update available!') +
      chalk.dim(`  ${currentVersion}  →  `) +
      chalk.green(chalk.bold(latestVersion)) +
      ' '.repeat(
        Math.max(
          0,
          53 -
            '  Update available!'.length -
            `  ${currentVersion}  →  `.length -
            latestVersion.length,
        ),
      ) +
      chalk.yellow('│'),
  );
  console.log(
    chalk.yellow('│') +
      chalk.dim('  Run: npm install -g @shoaaib_taimur/clrx') +
      ' '.repeat(14) +
      chalk.yellow('│'),
  );
  console.log(chalk.yellow('└─────────────────────────────────────────────────────┘'));
  console.log();

  try {
    const action = await select({
      message: `Upgrade ClrX to v${latestVersion} now?`,
      choices: [
        { name: chalk.green('Yes, upgrade now'), value: 'upgrade' },
        { name: chalk.white('Skip for now (continue to ClrX)'), value: 'skip' },
        { name: chalk.dim('Exit ClrX'), value: 'exit' },
      ],
      loop: false,
    });

    if (action === 'upgrade') {
      await performUpgrade();
    } else if (action === 'exit') {
      console.log(chalk.cyan('\nGoodbye!\n'));
      process.exit(0);
    } else {
      console.log(chalk.dim('  Skipping update. Continuing with current version.\n'));
    }
  } catch {
    // User cancelled prompt — skip silently
    console.log(chalk.dim('\n  Skipping update.\n'));
  }
}

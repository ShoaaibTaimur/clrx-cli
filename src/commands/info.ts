// ============================================================
// ClrX — Info Command
// Provides system information and a breakdown of reclaimable space
// ============================================================
import type { Command } from 'commander';
import chalk from 'chalk';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ora from 'ora';
import { registry } from '../core/registry.js';
import { runScan } from '../core/scanner.js';
import { formatBytes } from '../utils/size.js';
import { divider } from '../utils/formatting.js';
import { getArchitecture } from '../utils/platform.js';
import { commandExists } from '../utils/platform.js';

const execFileAsync = promisify(execFile);

interface DiskInfo {
  available: number;
  total: number;
  used: number;
}

async function getDiskInfo(): Promise<DiskInfo | null> {
  try {
    // df -k gives kilobytes
    const { stdout } = await execFileAsync('/bin/df', ['-k', '/']);
    const lines = stdout.trim().split('\n');
    if (lines.length < 2) return null;

    const parts = lines[1].trim().split(/\s+/);
    if (parts.length < 4) return null;

    const total = parseInt(parts[1], 10) * 1024;
    const used = parseInt(parts[2], 10) * 1024;
    const available = parseInt(parts[3], 10) * 1024;

    return { total, used, available };
  } catch {
    return null;
  }
}

async function getMacOSVersion(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('/usr/bin/sw_vers', ['-productVersion']);
    return stdout.trim();
  } catch {
    return 'Unknown';
  }
}

function getNodeVersion(): string {
  return process.version;
}

export function registerInfoCommand(program: Command): void {
  program
    .command('info')
    .description('Display system information and reclaimable space overview')
    .action(async () => {
      await runInfoCommand();
    });
}

export async function runInfoCommand(): Promise<void> {
  const spinner = ora({ text: chalk.dim('Gathering system info...'), color: 'cyan' }).start();

  const [macVersion, disk, scanResults] = await Promise.all([
    getMacOSVersion(),
    getDiskInfo(),
    runScan(registry.getAll()),
  ]);

  spinner.stop();

  console.log();
  console.log(chalk.bold('System Information'));
  console.log(chalk.dim(divider(50)));
  console.log(`  ${'macOS Version'.padEnd(20)} ${chalk.white(macVersion)}`);
  console.log(`  ${'Architecture'.padEnd(20)} ${chalk.white(getArchitecture())}`);
  console.log(`  ${'Node.js'.padEnd(20)} ${chalk.white(getNodeVersion())}`);
  console.log(`  ${'Hostname'.padEnd(20)} ${chalk.white(os.hostname())}`);
  console.log(`  ${'Home Directory'.padEnd(20)} ${chalk.white(os.homedir())}`);

  if (disk) {
    const usedPct = ((disk.used / disk.total) * 100).toFixed(1);
    console.log();
    console.log(chalk.bold('Disk Usage (/)'));
    console.log(chalk.dim(divider(50)));
    console.log(`  ${'Total'.padEnd(20)} ${chalk.white(formatBytes(disk.total))}`);
    console.log(
      `  ${'Used'.padEnd(20)} ${chalk.white(formatBytes(disk.used))} ${chalk.dim(`(${usedPct}%)`)}`,
    );
    console.log(`  ${'Available'.padEnd(20)} ${chalk.green(formatBytes(disk.available))}`);
  }

  console.log();
  console.log(chalk.bold('Reclaimable Space by Category'));
  console.log(chalk.dim(divider(50)));

  let totalReclaimable = 0;
  for (const result of scanResults) {
    if (!result.isAvailable) {
      console.log(`  ${result.name.padEnd(28)} ${chalk.dim('Not available')}`);
    } else {
      const sizeStr = formatBytes(result.sizeBytes);
      const note = result.note ? chalk.dim(` (${result.note})`) : '';
      console.log(`  ${result.name.padEnd(28)} ${chalk.cyan(sizeStr)}${note}`);
      totalReclaimable += result.sizeBytes;
    }
  }

  console.log(chalk.dim(divider(50)));
  console.log(
    `  ${'Total reclaimable'.padEnd(28)} ${chalk.bold(chalk.cyan(formatBytes(totalReclaimable)))}`,
  );

  // Check installed tools
  console.log();
  console.log(chalk.bold('Detected Tools'));
  console.log(chalk.dim(divider(50)));

  const tools = [
    { name: 'npm', cmd: 'npm' },
    { name: 'pnpm', cmd: 'pnpm' },
    { name: 'yarn', cmd: 'yarn' },
    { name: 'Homebrew', cmd: 'brew' },
    { name: 'Docker', cmd: 'docker' },
    { name: 'Xcode (xcodebuild)', cmd: 'xcodebuild' },
    { name: 'CocoaPods (pod)', cmd: 'pod' },
  ];

  for (const tool of tools) {
    const exists = await commandExists(tool.cmd);
    const status = exists ? chalk.green('✓ Installed') : chalk.dim('Not installed');
    console.log(`  ${tool.name.padEnd(28)} ${status}`);
  }

  console.log();
  console.log(chalk.dim("Run 'clrx scan' for detailed breakdown."));
  console.log(chalk.dim("Run 'clrx clean --dry-run' to preview cleanup."));
  console.log();
}

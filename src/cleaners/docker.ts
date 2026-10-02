// ============================================================
// ClrX — Docker Cleaner
// Uses: docker system prune (no volumes by default)
// Safety: CAUTION — removes stopped containers, unused images, networks
// Note: Docker volumes are NEVER auto-pruned
// ============================================================
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SafetyLevel } from '../types/cleaner.js';
import type { CleanOptions, CleanResult, ScanResult } from '../types/cleaner.js';
import { BaseCleaner } from './base.js';
import { commandExists } from '../utils/platform.js';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export class DockerCleaner extends BaseCleaner {
  readonly id = 'docker';
  readonly name = 'Docker';
  readonly description =
    'Docker unused resources. Removes stopped containers, dangling images, unused networks. Volumes are NOT touched.';
  readonly safety = SafetyLevel.CAUTION;

  protected getTargetPaths(): string[] {
    return []; // Docker cleanup is command-based, not path-based
  }

  override async isAvailable(): Promise<boolean> {
    if (!(await commandExists('docker'))) return false;
    // Check if Docker daemon is actually running
    try {
      await execFileAsync('docker', ['info'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  override async scan(): Promise<ScanResult> {
    const hasDocker = await commandExists('docker');

    if (!hasDocker) {
      return {
        cleanerId: this.id,
        name: this.name,
        sizeBytes: 0,
        itemCount: 0,
        safety: this.safety,
        isAvailable: false,
        note: 'Docker not installed',
        paths: [],
      };
    }

    const isRunning = await this.isAvailable();
    if (!isRunning) {
      return {
        cleanerId: this.id,
        name: this.name,
        sizeBytes: 0,
        itemCount: 0,
        safety: this.safety,
        isAvailable: false,
        note: 'Docker is not running',
        paths: [],
      };
    }

    // Get disk usage info from Docker
    let totalBytes = 0;
    let note = 'Volumes are never auto-pruned';

    try {
      const { stdout } = await execFileAsync('docker', ['system', 'df', '--format', 'json']);
      logger.verbose(`docker system df: ${stdout}`);

      // Parse reclaimable size from docker system df output
      const lines = stdout.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as { Reclaimable?: string; Size?: string };
          const reclaimStr = entry.Reclaimable ?? '';
          const match = reclaimStr.match(/([\d.]+)(B|KB|MB|GB|TB)/i);
          if (match) {
            const val = parseFloat(match[1]);
            const unit = match[2].toUpperCase();
            const multipliers: Record<string, number> = {
              B: 1,
              KB: 1024,
              MB: 1024 ** 2,
              GB: 1024 ** 3,
              TB: 1024 ** 4,
            };
            totalBytes += val * (multipliers[unit] ?? 1);
          }
        } catch {
          // Skip unparseable lines
        }
      }
    } catch {
      // docker system df failed — Docker may not support it
      note = 'Could not query Docker disk usage. Volumes are never auto-pruned.';
    }

    return {
      cleanerId: this.id,
      name: this.name,
      sizeBytes: Math.round(totalBytes),
      itemCount: 0,
      safety: this.safety,
      isAvailable: true,
      note,
      paths: [],
    };
  }

  override async clean(options: CleanOptions): Promise<CleanResult> {
    const available = await this.isAvailable();

    if (!available) {
      const reason = (await commandExists('docker'))
        ? 'Docker is not running'
        : 'Docker not installed';
      return {
        cleanerId: this.id,
        name: this.name,
        bytesFreed: 0,
        removed: 0,
        skipped: 1,
        failed: 0,
        dryRun: options.dryRun,
        errors: [],
        actions: [{ path: 'docker', sizeBytes: 0, status: 'skipped', reason }],
      };
    }

    if (options.dryRun) {
      logger.info('  [DRY RUN] Would run: docker system prune -f');
      logger.info('  Note: Docker volumes are NEVER pruned automatically.');
      return {
        cleanerId: this.id,
        name: this.name,
        bytesFreed: 0,
        removed: 0,
        skipped: 0,
        failed: 0,
        dryRun: true,
        errors: [],
        actions: [{ path: 'docker system', sizeBytes: 0, status: 'would-remove' }],
      };
    }

    try {
      logger.verbose('Running: docker system prune -f');
      // NEVER include --volumes flag — volumes contain user data
      const { stdout } = await execFileAsync('docker', ['system', 'prune', '-f']);
      logger.verbose(`docker system prune output: ${stdout}`);

      // Parse reclaimed space from output
      const match = stdout.match(/Total reclaimed space:\s*([\d.]+)(B|KB|MB|GB|TB)/i);
      let bytesFreed = 0;
      if (match) {
        const val = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        const multipliers: Record<string, number> = {
          B: 1,
          KB: 1024,
          MB: 1024 ** 2,
          GB: 1024 ** 3,
          TB: 1024 ** 4,
        };
        bytesFreed = Math.round(val * (multipliers[unit] ?? 1));
      }

      return {
        cleanerId: this.id,
        name: this.name,
        bytesFreed,
        removed: 1,
        skipped: 0,
        failed: 0,
        dryRun: false,
        errors: [],
        actions: [{ path: 'docker system', sizeBytes: bytesFreed, status: 'removed' }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`docker system prune failed: ${msg}`);
      return {
        cleanerId: this.id,
        name: this.name,
        bytesFreed: 0,
        removed: 0,
        skipped: 0,
        failed: 1,
        dryRun: false,
        errors: [{ path: 'docker system', message: msg }],
        actions: [{ path: 'docker system', sizeBytes: 0, status: 'failed', reason: msg }],
      };
    }
  }
}

export const dockerCleaner = new DockerCleaner();

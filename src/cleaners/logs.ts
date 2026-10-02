// ============================================================
// ClrX — Logs Cleaner
// Targets: ~/Library/Logs
// Safety: SAFE — old log files are safe to remove
// ============================================================
import { SafetyLevel } from '../types/cleaner.js';
import { BaseCleaner } from './base.js';

export class LogsCleaner extends BaseCleaner {
  readonly id = 'user-logs';
  readonly name = 'User Logs';
  readonly description = 'Application log files in ~/Library/Logs. Old logs are safe to clear.';
  readonly safety = SafetyLevel.SAFE;

  protected getTargetPaths(): string[] {
    return [this.homeJoin('Library', 'Logs')];
  }
}

export const logsCleaner = new LogsCleaner();

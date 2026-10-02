// ============================================================
// ClrX — User Caches Cleaner
// Targets: ~/Library/Caches (excluding browser/dev subdirs shown separately)
// Safety: SAFE — application caches are regenerated automatically
// ============================================================
import { SafetyLevel } from '../types/cleaner.js';
import { BaseCleaner } from './base.js';

export class CachesCleaner extends BaseCleaner {
  readonly id = 'user-caches';
  readonly name = 'User Caches';
  readonly description =
    'Application cache files in ~/Library/Caches. Regenerated automatically by apps.';
  readonly safety = SafetyLevel.SAFE;

  protected getTargetPaths(): string[] {
    return [this.homeJoin('Library', 'Caches')];
  }
}

export const cachesCleaner = new CachesCleaner();

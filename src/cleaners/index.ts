// ============================================================
// ClrX — Cleaners Index
// All cleaners are registered here.
// ============================================================
import { registry } from '../core/registry.js';
import { cachesCleaner } from './caches.js';
import { logsCleaner } from './logs.js';
import { trashCleaner } from './trash.js';
import { browserCleaner } from './browser.js';
import { downloadsCleaner } from './downloads.js';
import { iosBackupsCleaner } from './ios-backups.js';
import { npmCleaner } from './npm.js';
import { pnpmCleaner } from './pnpm.js';
import { yarnCleaner } from './yarn.js';
import { cocoaPodsCleaner } from './cocoapods.js';
import { homebrewCleaner } from './homebrew.js';
import { xcodeCleaner } from './xcode.js';
import { dockerCleaner } from './docker.js';

// Register all cleaners in priority order
// SAFE cleaners first, then CAUTION, then CONFIRMATION_REQUIRED
registry.register(cachesCleaner);
registry.register(logsCleaner);
registry.register(browserCleaner);
registry.register(npmCleaner);
registry.register(pnpmCleaner);
registry.register(yarnCleaner);
registry.register(cocoaPodsCleaner);
registry.register(homebrewCleaner);
registry.register(xcodeCleaner);
registry.register(dockerCleaner);
registry.register(trashCleaner);
registry.register(downloadsCleaner);
registry.register(iosBackupsCleaner);

export {
  cachesCleaner,
  logsCleaner,
  trashCleaner,
  browserCleaner,
  downloadsCleaner,
  iosBackupsCleaner,
  npmCleaner,
  pnpmCleaner,
  yarnCleaner,
  cocoaPodsCleaner,
  homebrewCleaner,
  xcodeCleaner,
  dockerCleaner,
};

# ClrX

[![npm version](https://img.shields.io/npm/v/@shoaaib_taimur/clrx.svg?color=blue)](https://www.npmjs.com/package/@shoaaib_taimur/clrx)
[![npm downloads](https://img.shields.io/npm/dt/@shoaaib_taimur/clrx.svg)](https://www.npmjs.com/package/@shoaaib_taimur/clrx)
[![GitHub](https://img.shields.io/badge/GitHub-ShoaaibTaimur%2Fclrx--cli-181717.svg?logo=github)](https://github.com/ShoaaibTaimur/clrx-cli)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos/)
[![Node.js](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Safe, interactive macOS storage cleaner built with TypeScript.**

> Analyze first. Explain what can be removed. Ask before destructive operations. Never blindly delete user data.

ClrX safely reclaims gigabytes of disk space by targeting system caches, user logs, browser data, package manager stores, developer tool artifacts, and trash — with zero guesswork and strict guardrails.

---

## Installation

Install globally from [npm](https://www.npmjs.com/package/@shoaaib_taimur/clrx):

```bash
npm install -g @shoaaib_taimur/clrx
```

Or run directly without installing:

```bash
npx @shoaaib_taimur/clrx
```

> **Requirements:** macOS 12 (Monterey) or later. Node.js ≥ 20. Apple Silicon and Intel supported.

---

## Key Features

- **Interactive Dashboard** — Real-time storage breakdown by category with arrow-key navigation.
- **SIP & TCC Compatibility** — Uses native macOS Finder AppleScript for Trash inspection and emptying; handles system-protected cache directories without crashing.
- **Safe by Default** — Every destructive action requires explicit confirmation.
- **Dry-Run Mode** — Preview exact file paths and byte counts before anything is touched (`--dry-run`).
- **Protected Paths** — Documents, Desktop, Photos, Keychain, SSH keys, and system directories are permanently hardlocked against deletion.
- **Developer Tool Cleaners** — Targets npm, pnpm, Yarn, CocoaPods, Homebrew, Xcode DerivedData, Simulator caches, and Docker dangling images.
- **Smooth Navigation** — Constrained arrow-key browsing (`loop: false`) with explicit on-screen cancel and exit options (no forced `Ctrl+C`).
- **Update Notifications** — Checks npm registry in background on launch with quick one-click upgrade.
- **Machine-Readable Output** — Full JSON support (`clrx scan --json`) for automated workflows.
- **Zero Sudo Required** — Runs entirely as your standard user.

---

## Safety Philosophy

ClrX enforces a strict safety model:

1. **Analyze First** — Scans and reports reclaimable size before asking to delete.
2. **Explicit Consent** — All destructive operations require confirmation.
3. **Protected Paths** — These are **never** deleted under any circumstances:
   - `~/Documents`, `~/Desktop`, `~/Pictures`, `~/Movies`, `~/Music`
   - `~/.ssh`, `~/.gnupg`, `~/.aws`
   - `~/Library/Keychains`, `~/Library/Preferences`
   - `/System`, `/Library`, `/`, `/usr`, `/bin`
4. **Path Validation** — All paths are resolved and checked against path traversal attacks.
5. **Safe APIs** — Uses native Node.js filesystem APIs with recursive safety checks instead of dangerous shell commands like `rm -rf ${userInput}`.
6. **Report-Only for Sensitive Folders**:
   - `~/Downloads` is analyzed and reported for manual review, never auto-deleted.
   - iOS / iPad Backups are detected and reported for management via Finder / iTunes.
   - Docker volumes are never pruned — only dangling images and stopped containers.

---

## Usage

### Interactive Dashboard

```bash
clrx
```

Launches the interactive dashboard showing current reclaimable storage overview, scan options, safe cleaner, dry run, and system info.

### Scan Reclaimable Space

```bash
# Scan all categories
clrx scan

# Scan and output JSON
clrx scan --json

# Scan a single category
clrx scan --category user-caches
clrx scan --category npm-cache
```

### Clean Reclaimable Space

```bash
# Interactive selection (choose categories with Space, confirm with Enter)
clrx clean

# Dry-run preview (shows exactly what would be removed — nothing is deleted)
clrx clean --dry-run

# Clean only SAFE-rated categories
clrx clean --safe

# Auto-confirm safe categories (for scripts / cron)
clrx clean --safe --yes

# Clean a specific category
clrx clean --category homebrew

# Verbose logging
clrx clean --verbose
```

### System & Disk Info

```bash
clrx info
```

Displays macOS version, architecture, Node.js version, disk partition usage, detected developer tools (npm, brew, docker, xcode, pod), and category breakdown.

---

## Cleanup Categories

| Category | Safety Level | Target Paths |
|---|---|---|
| **User Caches** | `SAFE` | `~/Library/Caches` |
| **User Logs** | `SAFE` | `~/Library/Logs` |
| **Browser Caches** | `SAFE` | Google Chrome, Firefox, Safari cache stores |
| **npm Cache** | `SAFE` | `~/.npm` |
| **pnpm Cache** | `SAFE` | `~/Library/pnpm/store` |
| **Yarn Cache** | `SAFE` | `~/Library/Caches/Yarn` |
| **CocoaPods Cache** | `SAFE` | `~/Library/Caches/CocoaPods` |
| **Homebrew** | `CAUTION` | Homebrew cache + `brew cleanup` prune |
| **Xcode** | `CAUTION` | `~/Library/Developer/Xcode/DerivedData` + iOS Simulator caches |
| **Docker** | `CAUTION` | Dangling images and stopped containers |
| **Trash** | `CAUTION` | `~/.Trash` and mounted volume trash via Finder |
| **Downloads** | `CONFIRMATION REQUIRED` | `~/Downloads` (Report-only, manual review) |
| **iOS Backups** | `CONFIRMATION REQUIRED` | `~/Library/Application Support/MobileSync/Backup` (Report-only) |

---

## Development

```bash
# Clone and install dependencies
git clone https://github.com/ShoaaibTaimur/clrx-cli.git
cd clrx-cli
npm install

# Run in dev mode (hot execution with tsx)
npm run dev

# Run test suite (77 tests across safety, cleaners, dryrun, registry)
npm test

# Build TypeScript to dist/
npm run build

# Code style and linting
npm run lint
npm run format
npm run typecheck
```

---

## Links

- **npm Package**: [https://www.npmjs.com/package/@shoaaib_taimur/clrx](https://www.npmjs.com/package/@shoaaib_taimur/clrx)
- **GitHub Repository**: [https://github.com/ShoaaibTaimur/clrx-cli](https://github.com/ShoaaibTaimur/clrx-cli)

---

## License

MIT © [Shoaaib Taimur](LICENSE)

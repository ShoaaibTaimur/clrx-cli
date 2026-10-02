# Build ClrX — A Safe, Modern macOS Storage Cleaner CLI

I want you to build a production-quality npm CLI called **ClrX**.

ClrX is the modern TypeScript/Node.js evolution of an existing custom macOS cleanup CLI called **CacheX**.

The existing CacheX source code is located at:

```bash
~/bin/cachex
```

It is a Zsh script and is currently functional on my Mac.

## 1. FIRST: Inspect the Existing CacheX

Before writing any code:

1. Read the complete contents of:

```bash
~/bin/cachex
```

2. Understand every function, cleanup operation, path, command, safety check, confirmation, and behavior.
3. Create an internal feature inventory of everything CacheX currently does.
4. Do NOT remove existing functionality unless there is a strong safety reason.
5. Treat CacheX as the functional specification for the initial ClrX implementation.

Do not simply translate the Zsh syntax line-by-line.

Instead, understand what each operation does and implement it properly in TypeScript.

---

# 2. Project Goal

Build:

**ClrX — Safe macOS Storage Cleaner**

The philosophy should be:

> Analyze first. Explain what can be removed. Ask before destructive operations. Never blindly delete user data.

ClrX should be significantly safer and more maintainable than the original shell script.

It should be suitable for eventually publishing to npm.

The package should expose a command:

```bash
clrx
```

---

# 3. Technology Stack

Use:

* Node.js
* TypeScript
* ESM
* Commander.js for CLI commands
* @inquirer/prompts for interactive prompts
* chalk for terminal colors
* ora for spinners
* cli-table3 for tables where useful
* Vitest for testing
* ESLint
* Prettier

Use modern TypeScript.

Avoid unnecessary dependencies.

Prefer Node.js built-in APIs whenever practical.

The project must work properly on:

```text
macOS
Apple Silicon
Intel Mac
```

Target modern supported Node.js LTS versions.

---

# 4. Project Structure

Use a clean architecture similar to:

```text
clrx/
├── src/
│   ├── cli.ts
│   │
│   ├── commands/
│   │   ├── index.ts
│   │   ├── scan.ts
│   │   ├── clean.ts
│   │   ├── info.ts
│   │   └── version.ts
│   │
│   ├── cleaners/
│   │   ├── browser.ts
│   │   ├── caches.ts
│   │   ├── logs.ts
│   │   ├── trash.ts
│   │   ├── downloads.ts
│   │   ├── ios-backups.ts
│   │   ├── npm.ts
│   │   ├── homebrew.ts
│   │   ├── xcode.ts
│   │   └── docker.ts
│   │
│   ├── core/
│   │   ├── scanner.ts
│   │   ├── cleaner.ts
│   │   ├── safety.ts
│   │   ├── filesystem.ts
│   │   ├── permissions.ts
│   │   └── registry.ts
│   │
│   ├── utils/
│   │   ├── size.ts
│   │   ├── formatting.ts
│   │   ├── platform.ts
│   │   └── logger.ts
│   │
│   └── types/
│       └── cleaner.ts
│
├── tests/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
├── README.md
├── LICENSE
└── .gitignore
```

You may adjust this structure if you have a better architecture, but keep responsibilities separated.

---

# 5. Core CLI

Running:

```bash
clrx
```

should launch an interactive dashboard.

Example:

```text
╭──────────────────────────────────────────────╮
│                  ClrX                      │
│        Safe macOS Storage Cleaner           │
╰──────────────────────────────────────────────╯

Scanning your Mac...

Storage Overview
──────────────────────────────────────────────
Caches                         4.82 GB
Logs                           1.21 GB
Trash                          3.40 GB
Downloads                      8.71 GB
Browser Data                   2.14 GB
Developer Data                 5.32 GB
──────────────────────────────────────────────
Potentially reclaimable       25.60 GB

What would you like to do?

❯ Scan
  Clean
  Clean Recommended
  Select Items
  System Information
  Exit
```

Do not hardcode these numbers. Everything must come from actual filesystem inspection.

---

# 6. Scan Mode

Implement:

```bash
clrx scan
```

Scan the supported cleanup targets and report:

* category
* path
* size
* number of files where practical
* safety level
* whether the target currently exists
* whether it is actually removable

Example:

```text
ClrX Scan

Category             Size       Safety
────────────────────────────────────────
User Caches          4.82 GB    SAFE
Browser Caches       1.34 GB    SAFE
Logs                 1.21 GB    SAFE
Trash                3.40 GB    CAUTION
npm Cache            2.10 GB    SAFE
Homebrew Cache       0.84 GB    SAFE
Xcode DerivedData    3.20 GB    CAUTION
Docker               5.42 GB    CAUTION
iOS Backups          8.20 GB    DANGER
```

Do not claim that something is removable merely because it is large.

---

# 7. Dry Run

This is mandatory.

Implement:

```bash
clrx clean --dry-run
```

It must NEVER delete anything.

Instead show exactly what would happen.

Example:

```text
DRY RUN — Nothing will be deleted

Would remove:

  ~/Library/Caches/...
  ~/Library/Logs/...
  ~/.npm/_cacache/...

Estimated reclaimable space: 6.42 GB
```

---

# 8. Safety System

Every cleanup operation must have a safety classification.

Use something like:

```typescript
enum SafetyLevel {
  SAFE,
  CAUTION,
  CONFIRMATION_REQUIRED,
  PROTECTED
}
```

### SAFE

Examples:

* temporary cache files
* browser cache
* application cache
* old disposable logs
* package-manager cache

### CAUTION

Examples:

* Xcode DerivedData
* Homebrew cache
* Docker unused resources
* developer build artifacts

### CONFIRMATION_REQUIRED

Examples:

* Downloads
* iOS backups
* large user-created temporary data
* anything where deletion could cause meaningful data loss

### PROTECTED

Never automatically delete:

* Documents
* Desktop
* Pictures
* Movies
* Music
* SSH keys
* Git repositories
* application databases
* Keychain data
* credentials
* configuration files
* system-critical directories
* arbitrary files outside explicitly registered cleanup targets

Do NOT implement a generic:

```bash
rm -rf "$HOME/..."
```

style cleaner.

Every deletion target must be explicitly registered.

---

# 9. Trash Handling

Prefer moving recoverable files to macOS Trash instead of permanently deleting them where practical.

Never recursively delete arbitrary user data just because it is inside a user directory.

---

# 10. Existing CacheX Functionality

Preserve every legitimate cleanup category currently implemented by:

```bash
~/bin/cachex
```

In particular, inspect the existing script for things such as:

* user caches
* logs
* Trash
* Downloads
* Chrome
* Firefox
* Safari
* iOS backups
* other application caches
* any developer caches
* any additional cleanup functionality

Do not assume the list above is complete.

The actual CacheX source is authoritative for the initial feature set.

---

# 11. Developer Cleanup

Add optional developer-oriented cleaners where safe.

Potential integrations:

### npm

```bash
npm cache
```

Detect whether npm exists before using it.

### Homebrew

Detect:

```bash
brew
```

Only run Homebrew cleanup when explicitly selected.

### Xcode

Potential targets:

```text
~/Library/Developer/Xcode/DerivedData
~/Library/Developer/Xcode/Archives
~/Library/Developer/CoreSimulator
```

Be extremely careful with simulator data and archives.

Do not automatically delete these without confirmation.

### Docker

Only offer Docker cleanup if Docker is installed and available.

Do not automatically remove Docker volumes.

Make potentially destructive Docker operations explicit.

---

# 12. Permissions

ClrX should work without sudo whenever possible.

Do NOT automatically request administrator privileges.

If a target cannot be accessed:

```text
⚠ Permission denied

Path:
~/some/path

ClrX skipped this location safely.
```

Never work around macOS security protections using unsafe methods.

---

# 13. Missing Applications

ClrX must gracefully handle applications that are not installed.

For example, if Firefox is absent:

```text
Firefox
Not installed — skipped
```

No errors.

Same for:

* Chrome
* Docker
* Xcode
* Homebrew
* npm
* other optional tools

---

# 14. Command Design

Implement at least:

```bash
clrx
clrx scan
clrx clean
clrx clean --dry-run
clrx info
clrx --version
clrx --help
```

Consider supporting:

```bash
clrx clean --safe
clrx clean --category cache
clrx clean --category logs
clrx clean --category browser
clrx clean --category developer
```

Do not add unnecessary commands just for the sake of having more commands.

---

# 15. Non-Interactive Mode

Support automation.

For example:

```bash
clrx clean --safe --yes
```

But safety restrictions must STILL apply.

`--yes` means:

> accept confirmation prompts

It must NOT mean:

> bypass safety rules

Never allow a flag to bypass protected-path restrictions.

---

# 16. JSON Output

Add machine-readable output:

```bash
clrx scan --json
```

Example:

```json
{
  "platform": "darwin",
  "architecture": "arm64",
  "categories": [
    {
      "name": "User Caches",
      "sizeBytes": 5182342342,
      "safety": "SAFE"
    }
  ],
  "totalReclaimableBytes": 5182342342
}
```

This will allow ClrX to later integrate with other tools.

---

# 17. Storage Formatting

Implement human-readable sizes:

```text
512 B
1.24 KB
42.8 MB
2.41 GB
1.02 TB
```

Use bytes internally.

Never perform calculations using formatted strings.

---

# 18. Performance

Scanning should be reasonably fast.

Avoid unnecessarily reading every file multiple times.

If a directory is scanned for size, reuse the result instead of rescanning it.

Use asynchronous filesystem APIs where appropriate.

Do not freeze the terminal unnecessarily.

Show progress for long-running operations.

---

# 19. Error Handling

ClrX should never crash because:

* a directory doesn't exist
* a file disappears during scanning
* permission is denied
* an application is not installed
* a command is unavailable
* a file is locked
* a cleanup operation fails

Instead report:

```text
⚠ Skipped: <path>
Reason: Permission denied
```

Continue with the remaining cleaners.

At the end:

```text
Cleanup completed

Removed: 4.21 GB
Skipped: 3 items
Failed: 1 item

Run `clrx scan` to inspect remaining reclaimable space.
```

---

# 20. Logging

Provide useful logging without dumping excessive information.

Potential flags:

```bash
clrx clean --verbose
clrx clean --quiet
```

Do not expose sensitive information unnecessarily.

Never log:

* passwords
* tokens
* credentials
* private keys
* environment secrets

---

# 21. Testing

Create automated tests using Vitest.

Test:

* size formatting
* safety classification
* path validation
* protected path detection
* missing directories
* dry-run behavior
* cleaner registry
* scanner behavior
* command parsing

Most importantly:

### Test that dry-run NEVER performs deletion.

### Test that protected paths can NEVER be deleted.

Use temporary test directories rather than the real user's filesystem.

---

# 22. Path Safety

This is one of the most important parts of the project.

Before any deletion:

1. Resolve the path.
2. Normalize it.
3. Confirm it belongs to a registered cleanup target.
4. Confirm it is inside the expected parent directory.
5. Reject suspicious paths.
6. Reject `/`.
7. Reject `$HOME`.
8. Reject `/System`.
9. Reject `/Library` unless the exact cleaner explicitly owns the target.
10. Reject arbitrary paths supplied through user input.

Prevent path traversal such as:

```text
../../
```

and symlink-based escapes.

If a cleanup target contains symlinks, handle them carefully.

---

# 23. Architecture

Create a cleaner interface.

For example conceptually:

```typescript
interface Cleaner {
  id: string;
  name: string;
  description: string;
  safety: SafetyLevel;

  isAvailable(): Promise<boolean>;

  scan(): Promise<ScanResult>;

  clean(options: CleanOptions): Promise<CleanResult>;
}
```

Then register cleaners centrally.

This should make it easy to add future cleaners without modifying the core cleaning engine.

---

# 24. No Dangerous Shell Execution

Avoid shell commands when Node.js APIs can perform the task safely.

If an external command is necessary:

* use `spawn`/`execFile`
* avoid shell interpolation
* never concatenate untrusted paths into shell commands
* validate all arguments

Never use:

```typescript
exec(`rm -rf ${userInput}`)
```

---

# 25. CLI UX

ClrX should feel polished.

Use colors sparingly.

Use:

* green for successful operations
* yellow for warnings
* red for dangerous/failed operations
* cyan/neutral colors for information

Do not make the terminal look cluttered.

The branding should be:

```text
ClrX
Safe macOS Storage Cleaner
```

Keep the UI minimal and professional.

---

# 26. Package Configuration

Create a proper npm package.

The executable should be:

```json
{
  "bin": {
    "clrx": "./dist/cli.js"
  }
}
```

Ensure the built CLI has the correct shebang:

```bash
#!/usr/bin/env node
```

The package should support:

```bash
npm install -g clrx
```

assuming the package is eventually published.

Also support local development:

```bash
npm run dev
npm run build
npm test
npm run lint
npm run format
```

---

# 27. README

Create a professional README containing:

* ClrX introduction
* features
* safety philosophy
* installation
* usage
* commands
* examples
* supported macOS versions
* supported Node.js versions
* safety model
* development instructions
* testing
* contributing
* license

Clearly state that ClrX is intended for macOS.

---

# 28. Development Process

Follow this order:

### Phase 1

Inspect:

```bash
~/bin/cachex
```

and understand its complete behavior.

### Phase 2

Create the TypeScript project.

### Phase 3

Implement the core filesystem and safety layer.

### Phase 4

Implement the CacheX-equivalent cleaners.

### Phase 5

Implement scan mode.

### Phase 6

Implement dry-run mode.

### Phase 7

Implement interactive cleaning.

### Phase 8

Add developer-focused cleaners.

### Phase 9

Add tests.

### Phase 10

Build and run the CLI locally.

---

# 29. Important Rule

Do NOT delete anything from my actual Mac during development unless I explicitly execute the resulting cleanup command myself.

During development:

* scans are okay
* filesystem inspection is okay
* tests must use temporary directories
* dry-run is okay
* actual deletion should NOT happen automatically

Never run:

```bash
clrx clean
```

on my behalf during development.

---

# 30. Final Verification

After implementation, verify:

```bash
npm run build
npm test
npm run lint
```

Then test:

```bash
node dist/cli.js --help
node dist/cli.js --version
node dist/cli.js scan
node dist/cli.js clean --dry-run
```

Do not publish to npm.

Do not install globally.

Do not modify my existing:

```bash
~/bin/cachex
```

Keep CacheX untouched.

The final result should be a complete, maintainable, production-quality **ClrX npm CLI**, with the existing CacheX behavior preserved and a substantially stronger safety architecture around it.

Before considering the implementation complete, compare the ClrX cleaner registry against the original CacheX source and make sure no existing legitimate CacheX functionality was accidentally omitted.

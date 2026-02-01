# Contributing to electron-pinia-sync

Thank you for your interest in contributing! This guide will help you get started with local development.

> 🚀 **New to contributing?** Check out our [Quick Start Guide](.github/CONTRIBUTING-QUICK-START.md) for a condensed version!

**Important for External Contributors:**
- The `main` branch is protected - you cannot push directly to it
- All contributions must go through Pull Requests
- All CI checks must pass before a PR can be merged
- Use [Conventional Commits](https://www.conventionalcommits.org/) format for all commits
- CHANGELOG.md is auto-generated - do not edit it manually

## Quick Start for Contributors

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create a feature branch** from `develop` (or `main`)
4. **Make your changes** and commit using conventional commit format
5. **Push** to your fork
6. **Open a Pull Request** to the original repository

## Development Setup

### Prerequisites

- Node.js >= 22.14.0
- npm >= 10.x
- Git

### Initial Setup

1. **Fork the Repository**

Visit [https://github.com/simpli-fyi/electron-pinia-sync](https://github.com/simpli-fyi/electron-pinia-sync) and click the "Fork" button.

2. **Clone Your Fork**

```bash
git clone https://github.com/YOUR_USERNAME/electron-pinia-sync.git
cd electron-pinia-sync
```

3. **Add Upstream Remote**

```bash
git remote add upstream https://github.com/simpli-fyi/electron-pinia-sync.git
```

4. **Install Dependencies**

```bash
npm install
```

3. **Build the Project**

```bash
npm run build
```

## Project Structure

```
electron-pinia-sync/
├── src/
│   ├── main/           # Main process code
│   │   └── index.ts    # MainSync class and exports
│   ├── renderer/       # Renderer process code
│   │   └── index.ts    # Pinia plugin for renderer
│   ├── preload/        # Preload script
│   │   └── index.ts    # contextBridge setup
│   ├── __tests__/      # Unit tests
│   │   ├── main.test.ts
│   │   └── renderer.test.ts
│   └── types.ts        # Shared TypeScript types
├── examples/           # Example applications
├── dist/               # Build output (generated)
└── package.json
```

## Development Workflow

### Building

Build all modules:

```bash
npm run build
```


Watch mode for development:

```bash
npm run dev
```

### Testing

Run all tests:

```bash
npm test
```

Watch mode:

```bash
npm test:watch
```

Coverage report:

```bash
npm test:coverage
```

### Code Quality

Type checking:

```bash
npm run typecheck
```

Linting:

```bash
npm run lint
```

Auto-fix linting issues:

```bash
npm run lint:fix
```

### Clean Build

Remove build artifacts:

```bash
npm run clean
```

## Testing Guidelines

### Writing Tests

- Place tests in `src/__tests__/`
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern
- Mock Electron APIs appropriately

Example:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MainSync', () => {
  beforeEach(() => {
    // Setup
  });

  it('should register a store with persistence', () => {
    // Arrange
    const store = createTestStore();
    
    // Act
    mainSync.registerStore('test', store, { persist: true });
    
    // Assert
    expect(store.$state).toBeDefined();
  });
});
```

### Mock Strategy

For Electron modules:

```typescript
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));
```

## Code Style

### TypeScript

- Use strict mode
- Prefer interfaces over types for object shapes
- Export types that users might need
- Document public APIs with JSDoc comments

Example:

```typescript
/**
 * Creates and initializes the Main process sync manager
 * 
 * @param options - Configuration options
 * @returns MainSync instance
 */
export function createMainSync(options?: MainSyncOptions): MainSync {
  return new MainSync(options);
}
```

### Naming Conventions

- **Files**: kebab-case (`main-sync.ts`)
- **Classes**: PascalCase (`MainSync`)
- **Functions**: camelCase (`createMainSync`)
- **Constants**: UPPER_SNAKE_CASE (`IPC_CHANNELS`)
- **Interfaces**: PascalCase with descriptive names (`MainSyncOptions`)

### Comments

- Use JSDoc for public APIs
- Add inline comments for complex logic
- Keep comments up-to-date with code changes

## Pull Request Process

### Before Submitting

1. **Sync Your Fork** (important!)

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

2. **Create a Feature Branch**

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

3. **Make Your Changes**
   - Write code
   - Add/update tests
   - Update documentation (README.md if API changes)
   - Use conventional commit format (see below)

4. **Run Quality Checks**

```bash
npm run typecheck  # Must pass
npm run lint       # Must pass (use lint:fix for auto-fixes)
npm test           # Must pass
npm run build      # Must succeed
```

5. **Commit Your Changes**

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```bash
git add .
git commit -m "feat: add support for encrypted storage"
# or
git commit -m "fix: prevent race condition during initialization"
```

6. **Push to Your Fork**

```bash
git push origin feature/your-feature-name
```

7. **Create Pull Request**

- Go to your fork on GitHub
- Click "New Pull Request"
- Select your feature branch
- Fill out the PR template
- Click "Create Pull Request"

### Keeping Your Fork Updated

Before starting new work, always sync with upstream:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

### PR Guidelines

1. **Title**: Use a clear, descriptive title
   - ✅ `feat: Add support for encrypted storage`
   - ❌ `Update code`

2. **Description**: Include:
   - What changes were made
   - Why they were made
   - Any breaking changes
   - Related issue numbers

3. **Commits**: 
   - Use conventional commits format
   - Keep commits focused and atomic

Conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(main): add encryption support for persisted stores

fix(renderer): prevent race condition during initialization

docs(readme): add troubleshooting section
```

### Review Process

1. All tests must pass
2. Code coverage should not decrease
3. At least one maintainer approval required
4. All review comments addressed

## Adding Examples

Examples help users understand how to use the library:

1. Create a new directory in `examples/`
2. Include a complete, working Electron app
3. Add a README.md explaining the example
4. Keep it focused on one concept

Example structure:

```
examples/
└── basic-counter/
    ├── src/
    │   ├── main.ts
    │   ├── preload.ts
    │   └── renderer.ts
    ├── package.json
    └── README.md
```

## Documentation

### Updating README

When adding features:

1. Update the relevant section in README.md
2. Add code examples
3. Update the API reference if applicable

### JSDoc Comments

All public APIs should have JSDoc comments:

```typescript
/**
 * Register a store with the sync manager
 * 
 * @param storeId - Unique identifier for the store
 * @param store - Pinia store instance
 * @param options - Configuration options
 * @param options.persist - Persistence settings
 * 
 * @example
 * ```typescript
 * mainSync.registerStore('counter', counterStore, {
 *   persist: true
 * });
 * 
 */
public registerStore(
  storeId: string,
  store: Store,
  options: { persist?: boolean | PersistOptions } = {}
): void {
  // Implementation
}
```

## Commit Message Convention

This project uses **Conventional Commits**. This is crucial because our release process is fully automated. The type of commit determines how the version number is bumped:

* **`fix:`** Bumps the **patch** version (e.g., `1.0.0` -> `1.0.1`).
* **`feat:`** Bumps the **minor** version (e.g., `1.0.0` -> `1.1.0`).
* **`feat!:`** or **`BREAKING CHANGE:`** Bumps the **major** version (e.g., `1.0.0` -> `2.0.0`).
* **`chore:`, `docs:`, `style:`, `refactor:`, `test:**` Do not trigger a new release.

> **Note:** Always use lowercase for the type. Scope is optional but recommended (e.g., `feat(main): ...`).

---

## GitHub Workflows

This project uses several automated workflows to ensure code quality and streamline releases. Understanding these workflows helps you contribute effectively.

### For Contributors

When you submit a Pull Request, the following automated checks will run:

#### 1. **CI Workflow** (`.github/workflows/ci.yml`)
Runs on every push and PR to `main` and `develop` branches.

**What it does:**
- Tests on Node.js 22.x and 24.x
- Runs TypeScript type checking
- Runs ESLint
- Runs unit tests
- Builds the package

**How to fix failures:**
```bash
npm run typecheck  # Fix TypeScript errors
npm run lint:fix   # Fix linting issues
npm test           # Fix test failures
npm run build      # Fix build issues
```

#### 2. **E2E Tests Workflow** (`.github/workflows/e2e.yml`)
Runs end-to-end tests on Ubuntu, macOS, and Windows.

**What it does:**
- Builds the library
- Installs Playwright
- Runs E2E tests across different operating systems

**How to run locally:**
```bash
npm run build
npm run test:e2e
```

### Branch Protection

The `main` branch is protected and requires:
- ✅ All CI checks to pass
- ✅ At least one maintainer approval
- ✅ Up-to-date with base branch
- ✅ No direct pushes (must use Pull Requests)

**Important:** You cannot push directly to `main`. Always work in a feature branch and create a Pull Request.

## Release Process

(For maintainers)

We use **Semantic Release** to fully automate versioning and publishing. The process is **commit-based** - no manual version changes needed!

### How it works

1. **Merge to Main**: Once a Pull Request is merged into the `main` branch, a GitHub Action is triggered.
2. **Semantic Release** (`.github/workflows/prepare-release.yml`):
   - Analyzes all new commits since the last release
   - Determines the next version based on commit types
   - Generates CHANGELOG.md content
   - Creates a Git tag (e.g., `v1.1.0`)
   - Creates a GitHub Release with release notes
   - **Note**: Does NOT commit back to `main` (respects branch protection)
3. **NPM Publish** (`.github/workflows/publish.yml`):
   - Triggered when a new GitHub Release is created
   - Updates package.json version
   - Runs all tests and quality checks
   - Publishes to NPM with provenance
   - Requires `NPM_TOKEN` secret

### Version Bumping Rules

The commit type determines the version bump:
- **`fix:`** → Patch version (1.0.0 → 1.0.1)
- **`feat:`** → Minor version (1.0.0 → 1.1.0)
- **`feat!:`** or **`BREAKING CHANGE:`** → Major version (1.0.0 → 2.0.0)
- **`chore:`, `docs:`, `style:`, `refactor:`, `test:`** → No release

### Important: Branch Protection Compatible

Our Semantic Release setup is **compatible with branch protection**:
- ✅ Creates GitHub Releases directly (no commit to main needed)
- ✅ Tag is created by GitHub (not pushed to main)
- ✅ CHANGELOG is generated in the release notes
- ✅ package.json is updated during NPM publish (not in repo)

### For Maintainers

**Skip a release:**
Include `[skip ci]` in your merge commit message.

**Manual release (emergency only):**
Semantic Release runs automatically. Manual releases should only be done if the automation fails.

**Check release status:**
- View releases: https://github.com/simpli-fyi/electron-pinia-sync/releases
- View workflow runs: https://github.com/simpli-fyi/electron-pinia-sync/actions

### Dependabot

Dependabot automatically creates PRs for dependency updates:
- **npm packages:** Weekly (Mondays)
- **GitHub Actions:** Monthly
- Dependencies are grouped (dev vs core) for easier review
- Security updates are created immediately

## Getting Help

- **Issues**: Open an issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Discord**: Join our community server (link in README)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive experience for everyone.

### Standards

- Be respectful and considerate
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the community

### Enforcement

Unacceptable behavior may result in temporary or permanent ban from the project.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to reach out:

- Open an issue
- Start a discussion
- Email: [hello@simpli.fyi]

Thank you for contributing! 🎉


# Contributing to electron-pinia-sync

Thank you for your interest in contributing! This guide will help you get started with local development.

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- npm
- Git

### Initial Setup

1. **Fork and Clone**

```bash
git clone https://github.com/simpli-fyi/electron-pinia-sync.git
cd electron-pinia-sync
```

2. **Install Dependencies**

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

Build specific modules:

```bash
npm run build:main
npm run build:renderer
npm run build:preload
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

1. **Create a feature branch**

```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes**
   - Write code
   - Add/update tests
   - Update documentation

3. **Run quality checks**

```bash
npm run typecheck
npm run lint
npm test
```

4. **Build the project**

```bash
npm run build
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

## Release Process

(For maintainers)

1. Update CHANGELOG.md
2. Create a git tag
3. Push to GitHub
4. Create Pull Request to `main`

```bash
npm version patch|minor|major
git push --follow-tags
```

We use **Semantic Release** to automate our versioning and package publishing. You don't need to manually update the version in `package.json` or write a `CHANGELOG.md`.

### How it works

1. **Merge to Main**: Once a Pull Request is merged into the `main` branch, a GitHub Action is triggered.
2. **Analysis**: Semantic Release analyzes all new commits since the last tag.
3. **Versioning**:
* It determines the next version number based on the commit types.
* It updates the `version` field in `package.json`.
* It generates/updates the `CHANGELOG.md`.


4. **Tagging**: A new Git tag (e.g., `v1.1.0`) is created and pushed.
5. **GitHub Release**: A GitHub Release is created with the generated release notes.
6. **NPM Publish**: Our secondary workflow detects the new GitHub Release and automatically publishes the package to the NPM registry with provenance.

### For Maintainers

If you need to trigger a release manually without a code change (rarely needed), you can use a "chore" commit, but keep in mind that only `feat` and `fix` trigger an actual version bump by default.

To skip a release for a specific push to main, include `[skip ci]` in your commit message.

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


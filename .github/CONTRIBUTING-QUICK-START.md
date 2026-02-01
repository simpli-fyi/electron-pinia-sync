# Quick Reference for Contributors

## 🚀 Getting Started (5 Minutes)

> **Requirements:** Node.js >= 22.14.0

```bash
# 1. Fork the repo on GitHub (click "Fork" button)

# 2. Clone YOUR fork
git clone https://github.com/YOUR_USERNAME/electron-pinia-sync.git
cd electron-pinia-sync

# 3. Add upstream
git remote add upstream https://github.com/simpli-fyi/electron-pinia-sync.git

# 4. Install & test
npm install
npm run build
npm test
```

## 📝 Making Changes

```bash
# 1. Sync with upstream (ALWAYS do this first!)
git fetch upstream
git checkout main
git merge upstream/main

# 2. Create feature branch
git checkout -b feature/my-feature

# 3. Make changes & commit (use conventional format!)
git add .
git commit -m "feat: add awesome feature"
# or
git commit -m "fix: resolve race condition"

# 4. Push to YOUR fork
git push origin feature/my-feature

# 5. Open PR on GitHub
```

## 💡 Commit Format (IMPORTANT!)

**Must use Conventional Commits format:**

```bash
# New feature (bumps minor version: 1.0.0 → 1.1.0)
git commit -m "feat: add encryption support"
git commit -m "feat(main): add new IPC channel"

# Bug fix (bumps patch version: 1.0.0 → 1.0.1)
git commit -m "fix: prevent memory leak"
git commit -m "fix(renderer): resolve sync issue"

# Breaking change (bumps major version: 1.0.0 → 2.0.0)
git commit -m "feat!: change API signature"
git commit -m "feat(main)!: remove deprecated method"

# Other types (no version bump)
git commit -m "docs: update README"
git commit -m "test: add unit test for sync"
git commit -m "chore: update dependencies"
git commit -m "refactor: simplify error handling"
git commit -m "style: fix code formatting"
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `test:` Tests
- `chore:` Maintenance
- `refactor:` Code refactoring
- `style:` Formatting
- `!` Breaking change

## ✅ Before Submitting PR

```bash
npm run typecheck  # Must pass
npm run lint       # Must pass (or use lint:fix)
npm test           # Must pass
npm run build      # Must succeed
```

## 🔒 Branch Protection

- ❌ Cannot push directly to `main`
- ✅ Must use Pull Requests
- ✅ All CI checks must pass
- ✅ Needs 1 maintainer approval
- ✅ Branch must be up-to-date

## 🤖 Automated Workflows

When you create a PR:
1. **CI checks** run automatically (test, lint, typecheck, build)
2. **E2E tests** run on Ubuntu, macOS, Windows
3. **Labels** are added automatically based on changed files
4. **Maintainer reviews** your code

After merge to main (maintainers only):
1. **Semantic Release** analyzes commits
2. **Version** is bumped automatically
3. **CHANGELOG** is updated automatically
4. **GitHub Release** is created
5. **NPM publish** happens automatically

## ❓ Common Issues

**Q: My PR shows "needs approval"**
A: Normal! Wait for maintainer review.

**Q: CI is failing**
A: Run the checks locally first:
```bash
npm run typecheck && npm run lint && npm test && npm run build
```

**Q: How do I update my PR?**
A: Just push more commits to your feature branch:
```bash
git add .
git commit -m "fix: address review comments"
git push origin feature/my-feature
```

**Q: My branch is outdated**
A: Sync with upstream:
```bash
git fetch upstream
git rebase upstream/main
git push origin feature/my-feature --force
```

**Q: Do I update CHANGELOG.md?**
A: No! It's auto-generated and included in GitHub releases.

**Q: Do I update package.json version?**
A: No! Version is managed by Semantic Release based on commit types.

**Q: What if I forgot conventional commit format?**
A: You can amend your last commit:
```bash
git commit --amend -m "feat: correct message"
git push --force
```

## 📚 Full Documentation

- **Full Guide**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Branch Protection**: [branch-protection-rules.md](branch-protection-rules.md)
- **Conventional Commits**: https://www.conventionalcommits.org/

## 🆘 Need Help?

- Open an issue
- Ask in discussions
- Tag maintainers in your PR

---

**Remember**: Use conventional commits, sync often, test before submitting! 🎉


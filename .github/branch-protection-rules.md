# Branch Protection Rules

This document describes the recommended branch protection settings for the `main` branch.

## For Repository Maintainers

To set up branch protection, go to **Settings → Branches → Add branch protection rule**.

### Configuration for `main` Branch

#### Branch name pattern
```
main
```

#### Protect matching branches

**Require a pull request before merging:**
- ✅ Required
- Number of approvals required: `1`
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require review from Code Owners (optional, if CODEOWNERS file exists)

**Require status checks to pass before merging:**
- ✅ Required
- ✅ Require branches to be up to date before merging

**Required status checks:**
- `test` (CI workflow)
- `e2e` (E2E Tests workflow)

**Require conversation resolution before merging:**
- ✅ Required

**Require signed commits:**
- ⬜ Optional (recommended but not required)

**Require linear history:**
- ✅ Required (keeps history clean)

**Do not allow bypassing the above settings:**
- ✅ Required
- Allow specified actors to bypass: `administrators` (only)

**Restrict who can push to matching branches:**
- ✅ Required
- Allow: `No one` (all changes via PRs)

**Allow force pushes:**
- ⬜ Disabled (never allow force pushes to main)

**Allow deletions:**
- ⬜ Disabled (never allow deletion of main branch)

## Summary

With these settings:
- ✅ External contributors **cannot** push directly to `main`
- ✅ All changes **must** go through Pull Requests
- ✅ All CI checks **must** pass before merging
- ✅ At least **one maintainer approval** required
- ✅ Branch must be **up-to-date** before merging
- ✅ Keeps **clean linear history**
- ⚠️ Only **administrators** can bypass (emergency only)

## Visual Reference

```
External Contributor Flow:
┌─────────────────┐
│ Fork Repository │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Feature  │
│     Branch      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Make Changes &  │
│     Commit      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Push to Fork    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Pull     │
│    Request      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CI Checks Run  │
│  Automatically  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Maintainer    │ ◄── Cannot merge without approval
│     Reviews     │ ◄── Cannot merge if CI fails
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Merged to     │
│      main       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Semantic Release│
│   Triggered     │
└─────────────────┘
```

## Testing Branch Protection

After setting up, test with a non-admin account:

1. Try to push directly to `main` → Should fail
2. Create a PR without passing CI → Should not be mergeable
3. Create a PR with passing CI → Should require approval

## Updating These Rules

If you need to change branch protection settings:

1. Update this document first
2. Notify team in discussion
3. Update GitHub settings
4. Update CONTRIBUTING.md if needed


# Publish the SimaGol repository

This checkout is initialized locally. Its origin is https://github.com/mosish/SimaGol.git. A configured origin records a destination; verify the repository on GitHub after a successful push. The setup environment's GitHub CLI was signed out. No upload to GitHub was performed during that check.

## 1. Inspect the local release

```powershell
git status --short --branch
git remote -v
git branch --show-current
git log --oneline -8
git ls-files
```

Review the list for personal data, .env, database files, sessions, uploaded media, backups and private keys. Verify the publication rights for images and approve the license choice. Use the fuller title in commit messages, for example `feat: reserve delivery slots during checkout`, `fix: restore stock on cancellation` or `docs: add restore drill`.

## 2. Create the public remote and push

Run these once on the owner's machine. Sign in to the account that controls mosish. If SimaGol already exists online, inspect its default branch and history before pushing.

```powershell
gh auth login --hostname github.com
gh auth status
gh api user --jq .login
gh repo view mosish/SimaGol --json nameWithOwner,visibility,url,defaultBranchRef
```

If the last command reports the repository is missing **and the account has permission to create it**, create an empty public repository. Because this checkout already has origin, create the remote independently:

```powershell
gh repo create mosish/SimaGol --public --description "Bilingual Persian and English flower shop"
git push -u origin main
gh repo view mosish/SimaGol --json url,visibility,defaultBranchRef
git ls-remote --heads origin main
git rev-parse HEAD
```

For an existing repository, skip gh repo create. If the existing main has commits, fetch and compare first:

```powershell
git fetch origin
git log --oneline --left-right main...origin/main
```

Reconcile diverging work before an ordinary push. Compare the remote main SHA to local HEAD after the push. Ask a second person to open the repository URL signed out to verify public visibility.

## 3. Browser fallback and fresh copies

Without gh, sign in on GitHub in the browser, create a public repository named **SimaGol** under **mosish**, and leave README, .gitignore and license unchecked. From this prepared checkout run `git push -u origin main`. Authenticate using Git Credential Manager. Keep tokens out of remote URLs.

For a source archive extracted into a new directory **without Git metadata**, initialize and review files first:

```powershell
git init -b main
git add .
git diff --cached --stat
git commit -m "chore: initialize SimaGol storefront"
git remote add origin https://github.com/mosish/SimaGol.git
git push -u origin main
```

Once live, link issues to small pull requests. Run lint and tests before merging; tag verified releases and record the running SHA in the deployment log.

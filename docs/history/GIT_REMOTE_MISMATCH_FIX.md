# Git Remote Mismatch & Vercel Sync Fix

This guide documents the process of resolving a common issue where local pushes do not appear in Vercel because of a mismatch in the remote repository URL.

## The Problem
You push changes to GitHub successfully, but Vercel shows an old commit and does not trigger a new build.

**Cause:**
*   **Local Git** is pushing to `.../your-repo`
*   **Vercel** is connected to `.../your-repo-` (or a slightly different name).

## Diagnosis
Run this command in your terminal to see where your local git is pointing:
```bash
git remote -v
```
Compare this URL with the "Connected Git Repository" in your Vercel Project Settings > Git.

## The Solution

If Vercel is looking at the correct repo (e.g., the one with the hyphen) and you need to point your local machine to it, follow these steps:

### 1. Update Remote URL
Point your local repository to the correct remote URL.
```bash
git remote set-url origin https://github.com/YourUsername/correct-repo-name
```

### 2. Sync with Remote (Crucial Step)
Since the new remote is technically a different repository history, a standard pull will fail. You must force the merge of unrelated histories.
```bash
git pull origin main --allow-unrelated-histories
```

### 3. Resolve Conflicts
If there are conflicts (which is likely if the histories are different), you usually want to keep your **local** work as the source of truth.
```bash
# Keep local version for all conflicting files
git checkout --ours .

# Stage the resolved files
git add .

# Commit the merge
git commit -m "Merge remote history (keeping local changes)"
```

### 4. Push Changes
Now you can push your changes to the correct remote.
```bash
git push origin main
```

## Verification
1.  Go to your **Vercel Dashboard**.
2.  Check the **Generic Project** deployment list.
3.  You should see a new deployment building with your latest commit message.

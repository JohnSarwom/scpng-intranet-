# Push to GitHub and Deploy to SCPNG Intranet

This document outlines the steps to push your code changes to GitHub, which typically triggers the deployment for the SCPNG Intranet.

## 1. Remote Configuration

Ensure your local repository is connected to the correct remote:

```bash
git remote -v
```

It should show:
`origin https://github.com/JohnSarwom/scpng-intranet-`

## 2. Standard Push Sequence

To save your changes and deploy, run the following commands in your terminal:

```bash
# 1. Stage all changes
git add .

# 2. Commit changes with a message (replace the message with your own)
git commit -m "Description of your changes"

# 3. Push to GitHub
git push origin main
```

## 3. Deployment

Pushing to the `main` branch on GitHub serves as the trigger for deployment (based on the `vercel.json` configuration, this likely deploys to Vercel).

## 4. Troubleshooting: Remote Mismatch

If you encounter an error about "unrelated histories" or "non-fast-forward", you may need to sync first:

```bash
git pull origin main --allow-unrelated-histories
# Resolve any conflicts if they appear
git push origin main
```

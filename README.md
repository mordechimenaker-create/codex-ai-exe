# Codex AI Terminal

Electron GUI for Windows 10: AI chat on top (Codex CLI via WSL), WSL bash terminal below.

## Prereqs

- Windows 10 with WSL installed
- Node.js (LTS) and npm
- WSL with `npm` available (for auto-installing Codex CLI)

## Install

```bash
cd /home/mor/codex-ai-exe
npm install
```

## Run (dev)

```bash
npm start
```

## Build EXE

```bash
npm run dist
```

The installer will be in `dist/`.

## Notes

- The app spawns WSL via `wsl.exe -e bash -l`.
- AI responses run `codex exec` inside WSL.
- If Codex is missing, the app runs `npm install -g @openai/codex` inside WSL.
- Non-interactive usage uses `codex exec`.
- Optional: set `WSL_DISTRO` to target a specific distro (otherwise the default WSL distro is used).

## Auto-Update (GitHub Releases)

This repo is configured for auto-updates using GitHub Releases.

1. Create a git tag and push it:

```bash
git tag v0.1.1
git push origin v0.1.1
```

2. GitHub Actions will build and publish a release automatically.
3. The app checks for updates on startup and installs them.

## Auto-Improve Loop (Button)

The app includes an “Improve x5” button that runs a **max 5 iteration** loop:

1. Uses Codex CLI to generate a unified diff.
2. Applies it, commits, pushes a branch.
3. Opens a PR and attempts auto-merge (if enabled).
4. CI builds a new EXE and the app auto-updates.

### Requirements (WSL)

- `git`, `gh` (GitHub CLI), `codex` available in WSL
- `GITHUB_TOKEN` environment variable set (with repo access)

### Notes

- The loop stops on any failure.
- It will not proceed if the repo has uncommitted changes.

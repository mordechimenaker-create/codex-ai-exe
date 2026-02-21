# Codex AI Terminal

Desktop Electron app for Windows + WSL:
- AI assistant chat in the top panel
- Real WSL terminal in the bottom panel
- Command extraction and optional auto-run flow

## Features

- WSL PTY terminal integration (`node-pty` + `xterm`)
- AI prompt flow using `codex exec` in WSL
- Command safety flow:
  - consent modal for auto-run
  - extra confirmation for dangerous commands
- One-click health check for `gh` / `codex` / WSL readiness
- "Improve x5" automation loop (branch -> PR -> optional auto-merge)
- Auto-update support through GitHub Releases (`electron-updater`)

## Requirements

- Windows 10/11 with WSL installed and working
- Node.js LTS + npm
- In WSL: `bash`, `git`, `npm`

For improve loop:
- `gh` (GitHub CLI) in WSL
- `GITHUB_TOKEN` with repository permissions

## Quick Start

```bash
git clone https://github.com/mordechimenaker-create/codex-ai-exe.git
cd codex-ai-exe
npm install
npm start
```

## Build

Development package directory:

```bash
npm run pack
```

Full distributables (including installer):

```bash
npm run dist
```

Outputs are under `dist/`.

## Offline Build (TLS/Proxy Friendly)

If your environment blocks Electron downloads via TLS interception:

```bash
npm run pack:offline
```

This command uses the local Electron cache (`~/.cache/electron`) and avoids network download during packaging.

## Environment Variables

Runtime:
- `WSL_DISTRO`: target a specific WSL distro
- `ALLOW_INSECURE_CERTS=1`: ignore cert errors in Electron (debug only)
- `DISABLE_GPU=1`: disable GPU acceleration (troubleshooting)

Improve loop:
- `GITHUB_TOKEN`: required for PR flow
- `REPO_PATH`: Windows path to repo, e.g. `C:\codex-ai-exe`

## Auto-Improve Loop

The "Improve x5" button runs up to 5 iterations:
1. Generate patch with Codex CLI.
2. Apply and commit.
3. Push branch and open PR.
4. Request auto-merge (if available).

The loop stops on failure and attempts safe rollback behavior.

## Release Flow

Tag-based release workflow is configured in `.github/workflows/release.yml`.

Create and push a tag:

```bash
git tag v0.1.12
git push origin v0.1.12
```

GitHub Actions builds and publishes release assets.

## Troubleshooting

- `x509: certificate signed by unknown authority` during packaging:
  - use `npm run pack:offline`
- `Update error ... Bad credentials` (401):
  - remove stale `GH_TOKEN` from environment and restart the app
- WSL terminal not opening:
  - verify `wsl.exe -l -q` works on host
- Improve button fails immediately:
  - run health check in app
  - confirm `GITHUB_TOKEN`, `gh auth status`, and repo access

## Project Structure

- `src/main.js`: Electron main process + WSL bridge + updater + improve runner
- `src/preload.js`: secure IPC bridge
- `src/renderer.js`: UI logic and command handling
- `scripts/improve.sh`: improve loop script
- `scripts/pack-offline.sh`: offline packaging helper

## Contributing

See `CONTRIBUTING.md`.

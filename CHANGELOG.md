# Changelog

All notable changes to this project will be documented in this file.

## [0.1.11] - 2026-02-21

### Added
- `pack:offline` build flow using cached Electron zip (`scripts/pack-offline.sh`).
- Improved README with setup, env vars, release flow, and troubleshooting.
- `CONTRIBUTING.md` for contributor workflow.

### Changed
- Improve loop now pushes using `origin` (no token in remote URL).
- More robust WSL repo path resolution in main process.
- Better error state handling in renderer AI completion flow.

### Fixed
- Nested external `ai-chatbot/` repo no longer pollutes this repository (ignored path).

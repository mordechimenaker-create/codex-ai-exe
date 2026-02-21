#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ELECTRON_VERSION="$(node -p "require('./node_modules/electron/package.json').version")"
PLATFORM="${PACK_PLATFORM:-linux}"
ARCH="${PACK_ARCH:-x64}"
ZIP_NAME="electron-v${ELECTRON_VERSION}-${PLATFORM}-${ARCH}.zip"

ELECTRON_CACHE_DIR="${ELECTRON_CACHE:-$HOME/.cache/electron}"
ZIP_PATH="$(find "$ELECTRON_CACHE_DIR" -type f -name "$ZIP_NAME" 2>/dev/null | head -n 1 || true)"

if [[ -z "${ZIP_PATH}" ]]; then
  echo "Offline package failed: missing cached Electron zip ${ZIP_NAME}" >&2
  echo "Expected under: ${ELECTRON_CACHE_DIR}" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

unzip -q "$ZIP_PATH" -d "$TMP_DIR/electron"
npx electron-builder --dir -c.electronDist="$TMP_DIR/electron" -c.electronVersion="$ELECTRON_VERSION"

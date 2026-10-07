#!/usr/bin/env bash
# Prepares Claude Code cloud sessions so checks and tests can run immediately.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile >/dev/null
# Reuse the sandbox's preinstalled Chromium for Playwright instead of downloading one.
chromium=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -n 1 || true)
if [ -n "$chromium" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export CHROMIUM_PATH=$chromium" >> "$CLAUDE_ENV_FILE"
fi
echo "export ASTRO_TELEMETRY_DISABLED=1" >> "${CLAUDE_ENV_FILE:-/dev/null}"

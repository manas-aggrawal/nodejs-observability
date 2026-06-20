#!/usr/bin/env bash
# Build, pack, and (optionally) install the tarball into a consumer app.
#
# Usage:
#   ./scripts/dev-pack.sh                       # just pack, print tgz path
#   ./scripts/dev-pack.sh /path/to/consumer     # pack and install in consumer
#
# Goes through `npm pack` rather than `npm link` on purpose: `npm link`
# creates a symlink whose nested node_modules can introduce a duplicate copy
# of @opentelemetry/api, which silently breaks the global tracer/meter/logger
# singletons. `npm pack` produces a tarball identical to what `npm publish`
# would ship, so the consumer install path is exactly the prod path.

set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Use "$*" (not "$1") so an unquoted path with spaces is rejoined back into
# one string. The user should still quote, but this prevents a cryptic
# "directory not found" when they forget.
CONSUMER_DIR="${*:-}"

cd "$PACKAGE_DIR"

echo "→ Building dist/..."
npm run build > /dev/null

echo "→ Packing..."
# npm pack prints the tgz name on stdout; redirect logs and capture the name.
TGZ_NAME="$(npm pack --silent)"
TGZ_PATH="$PACKAGE_DIR/$TGZ_NAME"

echo "✓ Packed: $TGZ_PATH"

if [[ -z "$CONSUMER_DIR" ]]; then
  echo ""
  echo "  Install in your consumer with:"
  echo "    npm install \"$TGZ_PATH\""
  exit 0
fi

if [[ ! -d "$CONSUMER_DIR" ]]; then
  echo "✗ Consumer directory not found: $CONSUMER_DIR" >&2
  exit 1
fi

echo "→ Installing into $CONSUMER_DIR..."
( cd "$CONSUMER_DIR" && npm install "$TGZ_PATH" )

echo "✓ Installed. Restart the consumer's dev server to pick up the new build."

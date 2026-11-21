#!/bin/sh
set -eu
exec "$NODE_BINARY" "$SRCROOT/../scripts/prepare-fonts.cjs"

#!/usr/bin/env bash
set -euo pipefail
cd /home/dev/projects/excalidraw
export NODE_OPTIONS="--dns-result-order=ipv4first"
exec yarn start

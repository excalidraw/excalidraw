#!/usr/bin/env bash
set -euo pipefail

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform CLI not found; skipping fmt (install from https://developer.hashicorp.com/terraform/downloads)" >&2
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
terraform fmt -recursive "${ROOT}/packages/backend/terraform"

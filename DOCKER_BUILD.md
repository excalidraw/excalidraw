# Building the Docker image (excalidraw)

This document shows how to build the `excalidraw` Docker image locally and how to pass platform/arch build args so optional native Rollup binaries are installed for the target platform.

Prerequisites

- Docker Desktop (or Docker Engine) installed and running.
- BuildKit enabled (we use `RUN --mount=type=cache` and other BuildKit features).

PowerShell (Windows)

Open PowerShell and run:

```powershell
# enable BuildKit for this session and run the build
$env:DOCKER_BUILDKIT = "1"
# Optional: explicitly set target platform/arch if you are building for a specific target
# For AMD64 (x86_64):
docker build --build-arg TARGETPLATFORM=linux/amd64 --build-arg TARGETARCH=amd64 -t excalidraw:local -f Dockerfile .
# For ARM64:
docker build --build-arg TARGETPLATFORM=linux/arm64 --build-arg TARGETARCH=arm64 -t excalidraw:local -f Dockerfile .

# If you omit the build-arg pairs, Docker will try to infer them from your host.
```

POSIX shells (macOS / Linux / WSL)

```bash
export DOCKER_BUILDKIT=1
# AMD64 example
docker build --build-arg TARGETPLATFORM=linux/amd64 --build-arg TARGETARCH=amd64 -t excalidraw:local -f Dockerfile .
```

Why this matters

- The repository has optional `@rollup/rollup-<platform>-<arch>` packages in `yarn.lock`.
- During install, npm/yarn choose which optionalDependencies to install based on the platform/arch. When building multi-platform images, you must tell npm/yarn the target platform/arch so the correct native binary is selected.
- The `Dockerfile` sets `npm_config_platform=linux` and `npm_config_arch=${TARGETARCH}` during `yarn` install and the build step so the right rollup binary is installed.

Troubleshooting

- "Cannot find module @rollup/rollup-linux-x64-gnu" after this change:
  - Confirm BuildKit is enabled (`DOCKER_BUILDKIT=1`).
  - Pass `--build-arg TARGETPLATFORM=linux/amd64 --build-arg TARGETARCH=amd64` explicitly (or arm64 where appropriate).
  - Try clearing Yarn cache (locally) or let BuildKit cache mount do its job: add `--no-cache` to `docker build` to force a clean run if caches are stale.

- Network/timeouts during yarn install: the `Dockerfile` includes `--network-timeout 600000`; ensure you have an open connection to the npm registry or your proxy is configured.

- If your host is Windows and you still see mismatched binaries, try building via WSL (Ubuntu) or explicitly set arch/target args as shown above.

If you want I can:
- Add a convenience npm script to `package.json` that wraps the Docker build for your OS.
- Add CI configuration for multi-arch image builds.
- Help you run the above commands interactively on your machine.

Cross-platform helper

If you prefer a cross-platform helper (works on macOS, Linux, WSL and Windows), there's a Node script at `scripts/docker-build.js` and an npm script `docker:build:cross`.

Usage (from the `excalidraw` folder):

```powershell
# Default (amd64)
yarn docker:build:cross

# Custom args (example: build for arm64, different image name)
node ./scripts/docker-build.js --image "excalidraw:dev" --targetPlatform "linux/arm64" --targetArch "arm64" --noCache
```


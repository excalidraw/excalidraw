FROM node:24-bullseye

# Vite wants to open the browser using `open`, so we
# need to install those utils.
RUN apt update -y && apt install -y xdg-utils

# pnpm is provided by corepack, at the version pinned by "packageManager" in
# package.json
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

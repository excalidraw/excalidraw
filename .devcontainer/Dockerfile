FROM node:20-bullseye

# Install additional tools
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    git \
    curl \
    wget \
    ca-certificates \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Install Yarn
RUN corepack enable && corepack prepare yarn@stable --activate

# Set up user
ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=$USER_UID

USER $USERNAME

WORKDIR /workspace

# Default command
CMD ["sleep", "infinity"]

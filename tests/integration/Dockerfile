# Dockerfile for ai-ready integration tests
# Creates an isolated Ubuntu environment to test real-world scenarios

FROM ubuntu:latest

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 25.x (matching development environment)
RUN curl -fsSL https://deb.nodesource.com/setup_25.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN node --version && npm --version

# Create workspace directory
WORKDIR /workspace

# Create a non-root user for testing (simulates real user environment)
RUN useradd -m -s /bin/bash testuser && \
    chown -R testuser:testuser /workspace

# Switch to test user
USER testuser

# Set HOME environment variable
ENV HOME=/home/testuser

# Default command runs the integration test script
CMD ["/workspace/tests/integration/run-integration-tests.sh"]

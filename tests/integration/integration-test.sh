#!/bin/bash
# Host-side script to build and run Docker-based integration tests

set -e  # Exit on error

echo "=== AI-Ready Docker Integration Tests ==="
echo ""

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Project root: $PROJECT_ROOT"
echo ""

# Step 1: Build the project
echo "Step 1: Building project..."
cd "$PROJECT_ROOT"
make build

if [ ! -f "$PROJECT_ROOT/dist/ai-ready-exec.js" ]; then
    echo "Error: Build failed - dist/ai-ready-exec.js not found"
    exit 1
fi

echo "✔ Build complete"
echo ""

# Step 2: Build Docker image
echo "Step 2: Building Docker image..."
DOCKER_IMAGE="ai-ready-integration-test:latest"

docker build \
    -t "$DOCKER_IMAGE" \
    -f "$SCRIPT_DIR/Dockerfile" \
    "$PROJECT_ROOT"

echo "✔ Docker image built: $DOCKER_IMAGE"
echo ""

# Step 3: Run integration tests in container
echo "Step 3: Running integration tests in Docker container..."
echo ""

docker run \
    --rm \
    -v "$PROJECT_ROOT:/workspace:ro" \
    -e "CI=true" \
    "$DOCKER_IMAGE"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✔ All integration tests passed!"
else
    echo "✗ Integration tests failed (exit code: $EXIT_CODE)"
    exit $EXIT_CODE
fi

#!/bin/bash
# Container-side script that runs inside Docker to execute integration tests

set -e  # Exit on error

echo "=== Running Integration Tests in Docker Container ==="
echo ""

# Verify we're in the correct directory
if [ ! -f "/workspace/package.json" ]; then
    echo "Error: Not in workspace directory"
    exit 1
fi

# Create a writable test directory (workspace is mounted read-only)
TEST_DIR="/tmp/ai-ready-integration-test"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "Working directory: $TEST_DIR"
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"
echo ""

# Step 1: Initialize test project
echo "Step 1: Initializing test project..."
npm init -y > /dev/null 2>&1
echo "✔ Test project initialized"
echo ""

# Step 2: Copy fixture package to node_modules
echo "Step 2: Setting up fixture package..."
FIXTURE_SRC="/workspace/tests/fixtures/test-air-package"
FIXTURE_DEST="$TEST_DIR/node_modules/@ai-ready/test-package"

if [ ! -d "$FIXTURE_SRC" ]; then
    echo "Error: Fixture package not found at $FIXTURE_SRC"
    exit 1
fi

mkdir -p "$TEST_DIR/node_modules/@ai-ready"
cp -r "$FIXTURE_SRC" "$FIXTURE_DEST"

# Update package.json to include the dependency
cat > package.json <<EOF
{
  "name": "integration-test-project",
  "version": "1.0.0",
  "dependencies": {
    "@ai-ready/test-package": "file:node_modules/@ai-ready/test-package"
  }
}
EOF

# Create package-lock.json
npm install --package-lock-only > /dev/null 2>&1

echo "✔ Fixture package installed"
echo ""

# Step 3: Run integration test scenarios
echo "Step 3: Running integration test scenarios..."
echo ""

# Create air command alias pointing to bundled CLI
AIR_CLI="/workspace/dist/ai-ready-exec.js"

if [ ! -f "$AIR_CLI" ]; then
    echo "Error: CLI not found at $AIR_CLI"
    exit 1
fi

# Run test scenarios defined in integration-install-remove.test.js
echo "--- Scenario 1: Install and Remove Claude Skill ---"
echo "Listing available integrations..."
node "$AIR_CLI" list
echo ""

echo "Installing SkillOnly integration..."
node "$AIR_CLI" install "@ai-ready/test-package/SkillOnly"
echo ""

echo "Verifying installation..."
if [ -f "$HOME/.claude/plugins/installed_plugins.json" ]; then
    echo "✔ Plugin registry file created"
    if grep -q "skillonlyintegration" "$HOME/.claude/plugins/installed_plugins.json"; then
        echo "✔ Skill registered in Claude plugin system"
    else
        echo "✗ Skill not found in plugin registry"
        exit 1
    fi
else
    echo "✗ Plugin registry file not created"
    exit 1
fi
echo ""

echo "Listing installed integrations..."
node "$AIR_CLI" list --installed
echo ""

echo "Removing SkillOnly integration..."
node "$AIR_CLI" remove "@ai-ready/test-package/SkillOnly"
echo ""

echo "Verifying removal..."
if ! grep -q "skillonlyintegration" "$HOME/.claude/plugins/installed_plugins.json" 2>/dev/null; then
    echo "✔ Skill removed from plugin registry"
else
    echo "✗ Skill still found in plugin registry"
    exit 1
fi
echo ""

echo "--- Scenario 2: Install and Remove Generic Integration ---"
echo "Installing GenericOnly integration..."
node "$AIR_CLI" install "@ai-ready/test-package/GenericOnly"
echo ""

echo "Verifying installation..."
if [ -f "$TEST_DIR/AGENTS.md" ]; then
    echo "✔ AGENTS.md file created"
    if grep -q "GenericOnlyIntegration" "$TEST_DIR/AGENTS.md"; then
        echo "✔ Integration added to AGENTS.md"
    else
        echo "✗ Integration not found in AGENTS.md"
        exit 1
    fi
else
    echo "✗ AGENTS.md file not created"
    exit 1
fi
echo ""

echo "Removing GenericOnly integration..."
node "$AIR_CLI" remove "@ai-ready/test-package/GenericOnly"
echo ""

echo "Verifying removal..."
if ! grep -q "GenericOnlyIntegration" "$TEST_DIR/AGENTS.md" 2>/dev/null; then
    echo "✔ Integration removed from AGENTS.md"
else
    echo "✗ Integration still found in AGENTS.md"
    exit 1
fi
echo ""

echo "--- Scenario 3: Dual-Type Integration ---"
echo "Installing DualType integration (both types)..."
node "$AIR_CLI" install "@ai-ready/test-package/DualTypeIntegration"
echo ""

echo "Verifying both types installed..."
SKILL_INSTALLED=false
GENERIC_INSTALLED=false

if grep -q "dualtypeskill" "$HOME/.claude/plugins/installed_plugins.json" 2>/dev/null; then
    echo "✔ Skill component installed"
    SKILL_INSTALLED=true
fi

if grep -q "DualTypeGeneric" "$TEST_DIR/AGENTS.md" 2>/dev/null; then
    echo "✔ Generic component installed"
    GENERIC_INSTALLED=true
fi

if [ "$SKILL_INSTALLED" = false ] || [ "$GENERIC_INSTALLED" = false ]; then
    echo "✗ Dual-type installation incomplete"
    exit 1
fi
echo ""

echo "Removing only skill component..."
node "$AIR_CLI" remove "@ai-ready/test-package/DualTypeIntegration" --skill
echo ""

echo "Verifying skill removed, generic remains..."
if ! grep -q "dualtypeskill" "$HOME/.claude/plugins/installed_plugins.json" 2>/dev/null; then
    echo "✔ Skill component removed"
else
    echo "✗ Skill component still present"
    exit 1
fi

if grep -q "DualTypeGeneric" "$TEST_DIR/AGENTS.md" 2>/dev/null; then
    echo "✔ Generic component still installed"
else
    echo "✗ Generic component was incorrectly removed"
    exit 1
fi
echo ""

echo "Removing generic component..."
node "$AIR_CLI" remove "@ai-ready/test-package/DualTypeIntegration" --generic
echo ""

echo "--- Scenario 4: Cache Invalidation ---"
echo "Creating cache..."
node "$AIR_CLI" list > /dev/null
if [ -f "$TEST_DIR/.aircache.json" ]; then
    echo "✔ Cache created"
    CACHE_MTIME_1=$(stat -f %m "$TEST_DIR/.aircache.json" 2>/dev/null || stat -c %Y "$TEST_DIR/.aircache.json")
else
    echo "✗ Cache not created"
    exit 1
fi
echo ""

echo "Waiting 2 seconds..."
sleep 2

echo "Modifying package.json..."
echo '{"name":"test","version":"2.0.0","dependencies":{"@ai-ready/test-package":"file:node_modules/@ai-ready/test-package"}}' > package.json

echo "Listing integrations again (should invalidate cache)..."
node "$AIR_CLI" list > /dev/null

if [ -f "$TEST_DIR/.aircache.json" ]; then
    CACHE_MTIME_2=$(stat -f %m "$TEST_DIR/.aircache.json" 2>/dev/null || stat -c %Y "$TEST_DIR/.aircache.json")
    if [ "$CACHE_MTIME_2" -gt "$CACHE_MTIME_1" ]; then
        echo "✔ Cache invalidated and regenerated"
    else
        echo "✗ Cache was not regenerated"
        exit 1
    fi
else
    echo "✗ Cache file missing"
    exit 1
fi
echo ""

echo "=== All Integration Tests Passed! ==="
